import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Link, useRouter } from 'expo-router'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/hooks/useAuth'
import { registerSchema, type RegisterFormValues } from '@/utils/authSchemas'

export default function RegisterScreen() {
  const router = useRouter()
  const signUp = useAuthStore((s) => s.signUp)
  const [submitting, setSubmitting] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      const { error } = await signUp({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
      })
      if (error) {
        Alert.alert('Registro', error.message)
        return
      }
      Alert.alert(
        'Registro',
        'Cuenta creada. Si el proyecto exige confirmación por email, revisa tu bandeja de entrada antes de iniciar sesión.',
        [{ text: 'Ir al login', onPress: () => router.replace('/(auth)/login') }]
      )
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
        <Text style={styles.heading}>Crear cuenta</Text>
        <Text style={styles.sub}>Completa los datos para registrarte</Text>

        <Controller
          control={control}
          name="displayName"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Nombre a mostrar"
              autoComplete="name"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.displayName?.message}
            />
          )}
        />

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
              secureTextEntry
              autoComplete="new-password"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
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
              secureTextEntry
              autoComplete="new-password"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.confirmPassword?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="acceptTerms"
          render={({ field: { value, onChange } }) => (
            <View style={styles.termsBlock}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: value }}
                style={styles.checkRow}
                onPress={() => onChange(!value)}>
                <View style={[styles.box, value ? styles.boxOn : null]} />
                <Text style={styles.checkLabel}>
                  Confirmo que he leído y acepto los documentos legales.
                </Text>
              </Pressable>
              {errors.acceptTerms ? (
                <Text style={styles.termsError}>{errors.acceptTerms.message}</Text>
              ) : null}
              <View style={styles.linksRow}>
                <Link href="/(auth)/terms">
                  <Text style={styles.a}>Términos y Condiciones</Text>
                </Link>
                <Text style={styles.dot}> · </Text>
                <Link href="/(auth)/privacy">
                  <Text style={styles.a}>Política de privacidad</Text>
                </Link>
              </View>
            </View>
          )}
        />

        <Button title="Registrarme" onPress={onSubmit} loading={submitting} style={styles.btn} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
          <Link href="/(auth)/login">
            <Text style={styles.a}>Inicia sesión</Text>
          </Link>
        </View>
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
  },
  btn: { marginTop: 8 },
  termsBlock: {
    marginTop: 8,
    marginBottom: 12,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#1a5f4a',
    marginTop: 2,
  },
  boxOn: {
    backgroundColor: '#1a5f4a',
  },
  checkLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#222',
  },
  termsError: {
    color: '#b00020',
    fontSize: 13,
    marginTop: 8,
    marginLeft: 34,
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 12,
    marginLeft: 34,
  },
  a: {
    color: '#1a5f4a',
    fontWeight: '600',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  dot: { color: '#666' },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: { fontSize: 15, color: '#333' },
})
