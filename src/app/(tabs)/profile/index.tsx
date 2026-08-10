import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { requestAppStoreRating } from '@/lib/storeReview'
import { DeleteAccountModal } from '@/components/DeleteAccountModal'
import { FeedbackModal } from '@/components/FeedbackModal'
import { AvatarCircle } from '@/components/profile/AvatarCircle'
import { MatchHistoryList } from '@/components/profile/MatchHistoryList'
import { ProfileStatsCard } from '@/components/stats/ProfileStatsCard'
import { SignOutModal } from '@/components/SignOutModal'
import { Button } from '@/components/ui/Button'
import { isRatingPromptSupported } from '@/lib/appRating'
import { useAuthStore } from '@/hooks/useAuth'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { useUserMatches } from '@/hooks/useMatches'
import type { ProfileUpdate } from '@/services/profiles.service'
import { Colors } from '@/theme/colors'
import { useResponsiveLayout } from '@/theme/responsive'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'
import { buildMatchDetailHref } from '@/utils/navigation'
import {
  buildNotifUpdates,
  buildReminderTimingUpdates,
  type NotificationPrefField,
} from '@/utils/notificationPrefs'

type NotifField = Pick<
  ProfileUpdate,
  | 'notify_push'
  | 'notify_on_join'
  | 'notify_on_match_start'
  | 'notify_on_match_edit'
  | 'notify_on_match_cancel'
  | 'notify_on_result'
  | 'notify_on_reminder_24h'
  | 'notify_on_reminder_2h'
  | 'notify_on_reminder_in_progress'
>

