import { useState } from 'react'
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { ScrollableModalBody } from '@/components/ui/ScrollableModalBody'
import {
  displayLeaguePairName,
  type LeaguePairRow,
} from '@/services/leagues.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

type ChallengeModalProps = {
  visible: boolean
  onClose: () => void
  opponents: LeaguePairRow[]
  loading?: boolean
  onChallenge: (pairId: string) => Promise<void>
}

export function ChallengeModal({
  visible,
  onClose,
  opponents,
  loading,
  onChallenge,
}: ChallengeModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!selectedId) {
      setError('Selecciona una pareja')
      return
    }
    setError(null)
    try {
      await onChallenge(selectedId)
      setSelectedId(null)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el desafío')
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={() => {
        setError(null)
        setSelectedId(null)
      }}
      onRequestClose={onClose}>
      <SafeAreaView style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>Desafiar pareja</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar">
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
        <ScrollableModalBody>
          <Text style={styles.hint}>Elige la pareja a la que quieres desafiar.</Text>
          {opponents.length === 0 ? (
            <Text style={styles.empty}>No hay otras parejas disponibles</Text>
          ) : (
            opponents.map((pair) => {
              const selected = selectedId === pair.id
              return (
                <Pressable
                  key={pair.id}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => setSelectedId(pair.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}>
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {displayLeaguePairName(pair)}
                  </Text>
                  <Text style={styles.elo}>Elo {pair.current_elo}</Text>
                </Pressable>
              )
            })
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title="Enviar desafío"
            onPress={() => void handleSubmit()}
            loading={loading}
            disabled={!selectedId}
          />
        </ScrollableModalBody>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.textPrimary },
  close: { fontSize: 20, color: Colors.textSecondary, padding: 4 },
  hint: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  empty: { color: Colors.textSecondary, fontStyle: 'italic', marginBottom: 12 },
  option: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: Colors.surface,
  },
  optionSelected: { borderColor: Colors.primary, backgroundColor: Colors.surface },
  optionText: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  optionTextSelected: { color: Colors.primary },
  elo: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  error: { color: Colors.danger, marginBottom: 8 },
})
