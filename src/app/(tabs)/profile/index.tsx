import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DeleteAccountModal } from '@/components/DeleteAccountModal'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/hooks/useAuth'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { useUserMatches } from '@/hooks/useMatches'
import { MATCH_STATUS } from '@/constants'
import type { ProfileUpdate } from '@/services/profiles.service'
import type { UserMatchSummary } from '@/services/matches.service'

type NotifField = Pick<
  ProfileUpdate,
  | 'notify_email'
  | 'notify_push'
  | 'notify_on_join'
  | 'notify_on_match_change'
  | 'notify_on_result'
  | 'notify_on_reminder'
>

function AvatarCircle({ uri, name }: { uri: string | null; name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  if (uri) {
    return <Image source={{ uri }} style={styles.avatar} />
  }

  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarInitials}>{initials || '?'}</Text>
    </View>
  )
}

export default function ProfileScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const signOut = useAuthStore((s) => s.signOut)
  const deleteAccount = useAuthStore((s) => s.deleteAccount)
  const sessionUserId = useAuthStore((s) => s.session?.user.id)
  const { data: profile, isLoading, isError } = useProfile(sessionUserId)
  const { data: userMatches, isLoading: matchesLoading } = useUserMatches(sessionUserId)
  const updateProfile = useUpdateProfile()
  const [signingOut, setSigningOut] = useState(false)
  const [savingField, setSavingField] = useState<keyof NotifField | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  const onSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo cerrar sesión'
      Alert.alert('Cerrar sesión', message)
    } finally {
      setSigningOut(false)
    }
  }

  const onNotifChange = async (field: keyof NotifField, value: boolean) => {
    setSavingField(field)
    try {
      await updateProfile.mutateAsync({ [field]: value })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo guardar la preferencia'
      Alert.alert('Notificaciones', message)
    } finally {
      setSavingField(null)
    }
  }

  const onDeleteAccount = async () => {
    setDeletingAccount(true)
    try {
      const { error } = await deleteAccount()
      if (error) throw error
      setShowDeleteModal(false)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo eliminar la cuenta'
      throw new Error(message)
    } finally {
      setDeletingAccount(false)
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a5f4a" />
      </View>
    )
  }

  if (isError || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No se pudo cargar el perfil.</Text>
        <Button
          title="Cerrar sesión"
          variant="outline"
          onPress={onSignOut}
          style={styles.signOutBtn}
          textStyle={styles.signOutLabel}
        />
      </View>
    )
  }

  const notifDisabled = updateProfile.isPending

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom + 72 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <AvatarCircle uri={profile.photo_url} name={profile.display_name} />
        <Text style={styles.displayName}>{profile.display_name}</Text>
        {profile.city ? <Text style={styles.city}>{profile.city}</Text> : null}
      </View>

      <View style={styles.card}>
        <InfoRow label="Teléfono" value={profile.phone_e164 || '—'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notificaciones</Text>

        <Text style={styles.cardSubtitle}>Canal</Text>
        <NotifToggleRow
          label="Correo electrónico"
          value={profile.notify_email}
          disabled={notifDisabled && savingField === 'notify_email'}
          onValueChange={(value) => void onNotifChange('notify_email', value)}
        />
        <NotifToggleRow
          label="Notificaciones push"
          value={profile.notify_push}
          disabled={notifDisabled && savingField === 'notify_push'}
          onValueChange={(value) => void onNotifChange('notify_push', value)}
        />

        <Text style={styles.cardSubtitle}>Por evento</Text>
        <NotifToggleRow
          label="Alguien se une a tu partida"
          value={profile.notify_on_join}
          disabled={notifDisabled && savingField === 'notify_on_join'}
          onValueChange={(value) => void onNotifChange('notify_on_join', value)}
        />
        <NotifToggleRow
          label="Partida editada o cancelada"
          value={profile.notify_on_match_change}
          disabled={notifDisabled && savingField === 'notify_on_match_change'}
          onValueChange={(value) => void onNotifChange('notify_on_match_change', value)}
        />
        <NotifToggleRow
          label="Resultado enviado o confirmado"
          value={profile.notify_on_result}
          disabled={notifDisabled && savingField === 'notify_on_result'}
          onValueChange={(value) => void onNotifChange('notify_on_result', value)}
        />
        <NotifToggleRow
          label="Recordatorios de partida"
          value={profile.notify_on_reminder}
          disabled={notifDisabled && savingField === 'notify_on_reminder'}
          onValueChange={(value) => void onNotifChange('notify_on_reminder', value)}
          isLast
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Historial</Text>
        {matchesLoading ? (
          <ActivityIndicator size="small" color="#1a5f4a" style={styles.matchesLoader} />
        ) : !userMatches || userMatches.length === 0 ? (
          <Text style={styles.matchesEmpty}>Aún no has participado en ninguna partida</Text>
        ) : (
          userMatches.map((m) => (
            <MatchHistoryRow
              key={m.id}
              match={m}
              onPress={() => router.push(`/(tabs)/matches/${m.id}`)}
            />
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Legal</Text>
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

      {profile.role === 'admin' ? (
        <Pressable
          style={styles.adminButton}
          onPress={() => router.push('/(admin)' as Href)}
          accessibilityRole="button">
          <Text style={styles.adminButtonText}>Panel de administración</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={styles.editButton}
        onPress={() => router.push('/(tabs)/profile/edit')}
        accessibilityRole="button">
        <Text style={styles.editButtonText}>Editar perfil</Text>
      </Pressable>

      <Button
        title="Cerrar sesión"
        variant="outline"
        loading={signingOut}
        onPress={onSignOut}
        style={styles.signOutBtn}
        textStyle={styles.signOutLabel}
      />

      <Button
        title="Eliminar cuenta"
        variant="danger"
        onPress={() => setShowDeleteModal(true)}
        style={styles.deleteAccountBtn}
      />

      <DeleteAccountModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        loading={deletingAccount}
        onConfirm={onDeleteAccount}
      />
    </ScrollView>
  )
}

function matchStatusLabel(status: string): { text: string; color: string } {
  switch (status) {
    case MATCH_STATUS.PLANNED:
      return { text: 'Planificada', color: '#1a5f4a' }
    case MATCH_STATUS.IN_PROGRESS:
      return { text: 'En curso', color: '#c07000' }
    case MATCH_STATUS.FINISHED:
      return { text: 'Finalizada', color: '#555' }
    case MATCH_STATUS.FINISHED_NO_RESULT:
      return { text: 'Sin resultado', color: '#999' }
    case MATCH_STATUS.CANCELLED:
      return { text: 'Cancelada', color: '#b00020' }
    default:
      return { text: status, color: '#888' }
  }
}

function MatchHistoryRow({ match, onPress }: { match: UserMatchSummary; onPress: () => void }) {
  const status = matchStatusLabel(match.status)
  const dateStr = new Date(match.start_at).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return (
    <Pressable
      style={({ pressed }) => [styles.matchRow, pressed && styles.matchRowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={match.title}>
      <View style={styles.matchRowMain}>
        <Text style={styles.matchTitle} numberOfLines={1}>
          {match.title}
        </Text>
        <Text style={styles.matchMeta}>
          {dateStr} · {match.city}
        </Text>
      </View>
      <View style={[styles.matchBadge, { borderColor: status.color }]}>
        <Text style={[styles.matchBadgeText, { color: status.color }]}>{status.text}</Text>
      </View>
    </Pressable>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

function NotifToggleRow({
  label,
  value,
  onValueChange,
  disabled = false,
  isLast = false,
}: {
  label: string
  value: boolean
  onValueChange: (next: boolean) => void
  disabled?: boolean
  isLast?: boolean
}) {
  return (
    <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
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
    backgroundColor: '#f6f7f4',
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f6f7f4',
    gap: 16,
  },
  errorText: {
    fontSize: 15,
    color: '#666',
  },
  header: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
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
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 4,
  },
  city: {
    fontSize: 15,
    color: '#555',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    marginBottom: 4,
    marginTop: 6,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 10,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  infoRowLast: {
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 15,
    color: '#333',
    flex: 1,
    paddingRight: 12,
  },
  infoValue: {
    fontSize: 15,
    color: '#555',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 8,
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
  adminButton: {
    backgroundColor: '#2c5282',
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#1a5f4a',
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutBtn: {
    borderColor: '#b42318',
  },
  signOutLabel: {
    color: '#b42318',
  },
  deleteAccountBtn: {
    marginTop: -4,
  },
  matchesLoader: { marginVertical: 12 },
  matchesEmpty: {
    fontSize: 14,
    color: '#999',
    paddingVertical: 12,
    textAlign: 'center',
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    gap: 10,
  },
  matchRowPressed: { opacity: 0.7 },
  matchRowMain: { flex: 1 },
  matchTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  matchMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  matchBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  matchBadgeText: { fontSize: 11, fontWeight: '600' },
})
