import { useEffect } from 'react'
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
import { Link } from 'expo-router'

import { APP_DISPLAY_NAME } from '@/constants/app'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { loginSchema, type LoginFormValues } from '@/utils/authSchemas'
import { Colors } from '@/theme/colors'
import { Layout } from '@/theme/layout'
import { Fonts } from '@/theme/typography'

export default function LoginScreen() {
  const signInWithPassword = useAuthStore((s) => s.signInWithPassword)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const signInWithApple = useAuthStore((s) => s.signInWithApple)
  const lastAuthMessage = useAuthStore((s) => s.lastAuthMessage)
  const clearLastAuthMessage = useAuthStore((s) => s.clearLastAuthMessage)

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
    const { error } = await signInWithPassword(values.email, values.password)
    if (error) {
      Alert.alert('Error de acceso', 'Email o contraseña incorrectos')
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
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{APP_DISPLAY_NAME}</Text>
        <Text style={styles.sub}>Inicia sesión para continuar</Text>

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
              onChangeText={onChange}
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
              onChangeText={onChange}
              error={errors.password?.message}
            />
          )}
        />

        <Link href="/(auth)/forgot-password" style={styles.linkForgot}>
          <Text style={styles.linkText}>¿Has olvidado la contraseña?</Text>
        </Link>

        <Button title="Entrar" onPress={onSubmit} loading={isSubmitting} style={styles.btn} />

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
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Layout.authScreenTopPadding + 8,
    paddingBottom: 32,
  },
  heading: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    marginBottom: 8,
  },
  sub: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 28,
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
