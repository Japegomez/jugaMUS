import { Modal, Pressable, StyleSheet, Text } from 'react-native'

import { APP_DISPLAY_NAME } from '@/constants/app'
import { Button } from '@/components/ui/Button'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export interface AppRatingPromptProps {
  visible: boolean
  onRate: () => void
  onDismiss: () => void
}

export function AppRatingPrompt({ visible, onRate, onDismiss }: AppRatingPromptProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      accessibilityViewIsModal>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="button">
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>¿Te gusta {APP_DISPLAY_NAME}?</Text>
          <Text style={styles.message}>
            Tu valoración en la tienda nos ayuda mucho a seguir mejorando la app.
          </Text>
          <Button title="Valorar en la tienda" onPress={onRate} style={styles.btn} />
          <Button title="Ahora no" variant="outline" onPress={onDismiss} style={styles.btn} />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  btn: { marginBottom: 10 },
})
