import { useState } from 'react'
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'

export interface LeaveMatchModalProps {
  visible: boolean
  onClose: () => void
  loading: boolean
  onConfirm: () => Promise<void>
}

export function LeaveMatchModal({ visible, onClose, loading, onConfirm }: LeaveMatchModalProps) {
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abandonar la partida')
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
          <Text style={s.title}>Abandonar partida</Text>
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
            ¿Seguro que quieres abandonar esta partida? Dejarás de aparecer en la plantilla y podrás
            volver a unirte si quedan plazas libres.
          </Text>
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Button
            title="Sí, abandonar"
            variant="danger"
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
  wrap: { flex: 1, backgroundColor: '#f6f7f4' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  close: { fontSize: 18, color: '#555', padding: 4 },
  body: { padding: 20 },
  message: { fontSize: 15, color: '#333', marginBottom: 16, lineHeight: 22 },
  error: { fontSize: 14, color: '#b00020', marginBottom: 16 },
  btn: { marginBottom: 12 },
})
