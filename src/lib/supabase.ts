import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

import { getAuthStorage } from '@/lib/authStorage'
import type { Database } from '@/types/database.types'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (__DEV__ && (!url || !anonKey)) {
  console.warn(
    '[supabase] Falta EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY. Copia .env.example a .env.local.'
  )
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: getAuthStorage(),
    autoRefreshToken: true,
    persistSession: true,
    flowType: 'pkce',
    // En web, dejar que supabase-js canjee el `?code=...` del URL al volver
    // del OAuth. En native lo hacemos manualmente desde oauth.ts.
    detectSessionInUrl: Platform.OS === 'web',
  },
})