export default function ProfileScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { font, space } = useResponsiveLayout()
  const signOut = useAuthStore((s) => s.signOut)
  const deleteAccount = useAuthStore((s) => s.deleteAccount)
  const sessionUserId = useAuthStore((s) => s.session?.user.id)
  const { data: profile, isPending: profilePending, isError } = useProfile(sessionUserId)
  const { data: userMatches, isPending: matchesPending } = useUserMatches(sessionUserId)
  const updateProfile = useUpdateProfile()
  const [signingOut, setSigningOut] = useState(false)
  const [savingField, setSavingField] = useState<keyof NotifField | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  const onSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      setShowSignOutModal(false)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo cerrar sesión'
      Alert.alert('Cerrar sesión', message)
    } finally {
      setSigningOut(false)
    }
  }

  const onRateApp = async () => {
    await requestAppStoreRating()
  }

  const onNotifChange = async (field: NotificationPrefField, value: boolean) => {
    if (!profile || updateProfile.isPending) return
    setSavingField(field)
    try {
      await updateProfile.mutateAsync(buildNotifUpdates(profile, field, value))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo guardar la preferencia'
      Alert.alert('Notificaciones', message)
    } finally {
      setSavingField(null)
    }
  }

  const onReminderTimingChange = async (timing: '24h' | '2h', enabled: boolean) => {
    if (!profile || updateProfile.isPending) return
    const field = timing === '24h' ? 'notify_on_reminder_24h' : 'notify_on_reminder_2h'
    setSavingField(field)
    try {
      await updateProfile.mutateAsync(buildReminderTimingUpdates(profile, timing, enabled))
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

  if (profilePending && !profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
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
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: screenTopPadding(insets.top, 24), paddingBottom: 32 + insets.bottom + 72 },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <AvatarCircle
          uri={profile.photo_url}
          name={profile.display_name}
          size={space(96)}
          initialsStyle={{ fontSize: font(36) }}
        />
        <Text style={[styles.displayName, { fontSize: font(22) }]}>{profile.display_name}</Text>
        {profile.city ? <Text style={styles.city}>{profile.city}</Text> : null}
      </View>

      {sessionUserId ? (
        <ProfileStatsCard
          userId={sessionUserId}
          onPressDetails={() => router.push(`/(tabs)/profile/stats/${sessionUserId}` as Href)}
        />
      ) : null}

      <View style={styles.card}>
        <InfoRow label="Teléfono" value={profile.phone_e164 || '—'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notificaciones</Text>

        <NotifToggleRow
          label="Todas"
          value={profile.notify_push}
          disabled={notifDisabled}
          busy={savingField === 'notify_push'}
          onValueChange={(value) => void onNotifChange('notify_push', value)}
        />

        <Text style={styles.cardSubtitle}>Por evento</Text>
        <NotifToggleRow
          label="Alguien se une a tu partida"
          value={profile.notify_on_join}
          disabled={notifDisabled}
          busy={savingField === 'notify_on_join'}
          onValueChange={(value) => void onNotifChange('notify_on_join', value)}
        />
        <NotifToggleRow
          label="Partida o torneo: inicio"
          value={profile.notify_on_match_start}
          disabled={notifDisabled}
          busy={savingField === 'notify_on_match_start'}
          onValueChange={(value) => void onNotifChange('notify_on_match_start', value)}
        />
        <NotifToggleRow
          label="Partida o torneo: edición"
          value={profile.notify_on_match_edit}
          disabled={notifDisabled}
          busy={savingField === 'notify_on_match_edit'}
          onValueChange={(value) => void onNotifChange('notify_on_match_edit', value)}
        />
        <NotifToggleRow
          label="Partida o torneo: cancelación"
          value={profile.notify_on_match_cancel}
          disabled={notifDisabled}
          busy={savingField === 'notify_on_match_cancel'}
          onValueChange={(value) => void onNotifChange('notify_on_match_cancel', value)}
        />
        <NotifToggleRow
          label="Resultado pendiente de validar"
          value={profile.notify_on_result}
          disabled={notifDisabled}
          busy={savingField === 'notify_on_result'}
          onValueChange={(value) => void onNotifChange('notify_on_result', value)}
        />
        <NotifToggleRow
          label="Resultado pendiente de enviar"
          value={profile.notify_on_reminder_in_progress}
          disabled={notifDisabled}
          busy={savingField === 'notify_on_reminder_in_progress'}
          onValueChange={(value) => void onNotifChange('notify_on_reminder_in_progress', value)}
        />
        <View style={[styles.reminderRow, styles.infoRowLast]}>
          <Text style={styles.infoLabel}>Recordatorio antes de la partida</Text>
          <View style={styles.reminderChips}>
            <ReminderChip
              label="24 h antes"
              selected={profile.notify_on_reminder_24h}
              disabled={notifDisabled}
              busy={savingField === 'notify_on_reminder_24h'}
              onPress={() => void onReminderTimingChange('24h', !profile.notify_on_reminder_24h)}
            />
            <ReminderChip
              label="2 h antes"
              selected={profile.notify_on_reminder_2h}
              disabled={notifDisabled}
              busy={savingField === 'notify_on_reminder_2h'}
              onPress={() => void onReminderTimingChange('2h', !profile.notify_on_reminder_2h)}
            />
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Historial</Text>
        <MatchHistoryList
          matches={userMatches}
          loading={matchesPending}
          emptyMessage="Aún no has participado en ninguna partida"
          onMatchPress={(matchId) =>
            router.push(buildMatchDetailHref(matchId, { from: 'profile' }))
          }
        />
      </View>

      {isRatingPromptSupported() ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ayuda</Text>
          <LinkRow label="Valorar en la tienda" onPress={() => void onRateApp()} isLast />
        </View>
      ) : null}

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

      <Pressable
        style={styles.editButton}
        onPress={() => setShowFeedbackModal(true)}
        accessibilityRole="button">
        <Text style={styles.editButtonText}>Enviar feedback</Text>
      </Pressable>

      <Button
        title="Cerrar sesión"
        variant="outline"
        onPress={() => setShowSignOutModal(true)}
        style={styles.signOutBtn}
        textStyle={styles.signOutLabel}
      />

      <Button
        title="Eliminar cuenta"
        variant="danger"
        onPress={() => setShowDeleteModal(true)}
        style={styles.deleteAccountBtn}
      />

      <SignOutModal
        visible={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        loading={signingOut}
        onConfirm={onSignOut}
      />

      <FeedbackModal visible={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />

      <DeleteAccountModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        loading={deletingAccount}
        onConfirm={onDeleteAccount}
      />
    </ScrollView>
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
  busy = false,
  isLast = false,
}: {
  label: string
  value: boolean
  onValueChange: (next: boolean) => void
  disabled?: boolean
  busy?: boolean
  isLast?: boolean
}) {
  return (
    <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityState={{ disabled, busy }}
        trackColor={{ true: Colors.primary, false: Colors.switchTrackOff }}
        thumbColor={Colors.white}
        ios_backgroundColor={Colors.switchTrackOff}
      />
    </View>
  )
}

function ReminderChip({
  label,
  selected,
  onPress,
  disabled = false,
  busy = false,
}: {
  label: string
  selected: boolean
  onPress: () => void
  disabled?: boolean
  busy?: boolean
}) {
  return (
    <Pressable
      style={[
        styles.reminderChip,
        selected && styles.reminderChipOn,
        disabled && styles.reminderChipDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled, busy }}>
      <Text style={[styles.reminderChipText, selected && styles.reminderChipTextOn]}>{label}</Text>
    </Pressable>
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
    paddingTop: 0,
    backgroundColor: Colors.background,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.background,
    gap: 16,
  },
  errorText: {
    fontSize: 15,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.border,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 36,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  displayName: {
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginTop: 4,
  },
  city: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 6,
  },
  cardSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
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
    borderBottomColor: Colors.border,
  },
  infoRowLast: {
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 15,
    color: Colors.textPrimary,
    flex: 1,
    paddingRight: 12,
  },
  reminderRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  reminderChips: {
    flexDirection: 'row',
    gap: 8,
  },
  reminderChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  reminderChipOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.wonBackground,
  },
  reminderChipDisabled: {
    opacity: 0.5,
  },
  reminderChipText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
  },
  reminderChipTextOn: {
    color: Colors.primary,
  },
  infoValue: {
    fontSize: 15,
    color: Colors.textSecondary,
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
    borderBottomColor: Colors.border,
  },
  linkRowLast: {
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  linkRowPressed: { opacity: 0.7 },
  linkLabel: {
    fontSize: 15,
    color: Colors.primary,
    fontFamily: Fonts.medium,
  },
  linkChevron: {
    fontSize: 22,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  adminButton: {
    backgroundColor: Colors.admin,
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },
  editButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },
  signOutBtn: {
    borderColor: Colors.danger,
  },
  signOutLabel: {
    color: Colors.danger,
  },
  deleteAccountBtn: {
    marginTop: -4,
  },
})
