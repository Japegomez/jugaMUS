import { useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Link, useRouter, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { APP_DISPLAY_NAME } from '@/constants/app'
import { TurnstileChallengeModal } from '@/components/auth/TurnstileChallengeModal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/hooks/useAuth'
import { useTurnstileCaptcha } from '@/hooks/useTurnstileCaptcha'
import { supabase } from '@/lib/supabase'
import { loginSchema, type LoginFormValues } from '@/utils/authSchemas'
import { Colors } from '@/theme/colors'
import { useResponsiveLayout } from '@/theme/responsive'
import { Fonts } from '@/theme/typography'

export default function LoginScreen() {
  const router = useRouter()
  const { authTopPadding, font, space, isCompactHeight } = useResponsiveLayout()
  const insets = useSafeAreaInsets()
  const signInWithPassword = useAuthStore((s) => s.signInWithPassword)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const signInWithApple = useAuthStore((s) => s.signInWithApple)
  const lastAuthMessage = useAuthStore((s) => s.lastAuthMessage)
  const clearLastAuthMessage = useAuthStore((s) => s.clearLastAuthMessage)
  const [formError, setFormError] = useState<string | null>(null)
  const captcha = useTurnstileCaptcha()

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    if (!lastAuthMessage) return
    Alert.alert('Sesión', lastAuthMessage)
    clearLastAuthMessage()
  }, [lastAuthMessage, clearLastAuthMessage])

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const captchaResult = await captcha.solve()
    if (captchaResult.cancelled) return
    if (captchaResult.error) {
      setFormError(captchaResult.error)
      return
    }
    const { error } = await signInWithPassword(values.email, values.password, captchaResult.token)
    if (error) {
      setFormError(error.message)
    }
  })

  const onGoogle = async () => {
    const { error } = await signInWithGoogle()
    if (error) {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        Alert.alert('Google', error.message)
      }
    }
  }

  const onApple = async () => {
    const { error } = await signInWithApple()
    if (error) {
      Alert.alert('Apple', error.message)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: authTopPadding + 8,
            paddingBottom: Math.max(insets.bottom, 24) + 8,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { fontSize: font(28) }]}>{APP_DISPLAY_NAME}</Text>
        <Text style={[styles.infoText, { fontSize: font(15), lineHeight: font(22) }]}>
          Si deseas llevar la cuenta de una partida sin registro, pulsa Marcador. Para crear o
          unirse a partidas y torneos, inicia sesión.
        </Text>

        <Button
          title="Marcador"
          onPress={() => router.push('/(auth)/guest-scoreboard' as Href)}
          style={[styles.scoreboardBtn, isCompactHeight && { minHeight: Math.max(48, space(48)) }]}
          textStyle={[styles.scoreboardBtnLabel, { fontSize: font(18) }]}
        />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <View style={styles.dividerLine} />
        </View>

        {formError ? (
          <View style={styles.formError} accessibilityRole="alert">
            <Text style={styles.formErrorText}>{formError}</Text>
          </View>
        ) : null}

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={value}
              onBlur={onBlur}
              onChangeText={(text) => {
                setFormError(null)
                onChange(text)
              }}
              error={errors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Contraseña"
              showPasswordToggle
              autoComplete="password"
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

        <Link href="/(auth)/forgot-password" style={styles.linkForgot}>
          <Text style={styles.linkText}>¿Has olvidado la contraseña?</Text>
        </Link>

        <Button
          title="Entrar"
          onPress={onSubmit}
          loading={isSubmitting || captcha.visible}
          style={styles.btn}
        />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          title="Continuar con Google"
          variant="outline"
          onPress={onGoogle}
          style={styles.btn}
        />

        {Platform.OS === 'ios' || Platform.OS === 'web' ? (
          <Button
            title="Continuar con Apple"
            variant="outline"
            onPress={onApple}
            style={styles.btn}
          />
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿No tienes cuenta? </Text>
          <Link href="/(auth)/register">
            <Text style={styles.linkText}>Regístrate</Text>
          </Link>
        </View>
      </ScrollView>
      <TurnstileChallengeModal
        visible={captcha.visible}
        resetNonce={captcha.resetNonce}
        onSuccess={captcha.complete}
        onCancel={captcha.cancel}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  heading: {
    fontFamily: Fonts.bold,
    color: Colors.primary,
    marginBottom: 8,
  },
  infoText: {
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  scoreboardBtn: {
    minHeight: 56,
    marginBottom: 8,
  },
  scoreboardBtnLabel: {
    fontFamily: Fonts.semiBold,
  },
  formError: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    marginTop: -12,
  },
  formErrorText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.danger,
    textAlign: 'center',
  },
  linkForgot: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: 4,
  },
  linkText: {
    color: Colors.primary,
    fontFamily: Fonts.semiBold,
    fontSize: 15,
  },
  btn: { marginBottom: 12 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: 12,
    color: Colors.textSecondary,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
})
