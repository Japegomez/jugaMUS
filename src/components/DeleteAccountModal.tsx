import { useState } from 'react'
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ScrollableModalBody } from '@/components/ui/ScrollableModalBody'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

const CONFIRM_WORD = 'ELIMINAR'

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
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const canConfirm = confirmText === CONFIRM_WORD

  const resetForm = () => {
    setConfirmText('')
    setError(null)
  }

  const handleClose = () => {
    if (loading) return
    resetForm()
    onClose()
  }

  const handleConfirm = async () => {
    if (!canConfirm) {
      setError(`Escribe ${CONFIRM_WORD} para confirmar`)
      return
    }
    setError(null)
    try {
      await onConfirm()
      resetForm()
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
      onShow={resetForm}
      onRequestClose={handleClose}>
      <SafeAreaView style={s.wrap}>
        <View style={s.header}>
          <Text style={s.title}>Eliminar cuenta</Text>
          <Pressable
            onPress={handleClose}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Cerrar">
            <Text style={s.close}>✕</Text>
          </Pressable>
        </View>
        <ScrollableModalBody>
          <Text style={s.warning}>
            Esta acción es irreversible. Se eliminarán tu perfil, historial de partidas y todos los
            datos asociados a tu cuenta.
          </Text>
          <Text style={s.message}>
            Si continúas, perderás el acceso de forma permanente y no podrás recuperar tu cuenta.
          </Text>
          <Input
            label={`Escribe ${CONFIRM_WORD} para confirmar`}
            value={confirmText}
            onChangeText={(text) => {
              setConfirmText(text)
              if (error) setError(null)
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
            placeholder={CONFIRM_WORD}
            accessibilityLabel={`Escribe ${CONFIRM_WORD} para confirmar`}
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Button
            title="Sí, eliminar mi cuenta"
            variant="danger"
            onPress={() => void handleConfirm()}
            loading={loading}
            disabled={!canConfirm || loading}
            style={s.btn}
          />
          <Button
            title="Cancelar"
            variant="outline"
            onPress={handleClose}
            disabled={loading}
            style={s.btn}
          />
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
  title: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.danger },
  close: { fontSize: 18, color: Colors.textSecondary, padding: 4 },
  warning: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.danger,
    marginBottom: 12,
    lineHeight: 22,
  },
  message: { fontSize: 15, color: Colors.textPrimary, marginBottom: 16, lineHeight: 22 },
  error: { fontSize: 14, color: Colors.danger, marginBottom: 16, marginTop: 4 },
  btn: { marginBottom: 12, marginTop: 8 },
})
