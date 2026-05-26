import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

import { supabase } from '@/lib/supabase'

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default function AuthCallbackScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const code = firstParam(params.code)
      const accessToken = firstParam(params.access_token)
      const refreshToken = firstParam(params.refresh_token)
      const oauthError =
        firstParam(params.error_description) ??
        firstParam(params.error) ??
        firstParam(params.message)

      if (oauthError) {
        if (!cancelled) router.replace('/(auth)/login')
        return
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          if (!cancelled) router.replace('/(tabs)/matches')
          return
        }
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (!error) {
          if (!cancelled) router.replace('/(tabs)/matches')
          return
        }
      }

      const { data } = await supabase.auth.getSession()
      if (!cancelled) {
        router.replace(data.session ? '/(tabs)/matches' : '/(auth)/login')
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [params, router])

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1A5F4A" />
      <Text style={styles.text}>Completando inicio de sesión con Google...</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
  },
  text: {
    color: '#1F2937',
    textAlign: 'center',
    fontSize: 15,
  },
})
