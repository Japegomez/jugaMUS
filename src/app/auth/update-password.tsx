import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useLocalSearchParams, useRouter } from 'expo-router'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { APP_PASSWORD_UPDATE_PATH, APP_SCHEME } from '@/constants/app'
import { useAuthStore } from '@/hooks/useAuth'
import { completeOAuthSessionFromCallbackUrl, waitForAuthSession } from '@/lib/completeOAuthSession'
import { supabase } from '@/lib/supabase'
import { updatePasswordSchema, type UpdatePasswordFormValues } from '@/utils/authSchemas'
import { Colors } from '@/theme/colors'
import { Layout } from '@/theme/layout'
import { Fonts } from '@/theme/typography'

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default function UpdatePasswordScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const updatePassword = useAuthStore((s) => s.updatePassword)
  const signOut = useAuthStore((s) => s.signOut)
  const setPasswordRecoveryPending = useAuthStore((s) => s.setPasswordRecoveryPending)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [success, setSuccess] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  useEffect(() => {
    let cancelled = false

    const markRecoveryPending = () => {
      if (!cancelled) setPasswordRecoveryPending(true)
    }

    const run = async () => {
      const linkError =
        firstParam(params.error_description) ??
        firstParam(params.error) ??
        firstParam(params.message)

      if (linkError) {
        if (!cancelled) {
          setBootstrapError(linkError)
          setBootstrapping(false)
        }
        return
      }

      const code = firstParam(params.code)
      const accessToken = firstParam(params.access_token)
      const refreshToken = firstParam(params.refresh_token)
      const type = firstParam(params.type)
      const hasRecoveryParams = Boolean(
        code || (accessToken && refreshToken) || type === 'recovery'
      )
      const alreadyPending = useAuthStore.getState().passwordRecoveryPending

      if (hasRecoveryParams) {
        markRecoveryPending()
      }

      if (await waitForAuthSession(1500)) {
        if (hasRecoveryParams || alreadyPending) {
          markRecoveryPending()
          if (!cancelled) setBootstrapping(false)
          return
        }
        // Sesión normal en esta ruta (p. ej. URL pegada): no reactivar el gate de recovery.
        if (!cancelled) router.replace('/(tabs)/matches')
        return
      }

      if (code || (accessToken && refreshToken)) {
        const query = new URLSearchParams()
        if (code) query.set('code', code)
        if (accessToken) query.set('access_token', accessToken)
        if (refreshToken) query.set('refresh_token', refreshToken)
        const callbackUrl = `${APP_SCHEME}://${APP_PASSWORD_UPDATE_PATH}?${query.toString()}`
        const { error } = await completeOAuthSessionFromCallbackUrl(callbackUrl)
        if (error) {
          if (!cancelled) {
            setBootstrapError(error.message)
            setBootstrapping(false)
          }
          return
        }
        markRecoveryPending()
        if (!cancelled) setBootstrapping(false)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (!cancelled) {
        if (data.session && (hasRecoveryParams || alreadyPending)) {
          markRecoveryPending()
          setBootstrapping(false)
        } else if (data.session) {
          router.replace('/(tabs)/matches')
        } else {
          setBootstrapError('El enlace de recuperación no es válido o ha caducado.')
          setBootstrapping(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [params, setPasswordRecoveryPending, router])

  const goToLogin = () => {
    setPasswordRecoveryPending(false)
    router.replace('/(auth)/login')
  }

  const dismissToLogin = async () => {
    setDismissing(true)
    try {
      setPasswordRecoveryPending(false)
      await signOut()
      router.replace('/(auth)/login')
    } finally {
      setDismissing(false)
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    setSubmitting(true)
    try {
      const { error } = await updatePassword(values.password)
      if (error) {
        // Alert.alert is a no-op on web; keep errors visible inline.
        setFormError(error.message)
        return
      }
      setSuccess(true)
    } finally {
      setSubmitting(false)
    }
  })

  if (bootstrapping) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Preparando restablecimiento...</Text>
      </View>
    )
  }

  if (success) {
    return (
      <View style={styles.centered} accessibilityRole="alert">
        <View style={styles.successIconWrap}>
          <Ionicons name="checkmark-circle" size={56} color={Colors.primary} />
        </View>
        <Text style={[styles.heading, styles.centeredText]}>Contraseña actualizada</Text>
        <Text style={[styles.sub, styles.centeredText]}>
          Tu contraseña se ha cambiado correctamente. Ya puedes iniciar sesión con las nuevas
          credenciales.
        </Text>
        <Button title="Ir al login" onPress={goToLogin} style={styles.successBtn} />
      </View>
    )
  }

  if (bootstrapError) {
    return (
      <View style={styles.centered}>
        <Pressable
          onPress={dismissToLogin}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={styles.closeAbsolute}
          disabled={dismissing}>
          <Ionicons name="close" size={28} color={Colors.textPrimary} />
        </Pressable>
        <Text style={[styles.heading, styles.centeredText]}>Enlace no válido</Text>
        <Text style={[styles.sub, styles.centeredText]}>{bootstrapError}</Text>
        <Button title="Volver al inicio de sesión" onPress={dismissToLogin} loading={dismissing} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.topBarSpacer} />
          <Pressable
            onPress={dismissToLogin}
            accessibilityRole="button"
            accessibilityLabel="Cerrar y volver al inicio de sesión"
            hitSlop={12}
            disabled={dismissing || submitting}
            style={styles.closeBtn}>
            <Ionicons name="close" size={28} color={Colors.textPrimary} />
          </Pressable>
        </View>

        <Text style={styles.heading}>Nueva contraseña</Text>
        <Text style={styles.sub}>Elige una contraseña nueva para tu cuenta.</Text>

        {formError ? (
          <View style={styles.formError} accessibilityRole="alert">
            <Text style={styles.formErrorText}>{formError}</Text>
          </View>
        ) : null}

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Nueva contraseña"
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              showPasswordToggle
              value={value}
              onBlur={onBlur}
              onChangeText={(text) => {
                setFormError(null)
                onChange(text)
              }}
              error={errors.password?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Confirmar contraseña"
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              showPasswordToggle
              value={value}
              onBlur={onBlur}
              onChangeText={(text) => {
                setFormError(null)
                onChange(text)
              }}
              error={errors.confirmPassword?.message}
            />
          )}
        />

        <Button
          title="Guardar contraseña"
          onPress={onSubmit}
          loading={submitting}
          disabled={dismissing}
          style={styles.btn}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Layout.authScreenTopPadding,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 8,
    minHeight: 44,
  },
  topBarSpacer: { flex: 1 },
  closeBtn: {
    padding: 4,
  },
  closeAbsolute: {
    position: 'absolute',
    top: Layout.authScreenTopPadding,
    right: 24,
    zIndex: 1,
    padding: 4,
  },
  heading: {
    fontSize: 26,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  formError: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  formErrorText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.danger,
    textAlign: 'center',
  },
  loadingText: {
    color: Colors.textPrimary,
    fontSize: 15,
    textAlign: 'center',
  },
  centeredText: {
    textAlign: 'center',
  },
  successIconWrap: {
    marginBottom: 8,
  },
  successBtn: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
  btn: { marginTop: 8 },
})
