import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { TEAM } from '@/constants'
import type { TeamId } from '@/hooks/useLiveScoreboard'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

type OrdagoModalProps = {
  visible: boolean
  teamAName: string
  teamBName: string
  onClose: () => void
  onSelectWinner: (team: TeamId) => void
}

function WinnerOption({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <Pressable
      style={s.option}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ganador del órdago: ${name}`}>
      <Text style={s.optionText}>{name}</Text>
    </Pressable>
  )
}

export function OrdagoModal({
  visible,
  teamAName,
  teamBName,
  onClose,
  onSelectWinner,
}: OrdagoModalProps) {
  const handleSelect = (team: TeamId) => {
    onSelectWinner(team)
    onClose()
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <SafeAreaView style={s.safe}>
          <View style={s.card}>
            <View style={s.header}>
              <Text style={s.title}>Órdago</Text>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar">
                <Text style={s.close}>✕</Text>
              </Pressable>
            </View>

            <Text style={s.message}>¿Quién ha ganado el órdago?</Text>
            <Text style={s.hint}>El ganador suma 1 juego y se reinician los envites de fase.</Text>

            <WinnerOption name={teamAName} onPress={() => handleSelect(TEAM.A)} />
            <WinnerOption name={teamBName} onPress={() => handleSelect(TEAM.B)} />

            <Pressable style={s.cancelBtn} onPress={onClose} accessibilityRole="button">
              <Text style={s.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  safe: { flex: 1, justifyContent: 'center' },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontFamily: Fonts.bold, color: Colors.textPrimary },
  close: { fontSize: 18, color: Colors.textSecondary, padding: 4 },
  message: {
    fontSize: 17,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  option: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 10,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: Colors.white,
    textAlign: 'center',
  },
  cancelBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  cancelText: { fontSize: 15, color: Colors.textSecondary, fontFamily: Fonts.medium },
})
