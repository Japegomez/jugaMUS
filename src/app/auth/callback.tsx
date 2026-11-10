import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'

import { Button } from '@/components/ui/Button'
import { APP_SCHEME, APP_OAUTH_CALLBACK_PATH } from '@/constants/app'
import { useAuthStore } from '@/hooks/useAuth'
import { emailFromAccessToken, peekSessionFromAuthCode } from '@/lib/authDeepLinkIdentity'
import { completeOAuthSessionFromCallbackUrl, waitForAuthSession } from '@/lib/completeOAuthSession'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function postAuthDestination(): Href {
  if (useAuthStore.getState().passwordRecoveryPending) {
    return '/auth/update-password'
  }
  const pending = useAuthStore.getState().pendingInviteHref
  if (pending) {
    useAuthStore.getState().setPendingInviteHref(null)
    return pending as Href
  }
  return '/(tabs)/matches'
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'confirm'; email: string; callbackUrl: string }
  | { kind: 'adopting' }
  | { kind: 'error'; message: string }

export default function AuthCallbackScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })

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

      const type = firstParam(params.type)
      if (type === 'recovery') {
        useAuthStore.getState().setPasswordRecoveryPending(true)
      }

      const { data: existing } = await supabase.auth.getSession()
      if (existing.session) {
        // Never replace an existing session from a deep link.
        if (!cancelled) router.replace(postAuthDestination())
        return
      }

      // When login starts from the app, oauth.ts exchanges the code in WebBrowser.
      // The deep link also opens this screen; wait so we do not exchange twice (PKCE error).
      if (await waitForAuthSession()) {
        if (!cancelled) router.replace(postAuthDestination())
        return
      }

      const code = firstParam(params.code)
      const accessToken = firstParam(params.access_token)
      const refreshToken = firstParam(params.refresh_token)
      const nonce = firstParam(params.n)

      if (!code && !(accessToken && refreshToken)) {
        const { data } = await supabase.auth.getSession()
        if (!cancelled) {
          if (data.session) {
            router.replace(postAuthDestination())
          } else {
            router.replace('/(auth)/login')
          }
        }
        return
      }

      let email: string | null = null
      let adoptAccess = accessToken
      let adoptRefresh = refreshToken

      if (code && !(accessToken && refreshToken)) {
        const peeked = await peekSessionFromAuthCode(code)
        if (peeked.error || !peeked.access_token || !peeked.refresh_token) {
          if (!cancelled) {
            setPhase({
              kind: 'error',
              message: peeked.error?.message ?? 'No se pudo leer la cuenta del enlace.',
            })
          }
          return
        }
        email = peeked.email
        adoptAccess = peeked.access_token
        adoptRefresh = peeked.refresh_token
      } else if (accessToken) {
        email = await verifiedEmailFromAccessToken(accessToken)
      }

      if (!email || !adoptAccess || !adoptRefresh) {
        if (!cancelled) {
          setPhase({
            kind: 'error',
            message: 'No se pudo identificar la cuenta del enlace. Solicita uno nuevo.',
          })
        }
        return
      }

      const query = new URLSearchParams()
      query.set('access_token', adoptAccess)
      query.set('refresh_token', adoptRefresh)
      if (nonce) query.set('n', nonce)
      const callbackUrl = `${APP_SCHEME}://${APP_OAUTH_CALLBACK_PATH}?${query.toString()}`

      if (!cancelled) {
        setPhase({ kind: 'confirm', email, callbackUrl })
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [params, router])

  const confirmAdopt = useCallback(async () => {
    if (phase.kind !== 'confirm') return
    setPhase({ kind: 'adopting' })
    const { error } = await completeOAuthSessionFromCallbackUrl(phase.callbackUrl)
    if (error) {
      setPhase({ kind: 'error', message: error.message })
      return
    }
    router.replace(postAuthDestination())
  }, [phase, router])

  if (phase.kind === 'confirm') {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Confirmar inicio de sesión</Text>
        <Text style={styles.text}>
          Vas a iniciar sesión como{'\n'}
          <Text style={styles.email}>{phase.email}</Text>
        </Text>
        <Button title="Continuar" onPress={confirmAdopt} style={styles.btn} />
        <Button
          title="Cancelar"
          variant="outline"
          onPress={() => router.replace('/(auth)/login')}
          style={styles.btn}
        />
      </View>
    )
  }

  if (phase.kind === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Enlace no válido</Text>
        <Text style={styles.text}>{phase.message}</Text>
        <Button title="Volver al login" onPress={() => router.replace('/(auth)/login')} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>
        {phase.kind === 'adopting' ? 'Confirmando sesión...' : 'Completando inicio de sesión...'}
      </Text>
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
    backgroundColor: Colors.background,
  },
  heading: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  text: {
    color: Colors.textPrimary,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  email: {
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  btn: {
    alignSelf: 'stretch',
    marginTop: 4,
  },
})
