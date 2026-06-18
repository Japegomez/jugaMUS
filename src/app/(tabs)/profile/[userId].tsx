import { useEffect } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MatchHistoryList } from '@/components/profile/MatchHistoryList'
import { AvatarCircle } from '@/components/profile/AvatarCircle'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/hooks/useAuth'
import { useViewableUserMatches } from '@/hooks/useMatches'
import { useViewableUserProfile } from '@/hooks/useProfile'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  const { data: profile, isPending, isError } = useViewableUserProfile(userId)
  const { data: matches, isPending: matchesPending } = useViewableUserMatches(userId)

  useEffect(() => {
    if (userId && sessionUserId && userId === sessionUserId) {
      router.replace('/(tabs)/profile' as Href)
    }
  }, [userId, sessionUserId, router])

  if (!userId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Perfil no válido.</Text>
        <Button title="Volver" onPress={() => router.back()} style={styles.backBtn} />
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
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={styles.closeWrap}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.errorText}>No se pudo cargar el perfil o no tienes acceso.</Text>
        <Button title="Volver" onPress={() => router.back()} style={styles.backBtn} />
      </View>
    )
  }

  const phoneLabel = profile.phone_e164?.trim() || 'No disponible'

  return (
    <View style={[styles.root, { paddingTop: screenTopPadding(insets.top, 8) }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Cerrar">
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
          {profile.city ? <Text style={styles.city}>{profile.city}</Text> : null}
        </View>

        <View style={styles.card}>
          <InfoRow label="Teléfono" value={phoneLabel} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Historial</Text>
          <MatchHistoryList
            matches={matches}
            loading={matchesPending}
            emptyMessage="Sin partidas visibles en su historial"
            onMatchPress={(matchId) => router.push(`/(tabs)/matches/${matchId}` as Href)}
          />
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16 },
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
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
})
