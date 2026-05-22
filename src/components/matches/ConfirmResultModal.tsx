import { useState } from 'react'
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export interface ConfirmResultModalProps {
  visible: boolean
  onClose: () => void
  teamAScore: number
  teamBScore: number
  submitterDisplayName: string
  loading: boolean
  onApprove: () => void
  onDispute: (comment: string | null) => void
}

export function ConfirmResultModal({
  visible,
  onClose,
  teamAScore,
  teamBScore,
  submitterDisplayName,
  loading,
  onApprove,
  onDispute,
}: ConfirmResultModalProps) {
  const [comment, setComment] = useState('')

  const close = () => {
    setComment('')
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}>
      <SafeAreaView style={s.wrap}>
        <View style={s.header}>
          <Text style={s.title}>Validar resultado</Text>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Cerrar">
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
          <Text style={s.label}>Comentario si disputas (opcional)</Text>
          <TextInput
            style={s.textarea}
            multiline
            numberOfLines={4}
            placeholder="Describe el motivo de la disputa…"
            placeholderTextColor={Colors.textSecondary}
            value={comment}
            onChangeText={setComment}
            editable={!loading}
          />
          <View style={s.actions}>
            <Button title="Aprobar" onPress={onApprove} loading={loading} style={s.btn} />
            <Button
              title="Disputar"
              variant="danger"
              onPress={() => onDispute(comment.trim() === '' ? null : comment.trim())}
              loading={loading}
              style={s.btn}
            />
          </View>
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
  submitter: { fontSize: 15, color: Colors.textSecondary, marginBottom: 20 },
  submitterName: { fontFamily: Fonts.bold, color: Colors.textPrimary },
  label: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.textPrimary, marginBottom: 8 },
  textarea: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: Colors.surface,
    textAlignVertical: 'top',
    marginBottom: 20,
    color: Colors.textPrimary,
  },
  actions: { gap: 12 },
  btn: {},
})
