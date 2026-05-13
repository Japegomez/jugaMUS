// Edge Function: process-notifications
// Reads pending rows from notification_queue, batches them to the Expo Push API,
// and updates their status. Called every minute by pg_cron.
//
// Env vars (set in Supabase Dashboard → Edge Functions → Secrets):
//   SUPABASE_URL             — auto-injected by Supabase runtime
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase runtime

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const BATCH_SIZE = 50
const MAX_EXPO_BATCH = 100 // Expo API limit per request

interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  payload_json: Record<string, unknown> | null
  attempts: number
  max_attempts: number
}

interface ProfileRow {
  id: string
  push_token: string | null
}

interface ExpoPushMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default'
  badge?: number
}

interface ExpoPushTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

Deno.serve(async (req) => {
  // Accept POST and GET (pg_cron uses http_post)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  // 1. Fetch pending notifications
  const { data: rows, error: fetchErr } = await supabase
    .from('notification_queue')
    .select('id, user_id, type, title, body, payload_json, attempts, max_attempts')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(BATCH_SIZE)

  if (fetchErr) {
    console.error('[process-notifications] fetch error:', fetchErr.message)
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 })
  }

  const notifications = rows as NotificationRow[]

  // 2. Fetch push tokens for the relevant users (deduplicated)
  const userIds = [...new Set(notifications.map((n) => n.user_id))]
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id, push_token')
    .in('id', userIds)

  if (profileErr) {
    console.error('[process-notifications] profiles error:', profileErr.message)
    return new Response(JSON.stringify({ error: profileErr.message }), { status: 500 })
  }

  const tokenMap = new Map<string, string | null>(
    (profiles as ProfileRow[]).map((p) => [p.id, p.push_token])
  )

  // 3. Build Expo messages and map to notification IDs
  const messages: ExpoPushMessage[] = []
  const messageToNotifId: string[] = [] // parallel array: messages[i] → notifId
  const skippedIds: string[] = []       // notifications with no push token

  for (const notif of notifications) {
    const token = tokenMap.get(notif.user_id)
    if (!token || !token.startsWith('ExponentPushToken[')) {
      skippedIds.push(notif.id)
      continue
    }
    messages.push({
      to: token,
      title: notif.title,
      body: notif.body,
      data: notif.payload_json ?? undefined,
      sound: 'default',
    })
    messageToNotifId.push(notif.id)
  }

  // 4. Mark skipped (no token) as failed if exhausted attempts, else leave pending
  for (const id of skippedIds) {
    const notif = notifications.find((n) => n.id === id)!
    const newAttempts = notif.attempts + 1
    if (newAttempts >= notif.max_attempts) {
      await supabase
        .from('notification_queue')
        .update({ status: 'failed', attempts: newAttempts })
        .eq('id', id)
    } else {
      await supabase
        .from('notification_queue')
        .update({ attempts: newAttempts })
        .eq('id', id)
    }
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ processed: 0, skipped: skippedIds.length }), { status: 200 })
  }

  // 5. Send to Expo Push API in chunks of MAX_EXPO_BATCH
  let sent = 0
  let failed = 0

  for (let i = 0; i < messages.length; i += MAX_EXPO_BATCH) {
    const chunk = messages.slice(i, i + MAX_EXPO_BATCH)
    const chunkIds = messageToNotifId.slice(i, i + MAX_EXPO_BATCH)

    let tickets: ExpoPushTicket[] = []
    try {
      const resp = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      })
      const json = await resp.json()
      tickets = Array.isArray(json.data) ? json.data : []
    } catch (err) {
      console.error('[process-notifications] Expo API error:', err)
      // Network error — increment attempts without marking as failed yet
      for (let j = 0; j < chunkIds.length; j++) {
        const id = chunkIds[j]
        const notif = notifications.find((n) => n.id === id)!
        const newAttempts = notif.attempts + 1
        await supabase
          .from('notification_queue')
          .update({
            attempts: newAttempts,
            ...(newAttempts >= notif.max_attempts ? { status: 'failed' } : {}),
          })
          .eq('id', id)
        failed++
      }
      continue
    }

    // 6. Update each notification based on Expo ticket status
    for (let j = 0; j < chunkIds.length; j++) {
      const id = chunkIds[j]
      const ticket = tickets[j]
      const notif = notifications.find((n) => n.id === id)!
      const newAttempts = notif.attempts + 1

      if (ticket?.status === 'ok') {
        await supabase
          .from('notification_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: newAttempts })
          .eq('id', id)
        sent++
      } else {
        // Expo returned an error for this token
        const isFinal = newAttempts >= notif.max_attempts
        await supabase
          .from('notification_queue')
          .update({
            attempts: newAttempts,
            status: isFinal ? 'failed' : 'pending',
          })
          .eq('id', id)
        failed++
        if (ticket?.details?.error === 'DeviceNotRegistered') {
          // Clean up stale token
          await supabase
            .from('profiles')
            .update({ push_token: null })
            .eq('id', notif.user_id)
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ processed: messages.length + skippedIds.length, sent, failed, skipped: skippedIds.length }),
    { status: 200 }
  )
})
