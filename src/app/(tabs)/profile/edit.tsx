import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { MunicipalityPicker } from '@/components/ui/MunicipalityPicker'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useAuthStore } from '@/hooks/useAuth'
import { useProfile, useUpdateProfile, useUploadAvatar } from '@/hooks/useProfile'
import { phoneE164Schema } from '@/utils/validators'

const editProfileSchema = z.object({
  display_name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone_e164: phoneE164Schema,
  city: z.string().trim().max(100, 'Ciudad demasiado larga').optional().or(z.literal('')),
})

type EditProfileValues = z.infer<typeof editProfileSchema>

export default function EditProfileScreen() {
  const router = useRouter()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)
  const { data: profile, isLoading } = useProfile(sessionUserId)
  const updateProfile = useUpdateProfile()
  const uploadAvatar = useUploadAvatar()

  const [avatarUri, setAvatarUri] = useState<string | null>(null)

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
      setAvatarUri(result.assets[0].uri)
    }
  }

  const onSubmit = async (values: EditProfileValues) => {
    try {
      // Upload avatar first if user picked a new one
      if (avatarUri) {
        await uploadAvatar.mutateAsync(avatarUri)
      }

      await updateProfile.mutateAsync({
        display_name: values.display_name,
        phone_e164: values.phone_e164,
        city: values.city || null,
      })

      router.back()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al guardar el perfil'
      Alert.alert('Error', message)
    }
  }

  const isSaving = updateProfile.isPending || uploadAvatar.isPending

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a5f4a" />
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

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Editar perfil</Text>

      {/* Avatar picker */}
      <View style={styles.avatarSection}>
        <Pressable
          onPress={pickImage}
          style={styles.avatarWrap}
          accessibilityRole="button"
          accessibilityLabel="Cambiar foto de perfil">
          {currentAvatarUri ? (
            <Image source={{ uri: currentAvatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{initials || '?'}</Text>
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
        disabled={!isDirty && !avatarUri}
        onPress={handleSubmit(onSubmit)}
      />

      <Button
        title="Cancelar"
        variant="outline"
        disabled={isSaving}
        onPress={() => router.back()}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
    backgroundColor: '#f6f7f4',
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f7f4',
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1a5f4a',
    marginBottom: 4,
  },
  avatarSection: {
    alignItems: 'center',
    gap: 8,
  },
  avatarWrap: {
    position: 'relative',
    width: 96,
    height: 96,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#ddd',
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1a5f4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#1a5f4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeText: {
    fontSize: 13,
    color: '#1a5f4a',
    fontWeight: '700',
  },
  avatarHint: {
    fontSize: 13,
    color: '#888',
  },
  fields: {
    gap: 8,
  },
})
