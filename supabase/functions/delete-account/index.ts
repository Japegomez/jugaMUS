// Edge Function: delete-account
// GDPR right-to-erasure: anonymizes historical data, removes avatar, deletes auth user.
//
// Env vars (auto-injected by Supabase runtime):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   SUPABASE_ANON_KEY — used to validate the caller JWT

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = new Set([
  'https://jugamus.app',
  'https://www.jugamus.app',
])

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false
  if (ALLOWED_ORIGINS.has(origin)) return true

  // Expo web / local Metro (any port on loopback)
  try {
    const url = new URL(origin)
    const isLoopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    return isLoopback && (url.protocol === 'http:' || url.protocol === 'https:')
  } catch {
    return false
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  return headers
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const avatarPath = `${user.id}.jpg`
  const { error: storageError } = await adminClient.storage.from('avatars').remove([avatarPath])

  if (storageError) {
    console.warn('[delete-account] avatar cleanup failed:', storageError.message)
  }

  const { error: cleanupError } = await adminClient.rpc('delete_user_account_data', {
    p_user_id: user.id,
  })

  if (cleanupError) {
    console.error('[delete-account] cleanup failed:', cleanupError.message)
    return new Response(JSON.stringify({ error: 'Could not delete account data' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)

  if (deleteError) {
    console.error('[delete-account] deleteUser failed:', deleteError.message)
    return new Response(JSON.stringify({ error: 'Could not delete account' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
})
