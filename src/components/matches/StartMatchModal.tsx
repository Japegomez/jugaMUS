import { useState } from 'react'
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export interface StartMatchModalProps {
  visible: boolean
  onClose: () => void
  loading: boolean
  onConfirm: () => Promise<void>
}

export function StartMatchModal({ visible, onClose, loading, onConfirm }: StartMatchModalProps) {
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo empezar la partida')
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
          <Text style={s.title}>Empezar partida</Text>
          <Pressable
            onPress={onClose}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Cerrar">
            <Text style={s.close}>✕</Text>
          </Pressable>
        </View>
        <View style={s.body}>
          <Text style={s.message}>
            ¿Empezar la partida ahora? Se fijará la hora de inicio al momento actual y la partida
            pasará a estar en curso. No podrás volver al estado planificada; solo cancelarla si
            necesitas anularla.
          </Text>
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Button
            title="Sí, empezar"
            onPress={() => void handleConfirm()}
            loading={loading}
            style={s.btn}
          />
          <Button title="No" variant="outline" onPress={onClose} disabled={loading} style={s.btn} />
        </View>
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
  body: { padding: 20 },
  message: { fontSize: 15, color: Colors.textPrimary, marginBottom: 16, lineHeight: 22 },
  error: { fontSize: 14, color: Colors.danger, marginBottom: 16 },
  btn: { marginBottom: 12 },
})
