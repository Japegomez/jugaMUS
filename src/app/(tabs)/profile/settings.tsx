import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter, type Href } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/hooks/useAuth'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'

const settingsSchema = z.object({
  notify_email: z.boolean(),
  notify_push: z.boolean(),
  notify_on_join: z.boolean(),
  notify_on_match_change: z.boolean(),
  notify_on_result: z.boolean(),
  notify_on_reminder: z.boolean(),
})

type SettingsValues = z.infer<typeof settingsSchema>

export default function ProfileSettingsScreen() {
  const router = useRouter()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)
  const { data: profile, isLoading } = useProfile(sessionUserId)
  const updateProfile = useUpdateProfile()

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      notify_email: true,
      notify_push: true,
      notify_on_join: true,
      notify_on_match_change: true,
      notify_on_result: true,
      notify_on_reminder: true,
    },
  })

  useEffect(() => {
    if (profile) {
      reset({
        notify_email: profile.notify_email,
        notify_push: profile.notify_push,
        notify_on_join: profile.notify_on_join,
        notify_on_match_change: profile.notify_on_match_change,
        notify_on_result: profile.notify_on_result,
        notify_on_reminder: profile.notify_on_reminder,
      })
    }
  }, [profile, reset])

  const onSubmit = async (values: SettingsValues) => {
    await updateProfile.mutateAsync(values)
    router.back()
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a5f4a" />
      </View>
    )
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Configuración</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notificaciones por canal</Text>

        <Controller
          control={control}
          name="notify_email"
          render={({ field: { onChange, value } }) => (
            <ToggleRow label="Correo electrónico" value={value} onValueChange={onChange} />
          )}
        />

        <Controller
          control={control}
          name="notify_push"
          render={({ field: { onChange, value } }) => (
            <ToggleRow label="Notificaciones push" value={value} onValueChange={onChange} isLast />
          )}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notificaciones por evento</Text>

        <Controller
          control={control}
          name="notify_on_join"
          render={({ field: { onChange, value } }) => (
            <ToggleRow label="Alguien se une a tu partida" value={value} onValueChange={onChange} />
          )}
        />

        <Controller
          control={control}
          name="notify_on_match_change"
          render={({ field: { onChange, value } }) => (
            <ToggleRow label="Partida editada o cancelada" value={value} onValueChange={onChange} />
          )}
        />

        <Controller
          control={control}
          name="notify_on_result"
          render={({ field: { onChange, value } }) => (
            <ToggleRow
              label="Resultado enviado o confirmado"
              value={value}
              onValueChange={onChange}
            />
          )}
        />

        <Controller
          control={control}
          name="notify_on_reminder"
          render={({ field: { onChange, value } }) => (
            <ToggleRow
              label="Recordatorios de partida"
              value={value}
              onValueChange={onChange}
              isLast
            />
          )}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cuenta</Text>

        <LinkRow
          label="Términos y condiciones"
          onPress={() => router.push('/(auth)/terms' as Href)}
        />
        <LinkRow
          label="Política de privacidad"
          onPress={() => router.push('/(auth)/privacy' as Href)}
          isLast
        />
      </View>

      <Button
        title="Guardar cambios"
        loading={updateProfile.isPending}
        disabled={!isDirty}
        onPress={handleSubmit(onSubmit)}
      />

      <Button title="Volver" variant="outline" onPress={() => router.back()} />
    </ScrollView>
  )
}

function ToggleRow({
  label,
  value,
  onValueChange,
  isLast = false,
}: {
  label: string
  value: boolean
  onValueChange: (next: boolean) => void
  isLast?: boolean
}) {
  return (
    <View style={[styles.toggleRow, isLast && styles.toggleRowLast]}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? '#1a5f4a' : '#ccc'}
        trackColor={{ true: '#a8d5c2', false: '#e0e0e0' }}
      />
    </View>
  )
}

function LinkRow({
  label,
  onPress,
  isLast = false,
}: {
  label: string
  onPress: () => void
  isLast?: boolean
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.linkRow,
        isLast && styles.linkRowLast,
        pressed && styles.linkRowPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button">
      <Text style={styles.linkLabel}>{label}</Text>
      <Text style={styles.linkChevron}>›</Text>
    </Pressable>
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  toggleRowLast: {
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  toggleLabel: {
    fontSize: 15,
    color: '#333',
    flex: 1,
    paddingRight: 12,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  linkRowLast: {
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  linkRowPressed: { opacity: 0.7 },
  linkLabel: {
    fontSize: 15,
    color: '#1a5f4a',
    fontWeight: '500',
  },
  linkChevron: {
    fontSize: 22,
    color: '#888',
    lineHeight: 22,
  },
})
