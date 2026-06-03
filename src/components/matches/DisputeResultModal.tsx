import { useState } from 'react'
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native'

import { MatchResultScoreLines } from '@/components/matches/MatchResultScoreLines'
import { Button } from '@/components/ui/Button'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export interface DisputeResultModalProps {
  visible: boolean
  onClose: () => void
  teamAScore: number
  teamBScore: number
  teamAName?: string
  teamBName?: string
  submitterDisplayName: string
  loading: boolean
  onDispute: (comment: string | null) => void
}

export function DisputeResultModal({
  visible,
  onClose,
  teamAScore,
  teamBScore,
  teamAName = 'Equipo A',
  teamBName = 'Equipo B',
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
          <MatchResultScoreLines
            teamAName={teamAName}
            teamBName={teamBName}
            teamAScore={teamAScore}
            teamBScore={teamBScore}
          />
          <Text style={s.submitter}>
            Enviado por <Text style={s.submitterName}>{submitterDisplayName}</Text>
          </Text>
          <Text style={s.label}>Motivo (opcional)</Text>
          <TextInput
            style={s.textarea}
            multiline
            numberOfLines={4}
            placeholder="Describe por qué no estás de acuerdo con el marcador…"
            placeholderTextColor={Colors.textSecondary}
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
  btn: {},
})
