import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export interface ApproveResultModalProps {
  visible: boolean
  onClose: () => void
  teamAScore: number
  teamBScore: number
  teamAName?: string
  teamBName?: string
  submitterDisplayName: string
  loading: boolean
  onConfirm: () => void
}

export function ApproveResultModal({
  visible,
  onClose,
  teamAScore,
  teamBScore,
  teamAName = 'Equipo A',
  teamBName = 'Equipo B',
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
            {teamAName}: {teamAScore} — {teamBName}: {teamBScore}
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
  score: { fontSize: 20, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 8 },
  submitter: { fontSize: 15, color: Colors.textSecondary, marginBottom: 16 },
  submitterName: { fontFamily: Fonts.bold, color: Colors.textPrimary },
  question: { fontSize: 15, color: Colors.textPrimary, marginBottom: 24 },
  btn: { marginBottom: 12 },
})
