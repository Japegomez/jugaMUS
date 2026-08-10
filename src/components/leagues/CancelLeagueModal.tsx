import { useState } from 'react'
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { ScrollableModalBody } from '@/components/ui/ScrollableModalBody'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export interface CancelLeagueModalProps {
  visible: boolean
  onClose: () => void
  hasFixturesOrInProgress: boolean
  loading: boolean
  onConfirm: () => Promise<void>
}

export function CancelLeagueModal({
  visible,
  onClose,
  hasFixturesOrInProgress,
  loading,
  onConfirm,
}: CancelLeagueModalProps) {
  const [error, setError] = useState<string | null>(null)

  const message = hasFixturesOrInProgress
    ? 'Se cancelará la liga y todas las partidas pendientes. Esta acción no se puede deshacer.'
    : '¿Seguro que quieres cancelar esta liga? Esta acción no se puede deshacer.'

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
          <Text style={s.title}>Cancelar liga</Text>
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
            title="Cancelar liga"
            variant="danger"
            loading={loading}
            onPress={() => void handleConfirm()}
          />
          <Button title="Volver" variant="secondary" onPress={onClose} disabled={loading} />
        </ScrollableModalBody>
      </SafeAreaView>
    </Modal>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.textPrimary },
  close: { fontSize: 20, color: Colors.textSecondary, padding: 4 },
  message: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 16 },
  error: { color: Colors.danger, marginBottom: 12 },
})
