import { Modal, Pressable, StyleSheet, Text } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export interface AppUpdatePromptProps {
  visible: boolean
  title?: string
  message?: string
  onUpdate: () => void
  onDismiss: () => void
}

const DEFAULT_TITLE = '¡Nueva versión disponible!'
const DEFAULT_MESSAGE =
  'Hemos añadido nuevas funciones y corregido errores. Actualiza para disfrutar de la mejor experiencia.'

export function AppUpdatePrompt({
  visible,
  title,
  message,
  onUpdate,
  onDismiss,
}: AppUpdatePromptProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      accessibilityViewIsModal>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="button">
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title ?? DEFAULT_TITLE}</Text>
          <Text style={styles.message}>{message ?? DEFAULT_MESSAGE}</Text>
          <Button title="Actualizar ahora" onPress={onUpdate} style={styles.btn} />
          <Button
            title="Recordar más tarde"
            variant="outline"
            onPress={onDismiss}
            style={styles.btn}
          />
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
