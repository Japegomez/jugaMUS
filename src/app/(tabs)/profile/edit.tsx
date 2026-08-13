import { useCallback, useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import * as ImagePicker from 'expo-image-picker'
import { useRouter, type Href } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView'
import { Input } from '@/components/ui/Input'
import { MunicipalityPicker } from '@/components/ui/MunicipalityPicker'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useAuthStore } from '@/hooks/useAuth'
import { useProfile, useUpdateProfile, useUploadAvatar } from '@/hooks/useProfile'
import {
  AUTH_PASSWORD_HINT,
  changePasswordSchema,
  type ChangePasswordFormValues,
} from '@/utils/authSchemas'
import { phoneE164Schema } from '@/utils/validators'
import { Colors } from '@/theme/colors'
import { useResponsiveLayout } from '@/theme/responsive'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'

const editProfileSchema = z.object({
  display_name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone_e164: phoneE164Schema,
  city: z.string().trim().max(100, 'Ciudad demasiado larga').optional().or(z.literal('')),
})

type EditProfileValues = z.infer<typeof editProfileSchema>

export default function EditProfileScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { font, space } = useResponsiveLayout()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)
  const updatePassword = useAuthStore((s) => s.updatePassword)
  const { data: profile, isLoading } = useProfile(sessionUserId)
  const updateProfile = useUpdateProfile()
  const uploadAvatar = useUploadAvatar()

  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [pendingMimeType, setPendingMimeType] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditProfileValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      display_name: '',
      phone_e164: '',
      city: '',
    },
  })

  const {
    control: passwordControl,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors, isDirty: passwordDirty },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      password: '',
      confirmPassword: '',
    },
  })

  // Populate form once profile loads
  useEffect(() => {
    if (profile) {
      reset({
        display_name: profile.display_name,
        phone_e164: profile.phone_e164,
        city: profile.city ?? '',
      })
    }
  }, [profile, reset])

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la galería para cambiar la foto.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    })

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setAvatarUri(asset.uri)
      setPendingMimeType(asset.mimeType ?? null)
    }
  }

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace('/(tabs)/profile' as Href)
  }, [router])

  const onSubmit = async (values: EditProfileValues) => {
    try {
      // Upload avatar first if user picked a new one
      if (avatarUri) {
        await uploadAvatar.mutateAsync({ uri: avatarUri, mimeType: pendingMimeType })
      }

      await updateProfile.mutateAsync({
        display_name: values.display_name,
        phone_e164: values.phone_e164,
        city: values.city || null,
      })

      goBack()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al guardar el perfil'
      Alert.alert('Error', message)
    }
  }

  const isSaving = updateProfile.isPending || uploadAvatar.isPending

  const onChangePassword = handlePasswordSubmit(async (values) => {
    setPasswordError(null)
    setPasswordSuccess(false)
    setChangingPassword(true)
    try {
      const { error } = await updatePassword(values.password, values.currentPassword)
      if (error) {
        setPasswordError(error.message)
        return
      }
      resetPassword()
      setPasswordSuccess(true)
    } finally {
      setChangingPassword(false)
    }
  })

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  const currentAvatarUri = avatarUri ?? profile?.photo_url ?? null
  const displayName = profile?.display_name ?? ''
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '')
    .join('')
  const avatarSize = space(96)
  const avatarRadius = avatarSize / 2

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={[styles.scroll, { paddingTop: screenTopPadding(insets.top, 24) }]}
      showsVerticalScrollIndicator={false}>
      <Text style={[styles.heading, { fontSize: font(26) }]}>Editar perfil</Text>

      {/* Avatar picker */}
      <View style={styles.avatarSection}>
        <Pressable
          onPress={pickImage}
          style={[styles.avatarWrap, { width: avatarSize, height: avatarSize }]}
          accessibilityRole="button"
          accessibilityLabel="Cambiar foto de perfil">
          {currentAvatarUri ? (
            <Image
              source={{ uri: currentAvatarUri }}
              style={[
                styles.avatar,
                { width: avatarSize, height: avatarSize, borderRadius: avatarRadius },
              ]}
            />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                { width: avatarSize, height: avatarSize, borderRadius: avatarRadius },
              ]}>
              <Text style={[styles.avatarInitials, { fontSize: font(36) }]}>{initials || '?'}</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            <Text style={styles.avatarBadgeText}>✎</Text>
          </View>
        </Pressable>
        <Text style={styles.avatarHint}>Toca para cambiar la foto</Text>
      </View>

      {/* Form fields */}
      <View style={styles.fields}>
        <Controller
          control={control}
          name="display_name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Nombre"
              placeholder="Tu nombre público"
              onChangeText={onChange}
              onBlur={onBlur}
              value={value}
              error={errors.display_name?.message}
              autoCapitalize="words"
              returnKeyType="next"
            />
          )}
        />

        <Controller
          control={control}
          name="phone_e164"
          render={({ field: { onChange, value } }) => (
            <PhoneInput
              label="Teléfono"
              value={value}
              onChangeText={onChange}
              error={errors.phone_e164?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="city"
          render={({ field: { onChange, value } }) => (
            <MunicipalityPicker
              label="Ciudad o pueblo"
              value={value ?? ''}
              onChangeText={onChange}
              error={errors.city?.message}
            />
          )}
        />
      </View>

      {/* Actions */}
      <Button
        title="Guardar cambios"
        loading={isSaving}
        disabled={(!isDirty && !avatarUri) || changingPassword}
        onPress={handleSubmit(onSubmit)}
      />

      <View style={styles.passwordSection}>
        <Text style={[styles.sectionTitle, { fontSize: font(18) }]}>Contraseña</Text>
        <Text style={styles.passwordHint}>{AUTH_PASSWORD_HINT}</Text>

        {passwordError ? (
          <View style={styles.formError} accessibilityRole="alert">
            <Text style={styles.formErrorText}>{passwordError}</Text>
          </View>
        ) : null}
        {passwordSuccess ? (
          <View style={styles.formSuccess} accessibilityRole="alert">
            <Text style={styles.formSuccessText}>Contraseña actualizada</Text>
          </View>
        ) : null}

        <Controller
          control={passwordControl}
          name="currentPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Contraseña actual"
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              showPasswordToggle
              value={value}
              onBlur={onBlur}
              onChangeText={(text) => {
                setPasswordError(null)
                setPasswordSuccess(false)
                onChange(text)
              }}
              error={passwordErrors.currentPassword?.message}
            />
          )}
        />
        <Controller
          control={passwordControl}
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
                setPasswordError(null)
                setPasswordSuccess(false)
                onChange(text)
              }}
              error={passwordErrors.password?.message}
            />
          )}
        />
        <Controller
          control={passwordControl}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Confirmar nueva contraseña"
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              showPasswordToggle
              value={value}
              onBlur={onBlur}
              onChangeText={(text) => {
                setPasswordError(null)
                setPasswordSuccess(false)
                onChange(text)
              }}
              error={passwordErrors.confirmPassword?.message}
            />
          )}
        />
        <Button
          title="Cambiar contraseña"
          loading={changingPassword}
          disabled={!passwordDirty || isSaving}
          onPress={onChangePassword}
        />
      </View>

      <Button
        title="Cancelar"
        variant="outline"
        disabled={isSaving || changingPassword}
        onPress={goBack}
      />
    </KeyboardAwareScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 40,
    backgroundColor: Colors.background,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  heading: {
    fontFamily: Fonts.bold,
    color: Colors.primary,
    marginBottom: 4,
  },
  avatarSection: {
    alignItems: 'center',
    gap: 8,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    backgroundColor: Colors.border,
  },
  avatarFallback: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeText: {
    fontSize: 13,
    color: Colors.primary,
    fontFamily: Fonts.bold,
  },
  avatarHint: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  fields: {
    gap: 8,
  },
  passwordSection: {
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    color: Colors.primary,
  },
  passwordHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  formError: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  formErrorText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.danger,
  },
  formSuccess: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  formSuccessText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.primary,
  },
})
