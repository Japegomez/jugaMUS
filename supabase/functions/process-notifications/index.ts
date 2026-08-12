// Edge Function: process-notifications
// Reads pending rows from notification_queue, batches them to the Expo Push API,
// and updates their status. Called every minute by pg_cron.
//
// Env vars (set in Supabase Dashboard → Edge Functions → Secrets):
//   SUPABASE_URL             — auto-injected by Supabase runtime
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase runtime
//   CRON_SECRET              — shared secret validated via X-Cron-Secret header

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
  notify_push: boolean
  notify_on_join: boolean
  notify_on_match_start: boolean
  notify_on_match_edit: boolean
  notify_on_match_cancel: boolean
  notify_on_result: boolean
  notify_on_reminder_24h: boolean
  notify_on_reminder_2h: boolean
  notify_on_reminder_in_progress: boolean
  notify_on_friend_request: boolean
  notify_on_match_invitation: boolean
}

/** Maps queue `type` values to profile event preference columns. */
function isNotificationAllowed(type: string, profile: ProfileRow): boolean {
  if (!profile.notify_push) return false
  switch (type) {
    case 'participant_joined':
      return profile.notify_on_join
    case 'match_started':
      return profile.notify_on_match_start
    case 'match_updated':
    case 'match_finished_no_result':
      return profile.notify_on_match_edit
    case 'match_cancelled':
    case 'match_cancelled_insufficient':
    case 'tournament_cancelled':
      return profile.notify_on_match_cancel
    case 'result_pending_validation':
      return profile.notify_on_result
    case 'reminder_24h':
      return profile.notify_on_reminder_24h
    case 'reminder_2h':
      return profile.notify_on_reminder_2h
    case 'reminder_5h_in_progress':
      return profile.notify_on_reminder_in_progress
    case 'friend_request_received':
      return profile.notify_on_friend_request
    case 'match_invitation_received':
      return profile.notify_on_match_invitation
    default:
      return true
  }
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

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

function validateCronSecret(req: Request): boolean {
  const expected = Deno.env.get('CRON_SECRET')
  if (!expected) {
    console.error('[process-notifications] CRON_SECRET is not configured')
    return false
  }
  const provided = req.headers.get('X-Cron-Secret')
  return provided === expected
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  if (!validateCronSecret(req)) {
    return unauthorized()
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
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 })
  }

  const notifications = rows as NotificationRow[]

  // 2. Fetch push tokens + preference flags for the relevant users (deduplicated)
  const userIds = [...new Set(notifications.map((n) => n.user_id))]
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select(
      'id, push_token, notify_push, notify_on_join, notify_on_match_start, notify_on_match_edit, notify_on_match_cancel, notify_on_result, notify_on_reminder_24h, notify_on_reminder_2h, notify_on_reminder_in_progress, notify_on_friend_request, notify_on_match_invitation'
    )
    .in('id', userIds)

  if (profileErr) {
    console.error('[process-notifications] profiles error:', profileErr.message)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }

  const profileMap = new Map<string, ProfileRow>(
    (profiles as ProfileRow[]).map((p) => [p.id, p])
  )

  // 3. Build Expo messages and map to notification IDs
  const messages: ExpoPushMessage[] = []
  const messageToNotifId: string[] = []
  const skippedIds: string[] = []
  const prefSkippedIds: string[] = []

  for (const notif of notifications) {
    const profile = profileMap.get(notif.user_id)
    if (!profile || !isNotificationAllowed(notif.type, profile)) {
      prefSkippedIds.push(notif.id)
      continue
    }
    const token = profile.push_token
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

  // Preference-disabled: drop permanently (do not retry).
  const notificationsById = new Map(notifications.map((n) => [n.id, n]))
  const prefSkipByMaxAttempts = new Map<number, string[]>()
  for (const id of prefSkippedIds) {
    const notif = notificationsById.get(id)
    if (!notif) continue
    const group = prefSkipByMaxAttempts.get(notif.max_attempts) ?? []
    group.push(id)
    prefSkipByMaxAttempts.set(notif.max_attempts, group)
  }
  await Promise.all(
    [...prefSkipByMaxAttempts.entries()].map(([maxAttempts, ids]) =>
      supabase
        .from('notification_queue')
        .update({ status: 'failed', attempts: maxAttempts })
        .in('id', ids)
    )
  )

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
    return new Response(
      JSON.stringify({
        processed: 0,
        skipped: skippedIds.length,
        pref_skipped: prefSkippedIds.length,
      }),
      { status: 200 }
    )
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
          await supabase
            .from('profiles')
            .update({ push_token: null })
            .eq('id', notif.user_id)
        }
      }
    }
  }

  return new Response(
    JSON.stringify({
      processed: messages.length + skippedIds.length + prefSkippedIds.length,
      sent,
      failed,
      skipped: skippedIds.length,
      pref_skipped: prefSkippedIds.length,
    }),
    { status: 200 }
  )
})
