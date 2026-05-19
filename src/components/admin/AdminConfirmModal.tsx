import { useState } from 'react'
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'

export interface AdminConfirmModalProps {
  visible: boolean
  title: string
  message: string
  confirmLabel: string
  confirmVariant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function AdminConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  confirmVariant = 'primary',
  loading = false,
  onClose,
  onConfirm,
}: AdminConfirmModalProps) {
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción')
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
      <SafeAreaView style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable
            onPress={onClose}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Cerrar">
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
        <View style={styles.body}>
          <Text style={styles.message}>{message}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={confirmLabel}
            variant={confirmVariant}
            onPress={() => void handleConfirm()}
            loading={loading}
            style={styles.btn}
          />
          <Button
            title="Cancelar"
            variant="outline"
            onPress={onClose}
            disabled={loading}
            style={styles.btn}
          />
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f6f7f4' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', flex: 1, paddingRight: 12 },
  close: { fontSize: 22, color: '#666', padding: 4 },
  body: { padding: 20, gap: 12 },
  message: { fontSize: 15, color: '#444', lineHeight: 22 },
  error: { fontSize: 14, color: '#b42318' },
  btn: { marginTop: 4 },
})
