import { useState } from 'react'
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { ScrollableModalBody } from '@/components/ui/ScrollableModalBody'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export interface CancelTournamentModalProps {
  visible: boolean
  onClose: () => void
  /** True when the tournament already has a generated bracket / is in progress. */
  hasBracketOrInProgress: boolean
  loading: boolean
  onConfirm: () => Promise<void>
}

export function CancelTournamentModal({
  visible,
  onClose,
  hasBracketOrInProgress,
  loading,
  onConfirm,
}: CancelTournamentModalProps) {
  const [error, setError] = useState<string | null>(null)

  const message = hasBracketOrInProgress
    ? 'Se cancelará el torneo y todas las partidas del cuadro que aún no hayan terminado. Esta acción no se puede deshacer.'
    : '¿Seguro que quieres cancelar este torneo? Esta acción no se puede deshacer.'

  const handleConfirm = async () => {
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cancelar')
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={() => setError(null)}
      onRequestClose={() => {
        if (!loading) onClose()
      }}>
      <SafeAreaView style={s.wrap}>
        <View style={s.header}>
          <Text style={s.title}>Cancelar torneo</Text>
          <Pressable
            onPress={onClose}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Cerrar">
            <Text style={s.close}>✕</Text>
          </Pressable>
        </View>
        <ScrollableModalBody>
          <Text style={s.message}>{message}</Text>
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Button
            title="Sí, cancelar"
            variant="danger"
            onPress={() => void handleConfirm()}
            loading={loading}
            style={s.btn}
          />
          <Button title="No" variant="outline" onPress={onClose} disabled={loading} style={s.btn} />
        </ScrollableModalBody>
      </SafeAreaView>
    </Modal>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.textPrimary },
  close: { fontSize: 18, color: Colors.textSecondary, padding: 4 },
  message: { fontSize: 15, color: Colors.textPrimary, marginBottom: 16, lineHeight: 22 },
  error: { fontSize: 14, color: Colors.danger, marginBottom: 16 },
  btn: { marginBottom: 12 },
})
