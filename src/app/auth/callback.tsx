import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

import { completeOAuthSessionFromCallbackUrl, waitForAuthSession } from '@/lib/completeOAuthSession'
import { APP_SCHEME, APP_OAUTH_CALLBACK_PATH } from '@/constants/app'
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
      const oauthError =
        firstParam(params.error_description) ??
        firstParam(params.error) ??
        firstParam(params.message)

      if (oauthError) {
        if (!cancelled) router.replace('/(auth)/login')
        return
      }

      // When login starts from the app, oauth.ts exchanges the code in WebBrowser.
      // The deep link also opens this screen; wait so we do not exchange twice (PKCE error).
      if (await waitForAuthSession()) {
        if (!cancelled) router.replace('/(tabs)/matches')
        return
      }

      const code = firstParam(params.code)
      const accessToken = firstParam(params.access_token)
      const refreshToken = firstParam(params.refresh_token)

      if (code || (accessToken && refreshToken)) {
        const query = new URLSearchParams()
        if (code) query.set('code', code)
        if (accessToken) query.set('access_token', accessToken)
        if (refreshToken) query.set('refresh_token', refreshToken)
        const callbackUrl = `${APP_SCHEME}://${APP_OAUTH_CALLBACK_PATH}?${query.toString()}`
        const { error } = await completeOAuthSessionFromCallbackUrl(callbackUrl)
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
