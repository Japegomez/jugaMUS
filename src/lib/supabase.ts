import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

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
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
