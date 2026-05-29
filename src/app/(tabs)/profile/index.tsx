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
import type { ProfileUpdate } from '@/services/profiles.service'
import type { UserMatchSummary } from '@/services/matches.service'
import { displayMatchTitle, matchHistoryBackground, matchStatusDisplay } from '@/utils/matchDisplay'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'

/** Visible rows in profile history before scrolling for older matches. */
const PROFILE_HISTORY_VISIBLE_ROWS = 5
/** Approximate row height (padding + title + meta + separator). */
const PROFILE_HISTORY_ROW_HEIGHT = 58

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
          <ActivityIndicator size="small" color={Colors.primary} style={styles.matchesLoader} />
        ) : !userMatches || userMatches.length === 0 ? (
          <Text style={styles.matchesEmpty}>Aún no has participado en ninguna partida</Text>
        ) : (
          <View style={styles.matchHistoryList}>
            <ScrollView
              style={styles.matchHistoryScroll}
              contentContainerStyle={styles.matchHistoryScrollContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator={userMatches.length > PROFILE_HISTORY_VISIBLE_ROWS}>
              {userMatches.map((m, index) => (
                <MatchHistoryRow
                  key={m.id}
                  match={m}
                  isLast={index === userMatches.length - 1}
                  onPress={() => router.push(`/(tabs)/matches/${m.id}`)}
                />
              ))}
            </ScrollView>
          </View>
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

function MatchHistoryRow({
  match,
  isLast,
  onPress,
}: {
  match: UserMatchSummary
  isLast: boolean
  onPress: () => void
}) {
  const status = matchStatusDisplay(match)
  const outcomeBg = matchHistoryBackground(match.outcome ?? null)
  const dateStr = new Date(match.start_at).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const outcomeHint =
    match.outcome === 'won' ? ', victoria' : match.outcome === 'lost' ? ', derrota' : ''

  return (
    <Pressable
      style={({ pressed }) => [
        styles.matchRow,
        isLast && styles.matchRowLast,
        outcomeBg != null && { backgroundColor: outcomeBg },
        pressed && styles.matchRowPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${displayMatchTitle(match)}${outcomeHint}`}>
      <View style={styles.matchRowMain}>
        <Text style={styles.matchTitle} numberOfLines={1}>
          {displayMatchTitle(match)}
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
        trackColor={{ true: Colors.primary, false: Colors.switchTrackOff }}
        thumbColor={Colors.white}
        ios_backgroundColor={Colors.switchTrackOff}
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
    fontSize: 22,
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
  matchesLoader: { marginVertical: 12 },
  matchesEmpty: {
    fontSize: 14,
    color: Colors.textSecondary,
    paddingVertical: 12,
    textAlign: 'center',
  },
  matchHistoryList: {
    marginHorizontal: -16,
    marginBottom: -4,
    overflow: 'hidden',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  matchHistoryScroll: {
    maxHeight: PROFILE_HISTORY_VISIBLE_ROWS * PROFILE_HISTORY_ROW_HEIGHT,
  },
  matchHistoryScrollContent: {
    flexGrow: 1,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  matchRowLast: {
    borderBottomWidth: 0,
  },
  matchRowPressed: { opacity: 0.7 },
  matchRowMain: { flex: 1 },
  matchTitle: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  matchMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  matchBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  matchBadgeText: { fontSize: 11, fontFamily: Fonts.semiBold },
})
