import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { TurnstileWidget } from '@/components/auth/TurnstileWidget'
import { Button } from '@/components/ui/Button'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export interface TurnstileChallengeModalProps {
  visible: boolean
  resetNonce: number
  onSuccess: (token: string) => void
  onCancel: () => void
}

export function TurnstileChallengeModal({
  visible,
  resetNonce,
  onSuccess,
  onCancel,
}: TurnstileChallengeModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {visible ? (
        <ChallengeBody key={resetNonce} onSuccess={onSuccess} onCancel={onCancel} />
      ) : null}
    </Modal>
  )
}

function ChallengeBody({
  onSuccess,
  onCancel,
}: {
  onSuccess: (token: string) => void
  onCancel: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [retryNonce, setRetryNonce] = useState(0)

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Cerrar" />
      <View style={styles.card} accessibilityViewIsModal>
        <Text style={styles.title}>Verificación de seguridad</Text>
        <Text style={styles.sub}>Confirma que no eres un robot para continuar.</Text>
        {!error ? (
          <TurnstileWidget
            resetNonce={retryNonce}
            onTokenChange={(token) => {
              if (!token) return
              setError(null)
              onSuccess(token)
            }}
            onError={(message) => setError(message)}
          />
        ) : null}
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {error ? (
          <Button
            title="Reintentar"
            onPress={() => {
              setError(null)
              setRetryNonce((n) => n + 1)
            }}
            style={styles.btn}
          />
        ) : null}
        <Button title="Cancelar" variant="outline" onPress={onCancel} style={styles.btn} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 17, 17, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    zIndex: 1,
    elevation: 4,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 17,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.danger,
    marginBottom: 12,
  },
  btn: { marginTop: 4 },
})
