import { Alert, StyleSheet, Text, View } from 'react-native'

import { BadgeShowcase } from '@/components/stats/BadgeShowcase'
import { useAuthStore } from '@/hooks/useAuth'
import { useProfile, useUpdateProfile, useViewableUserProfile } from '@/hooks/useProfile'
import { usePlayerStats } from '@/hooks/useStats'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

/** Featured badges block meant to sit under the podium inside ProfileStatsCard. */
export function BadgeShowcaseSection({ userId }: { userId: string }) {
  const sessionUserId = useAuthStore((s) => s.session?.user.id)
  const isOwn = sessionUserId === userId

  const { data: ownProfile } = useProfile(isOwn ? sessionUserId : undefined)
  const { data: viewableProfile } = useViewableUserProfile(isOwn ? undefined : userId)
  const { data: stats } = usePlayerStats(userId)
  const updateProfile = useUpdateProfile()

  const profile = isOwn ? ownProfile : viewableProfile
  if (!profile || !stats) return null

  const badges = stats.badges ?? []
  const showcase = profile.badge_showcase ?? []

  // Own profile always shows empty slots; others only if they pinned badges
  if (!isOwn && showcase.filter((k) => badges.some((b) => b.key === k)).length === 0) {
    return null
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Logros destacados</Text>
      <BadgeShowcase
        showcase={showcase}
        earnedBadges={badges}
        canEdit={isOwn}
        saving={updateProfile.isPending}
        onChange={async (next) => {
          try {
            await updateProfile.mutateAsync({ badge_showcase: next })
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar el logro')
            throw err
          }
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  title: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
})
