import { useState } from 'react'
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

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/hooks/useAuth'
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/utils/authSchemas'

export default function ForgotPasswordScreen() {
  const resetPassword = useAuthStore((s) => s.resetPassword)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      const { error } = await resetPassword(values.email)
      if (error) {
        Alert.alert('Recuperación', error.message)
        return
      }
      setSent(true)
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Recuperar contraseña</Text>
        <Text style={styles.sub}>
          Te enviaremos un enlace por email para restablecer la contraseña (si existe una cuenta
          asociada).
        </Text>

        {sent ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Revisa tu correo</Text>
            <Text style={styles.bannerText}>
              Si el email es correcto, recibirás instrucciones en unos minutos. Comprueba también la
              carpeta de spam.
            </Text>
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
              onChangeText={onChange}
              error={errors.email?.message}
              editable={!sent}
            />
          )}
        />

        {!sent ? (
          <Button
            title="Enviar enlace"
            onPress={onSubmit}
            loading={submitting}
            style={styles.btn}
          />
        ) : null}

        <Link href="/(auth)/login" style={styles.backLink}>
          <Text style={styles.linkText}>Volver al inicio de sesión</Text>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f6f7f4' },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1a5f4a',
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    color: '#444',
    marginBottom: 24,
    lineHeight: 22,
  },
  banner: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  bannerTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#1a5f4a',
    marginBottom: 8,
  },
  bannerText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  btn: { marginTop: 8, marginBottom: 16 },
  backLink: {
    alignSelf: 'center',
    marginTop: 12,
  },
  linkText: {
    color: '#1a5f4a',
    fontWeight: '600',
    fontSize: 15,
  },
})
