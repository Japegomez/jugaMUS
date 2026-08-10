import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import ConfettiCannon from 'react-native-confetti-cannon'

import { BADGE_LABELS } from '@/services/stats.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export type BadgeUnlockInfo = {
  key: string
  emoji: string
}

export function BadgeUnlockPopup({
  badge,
  onClose,
}: {
  badge: BadgeUnlockInfo | null
  onClose: () => void
}) {
  if (!badge) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.confettiWrap} pointerEvents="none">
          <ConfettiCannon
            count={180}
            origin={{ x: 0, y: 0 }}
            explosionSpeed={350}
            fallSpeed={2600}
            fadeOut
            autoStart
            colors={[Colors.primary, '#FFD700', '#FF8A65', '#7E57C2', '#4FC3F7']}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.emojiWrap}>
            <Text style={styles.emoji}>{badge.emoji}</Text>
          </View>
          <Text style={styles.title}>¡Nuevo logro!</Text>
          <Text style={styles.badgeName}>{BADGE_LABELS[badge.key] ?? badge.key}</Text>
          <Text style={styles.subtitle}>
            Ya puedes mostrarlo en tu perfil desde la sección de logros.
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
            <Text style={styles.btnText}>Genial</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confettiWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emojiWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.wonBackground,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emoji: {
    fontSize: 44,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: Colors.primary,
  },
  badgeName: {
    fontFamily: Fonts.bold,
    fontSize: 17,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    marginTop: 8,
    minWidth: 140,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.white,
  },
})
