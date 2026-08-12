import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MatchHistoryList } from '@/components/profile/MatchHistoryList'
import { AvatarCircle } from '@/components/profile/AvatarCircle'
import { SendFriendRequestModal } from '@/components/profile/SendFriendRequestModal'
import { ProfileStatsCard } from '@/components/stats/ProfileStatsCard'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/hooks/useAuth'
import {
  useCancelFriendRequest,
  useFriendshipWithUser,
  useRespondFriendRequest,
} from '@/hooks/useFriends'
import { useViewableUserMatches } from '@/hooks/useMatches'
import { useViewableUserProfile } from '@/hooks/useProfile'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'
import { openCreateContactForm } from '@/utils/contacts'
import { formatPhone } from '@/utils/formatters'
import { buildMatchDetailHref } from '@/utils/navigation'

function PhoneUnderName({ displayName, phoneE164 }: { displayName: string; phoneE164: string }) {
  const [busy, setBusy] = useState(false)

  const handlePress = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await openCreateContactForm({ displayName, phoneE164 })
      if (result === 'unsupported') {
        Alert.alert('Número copiado', 'El teléfono se ha copiado al portapapeles.')
      } else if (result === 'error') {
        Alert.alert('Error', 'No se pudo abrir la ficha de contacto.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Pressable
      onPress={() => void handlePress()}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`Crear contacto con ${displayName}`}
      style={({ pressed }) => [styles.phoneUnderNameRow, pressed && styles.phoneRowPressed]}>
      <Text style={styles.phoneUnderNameText}>{formatPhone(phoneE164)}</Text>
      <Ionicons name="person-add-outline" size={14} color={Colors.primary} />
    </Pressable>
  )
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  const { data: profile, isPending, isError } = useViewableUserProfile(userId)
  const { data: matches, isPending: matchesPending } = useViewableUserMatches(userId)
  const { data: friendship, isPending: friendshipPending } = useFriendshipWithUser(userId)
  const respond = useRespondFriendRequest()
  const cancel = useCancelFriendRequest()
  const [sendModalOpen, setSendModalOpen] = useState(false)

  useEffect(() => {
    if (userId && sessionUserId && userId === sessionUserId) {
      router.replace('/(tabs)/profile' as Href)
    }
  }, [userId, sessionUserId, router])

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace('/(tabs)/matches' as Href)
  }, [router])

  if (!userId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Perfil no válido.</Text>
        <Button title="Volver" onPress={goBack} style={styles.backBtn} />
      </View>
    )
  }

  if (userId === sessionUserId) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  if (isPending && !profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  if (isError || !profile) {
    return (
      <View style={[styles.centered, { paddingTop: screenTopPadding(insets.top, 8) }]}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={styles.closeWrap}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.errorText}>No se pudo cargar el perfil o no tienes acceso.</Text>
        <Button title="Volver" onPress={goBack} style={styles.backBtn} />
      </View>
    )
  }

  const phone = profile.phone_e164?.trim() ?? ''

  const friendshipStatus = friendship?.status ?? null
  const friendshipDirection = friendship?.direction ?? null

  return (
    <View style={[styles.root, { paddingTop: screenTopPadding(insets.top, 8) }]}>
      <View style={styles.topBar}>
        <FriendActionButton
          status={friendshipStatus}
          direction={friendshipDirection}
          pending={friendshipPending}
          busy={respond.isPending || cancel.isPending}
          onSend={() => setSendModalOpen(true)}
          onAccept={() =>
            friendship?.friendship_id
              ? void respond
                  .mutateAsync({ friendshipId: friendship.friendship_id, accept: true })
                  .catch((err) =>
                    Alert.alert('No se pudo aceptar', err instanceof Error ? err.message : 'Error')
                  )
              : undefined
          }
          onReject={() =>
            friendship?.friendship_id
              ? void respond
                  .mutateAsync({ friendshipId: friendship.friendship_id, accept: false })
                  .catch((err) =>
                    Alert.alert('No se pudo rechazar', err instanceof Error ? err.message : 'Error')
                  )
              : undefined
          }
          onCancel={() =>
            friendship?.friendship_id
              ? void cancel
                  .mutateAsync(friendship.friendship_id)
                  .catch((err) =>
                    Alert.alert('No se pudo cancelar', err instanceof Error ? err.message : 'Error')
                  )
              : undefined
          }
        />
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Cerrar">
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AvatarCircle uri={profile.photo_url} name={profile.display_name} />
          <Text style={styles.displayName}>{profile.display_name}</Text>
          {phone ? <PhoneUnderName displayName={profile.display_name} phoneE164={phone} /> : null}
          {profile.city ? <Text style={styles.city}>{profile.city}</Text> : null}
        </View>

        {userId ? (
          <ProfileStatsCard
            userId={userId}
            onPressDetails={() => router.push(`/(tabs)/profile/stats/${userId}` as Href)}
            onPressRanking={() => router.push('/(tabs)/leaderboard' as Href)}
          />
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Historial</Text>
          <MatchHistoryList
            matches={matches}
            loading={matchesPending}
            emptyMessage="Sin partidas visibles en su historial"
            onMatchPress={(matchId) =>
              router.push(buildMatchDetailHref(matchId, { from: 'profile', profileUserId: userId }))
            }
          />
        </View>
      </ScrollView>

      <SendFriendRequestModal
        visible={sendModalOpen}
        addresseeId={userId}
        addresseeName={profile.display_name}
        onClose={() => setSendModalOpen(false)}
      />
    </View>
  )
}

type FriendshipStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | null

function FriendActionButton({
  status,
  direction,
  pending,
  busy,
  onSend,
  onAccept,
  onReject,
  onCancel,
}: {
  status: FriendshipStatus
  direction: 'sent' | 'received' | null
  pending: boolean
  busy: boolean
  onSend: () => void
  onAccept: () => void
  onReject: () => void
  onCancel: () => void
}) {
  if (pending) {
    return (
      <View style={styles.friendBtnPlaceholder}>
        <Ionicons name="person-outline" size={22} color={Colors.textSecondary} />
      </View>
    )
  }
  if (status === 'accepted') {
    return (
      <View style={styles.friendBtn} accessibilityLabel="Sois amigos">
        <Ionicons name="checkmark-circle-outline" size={22} color={Colors.primary} />
      </View>
    )
  }
  if (status === 'pending' && direction === 'received') {
    return (
      <View style={styles.friendBtnRow}>
        <Pressable
          onPress={onAccept}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Aceptar solicitud"
          style={({ pressed }) => [styles.friendBtn, pressed && styles.friendBtnPressed]}>
          <Ionicons name="checkmark-outline" size={22} color={Colors.primary} />
        </Pressable>
        <Pressable
          onPress={onReject}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Rechazar solicitud"
          style={({ pressed }) => [styles.friendBtn, pressed && styles.friendBtnPressed]}>
          <Ionicons name="close-outline" size={22} color={Colors.danger} />
        </Pressable>
      </View>
    )
  }
  if (status === 'pending' && direction === 'sent') {
    return (
      <Pressable
        onPress={onCancel}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Cancelar solicitud enviada"
        style={({ pressed }) => [styles.friendBtn, pressed && styles.friendBtnPressed]}>
        <Ionicons name="hourglass-outline" size={22} color={Colors.textSecondary} />
      </Pressable>
    )
  }
  // No friendship yet (rejected/cancelled/none): send a request.
  return (
    <Pressable
      onPress={onSend}
      accessibilityRole="button"
      accessibilityLabel="Enviar solicitud de amistad"
      style={({ pressed }) => [styles.friendBtn, pressed && styles.friendBtnPressed]}>
      <Ionicons name="person-add-outline" size={22} color={Colors.primary} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  friendBtn: { padding: 8 },
  friendBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  friendBtnPlaceholder: { padding: 8 },
  friendBtnPressed: { opacity: 0.6 },
  closeWrap: { alignSelf: 'flex-end', padding: 8 },
  close: { fontSize: 22, color: Colors.textSecondary, padding: 8 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
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
    textAlign: 'center',
  },
  backBtn: { marginTop: 8 },
  header: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  displayName: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  city: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  phoneUnderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneUnderNameText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
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
  phoneRowPressed: { opacity: 0.7 },
})
