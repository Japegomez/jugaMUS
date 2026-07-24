import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Button } from '@/components/ui/Button'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export const INCOMPLETE_ROSTER_START_MESSAGE =
  'Faltan jugadores para empezar la partida. Invita a tus amigos o añade sus nombres manualmente con el botón «Editar partida». No podrás empezar hasta que todos los puestos estén cubiertos.'

export interface IncompleteRosterStartModalProps {
  visible: boolean
  onClose: () => void
}

export function IncompleteRosterStartModal({ visible, onClose }: IncompleteRosterStartModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={s.wrap}>
        <View style={s.header}>
          <Text style={s.title}>Plantilla incompleta</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar">
            <Text style={s.close}>✕</Text>
          </Pressable>
        </View>
        <View style={s.body}>
          <Text style={s.message}>{INCOMPLETE_ROSTER_START_MESSAGE}</Text>
          <Button title="Entendido" onPress={onClose} style={s.btn} />
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
  btn: { marginBottom: 12 },
})
