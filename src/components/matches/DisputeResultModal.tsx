import { useState } from 'react'
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native'

import { Button } from '@/components/ui/Button'

export interface DisputeResultModalProps {
  visible: boolean
  onClose: () => void
  teamAScore: number
  teamBScore: number
  submitterDisplayName: string
  loading: boolean
  onDispute: (comment: string | null) => void
}

export function DisputeResultModal({
  visible,
  onClose,
  teamAScore,
  teamBScore,
  submitterDisplayName,
  loading,
  onDispute,
}: DisputeResultModalProps) {
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
          <Text style={s.title}>Disputar resultado</Text>
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
          <Text style={s.label}>Motivo (opcional)</Text>
          <TextInput
            style={s.textarea}
            multiline
            numberOfLines={4}
            placeholder="Describe por qué no estás de acuerdo con el marcador…"
            placeholderTextColor="#888"
            value={comment}
            onChangeText={setComment}
            editable={!loading}
          />
          <Button
            title="Enviar disputa"
            variant="danger"
            onPress={() => onDispute(comment.trim() === '' ? null : comment.trim())}
            loading={loading}
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
  submitter: { fontSize: 15, color: '#555', marginBottom: 20 },
  submitterName: { fontWeight: '700', color: '#1a1a1a' },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  textarea: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
    marginBottom: 20,
    color: '#1a1a1a',
  },
  btn: {},
})
