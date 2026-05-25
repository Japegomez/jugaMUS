import { useState } from 'react'
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export interface DeleteAccountModalProps {
  visible: boolean
  onClose: () => void
  loading: boolean
  onConfirm: () => Promise<void>
}

export function DeleteAccountModal({
  visible,
  onClose,
  loading,
  onConfirm,
}: DeleteAccountModalProps) {
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la cuenta')
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
          <Text style={s.title}>Eliminar cuenta</Text>
          <Pressable
            onPress={onClose}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Cerrar">
            <Text style={s.close}>✕</Text>
          </Pressable>
        </View>
        <View style={s.body}>
          <Text style={s.warning}>
            Esta acción es irreversible. Se eliminarán tu perfil, historial de partidas y todos los
            datos asociados a tu cuenta.
          </Text>
          <Text style={s.message}>
            Si continúas, perderás el acceso de forma permanente y no podrás recuperar tu cuenta.
          </Text>
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Button
            title="Sí, eliminar mi cuenta"
            variant="danger"
            onPress={() => void handleConfirm()}
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
  title: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.danger },
  close: { fontSize: 18, color: Colors.textSecondary, padding: 4 },
  body: { padding: 20 },
  warning: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.danger,
    marginBottom: 12,
    lineHeight: 22,
  },
  message: { fontSize: 15, color: Colors.textPrimary, marginBottom: 16, lineHeight: 22 },
  error: { fontSize: 14, color: Colors.danger, marginBottom: 16 },
  btn: { marginBottom: 12 },
})
