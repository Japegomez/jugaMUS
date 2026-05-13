import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'

export interface ApproveResultModalProps {
  visible: boolean
  onClose: () => void
  teamAScore: number
  teamBScore: number
  submitterDisplayName: string
  loading: boolean
  onConfirm: () => void
}

export function ApproveResultModal({
  visible,
  onClose,
  teamAScore,
  teamBScore,
  submitterDisplayName,
  loading,
  onConfirm,
}: ApproveResultModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!loading) onClose()
      }}>
      <SafeAreaView style={s.wrap}>
        <View style={s.header}>
          <Text style={s.title}>Aprobar resultado</Text>
          <Pressable
            onPress={onClose}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Cerrar">
            <Text style={s.close}>✕</Text>
          </Pressable>
        </View>
        <View style={s.body}>
          <Text style={s.score}>
            Equipo A: {teamAScore} — Equipo B: {teamBScore}
          </Text>
          <Text style={s.submitter}>
            Enviado por <Text style={s.submitterName}>{submitterDisplayName}</Text>
          </Text>
          <Text style={s.question}>¿Confirmas que este marcador es correcto?</Text>
          <Button title="Sí, aprobar" onPress={onConfirm} loading={loading} style={s.btn} />
          <Button
            title="Cancelar"
            variant="outline"
            onPress={onClose}
            disabled={loading}
            style={s.btn}
          />
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
  score: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  submitter: { fontSize: 15, color: '#555', marginBottom: 16 },
  submitterName: { fontWeight: '700', color: '#1a1a1a' },
  question: { fontSize: 15, color: '#333', marginBottom: 24 },
  btn: { marginBottom: 12 },
})
