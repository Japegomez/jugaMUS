import { useState } from 'react'
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { TournamentPairRow } from '@/services/tournaments.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export type EditPairFormValues = {
  name: string
  playerAText: string
  playerBText: string
}

type EditPairModalProps = {
  visible: boolean
  pair: TournamentPairRow | null
  onClose: () => void
  onSubmit: (values: EditPairFormValues) => void | Promise<void>
  onDelete: () => void | Promise<void>
  saveLoading?: boolean
  deleteLoading?: boolean
}

function initialForm(pair: TournamentPairRow): EditPairFormValues {
  return {
    name: pair.name_is_custom ? (pair.name?.trim() ?? '') : '',
    playerAText: pair.player_a_text?.trim() ?? '',
    playerBText: pair.player_b_text?.trim() ?? '',
  }
}

type EditPairFormProps = {
  pair: TournamentPairRow
  onClose: () => void
  onSubmit: (values: EditPairFormValues) => void | Promise<void>
  onDelete: () => void | Promise<void>
  saveLoading?: boolean
  deleteLoading?: boolean
}

function EditPairForm({
  pair,
  onClose,
  onSubmit,
  onDelete,
  saveLoading,
  deleteLoading,
}: EditPairFormProps) {
  const initial = initialForm(pair)
  const [name, setName] = useState(initial.name)
  const [playerAText, setPlayerAText] = useState(initial.playerAText)
  const [playerBText, setPlayerBText] = useState(initial.playerBText)

  const playerALocked = Boolean(pair.player_a_user_id)
  const playerBLocked = Boolean(pair.player_b_user_id)
  const playerADisplay =
    pair.player_a_display_name?.trim() || (playerALocked ? 'Jugador registrado' : '')
  const playerBDisplay =
    pair.player_b_display_name?.trim() || (playerBLocked ? 'Jugador registrado' : '')

  const handleSubmit = async () => {
    try {
      await onSubmit({ name, playerAText, playerBText })
    } catch {
      // El padre muestra el error; mantenemos el formulario.
    }
  }

  return (
    <SafeAreaView style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Editar pareja</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar">
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Input
          label="Nombre de la pareja (opcional)"
          placeholder="Nombre Jugador1 - Nombre Jugador2"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <View style={styles.slot}>
          <Text style={styles.slotLabel}>Jugador 1</Text>
          {playerALocked ? (
            <View style={styles.locked}>
              <Text style={styles.lockedName}>{playerADisplay}</Text>
              <Text style={styles.lockedHint}>Inscrito con cuenta (no editable)</Text>
            </View>
          ) : (
            <Input
              label="Nombre (texto)"
              placeholder="Nombre del jugador"
              value={playerAText}
              onChangeText={setPlayerAText}
              autoCapitalize="words"
            />
          )}
        </View>

        <View style={styles.slot}>
          <Text style={styles.slotLabel}>Jugador 2</Text>
          {playerBLocked ? (
            <View style={styles.locked}>
              <Text style={styles.lockedName}>{playerBDisplay}</Text>
              <Text style={styles.lockedHint}>Inscrito con cuenta (no editable)</Text>
            </View>
          ) : (
            <Input
              label="Nombre (texto)"
              placeholder="Compañero"
              value={playerBText}
              onChangeText={setPlayerBText}
              autoCapitalize="words"
            />
          )}
        </View>

        <Button title="Guardar cambios" onPress={() => void handleSubmit()} loading={saveLoading} />
        <Button
          title="Eliminar pareja"
          variant="outline"
          onPress={() => {
            void onDelete()
          }}
          loading={deleteLoading}
          style={styles.deleteBtn}
        />
      </ScrollView>
    </SafeAreaView>
  )
}

export function EditPairModal({
  visible,
  pair,
  onClose,
  onSubmit,
  onDelete,
  saveLoading,
  deleteLoading,
}: EditPairModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      {visible && pair ? (
        <EditPairForm
          key={pair.id}
          pair={pair}
          onClose={onClose}
          onSubmit={onSubmit}
          onDelete={onDelete}
          saveLoading={saveLoading}
          deleteLoading={deleteLoading}
        />
      ) : null}
    </Modal>
  )
}

const styles = StyleSheet.create({
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
  body: { padding: 20, paddingBottom: 40 },
  slot: { marginBottom: 16 },
  slotLabel: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.primary, marginBottom: 8 },
  locked: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  lockedName: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  lockedHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  deleteBtn: { marginTop: 12 },
})
