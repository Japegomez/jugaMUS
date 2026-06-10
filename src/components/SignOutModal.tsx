import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export interface SignOutModalProps {
  visible: boolean
  onClose: () => void
  loading: boolean
  onConfirm: () => void | Promise<void>
}

export function SignOutModal({ visible, onClose, loading, onConfirm }: SignOutModalProps) {
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
          <Text style={s.title}>Cerrar sesión</Text>
          <Pressable
            onPress={onClose}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Cerrar">
            <Text style={s.close}>✕</Text>
          </Pressable>
        </View>
        <View style={s.body}>
          <Text style={s.message}>¿Seguro que quieres cerrar sesión?</Text>
          <Button
            title="Confirmar"
            variant="danger"
            onPress={() => void onConfirm()}
            loading={loading}
            style={s.btn}
          />
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
  message: { fontSize: 15, color: Colors.textPrimary, marginBottom: 20, lineHeight: 22 },
  btn: { marginBottom: 12 },
})
