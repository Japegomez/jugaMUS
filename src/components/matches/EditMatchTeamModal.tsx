import { useMemo, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { MatchTeamEditSlot, TextPlayerFields } from '@/services/matches.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export type EditMatchTeamFormValues = {
  teamName: string
  textByField: Partial<Record<keyof TextPlayerFields, string>>
}

type EditMatchTeamModalProps = {
  visible: boolean
  teamLabel: string
  customTeamName: string
  slots: MatchTeamEditSlot[]
  onClose: () => void
  onSubmit: (values: EditMatchTeamFormValues) => void | Promise<void>
  loading?: boolean
}

function initialTextByField(
  slots: MatchTeamEditSlot[]
): Partial<Record<keyof TextPlayerFields, string>> {
  const out: Partial<Record<keyof TextPlayerFields, string>> = {}
  for (const slot of slots) {
    if (slot.kind === 'text') {
      out[slot.field] = slot.value
    }
  }
  return out
}

type EditMatchTeamFormProps = {
  teamLabel: string
  customTeamName: string
  slots: MatchTeamEditSlot[]
  onClose: () => void
  onSubmit: (values: EditMatchTeamFormValues) => void | Promise<void>
  loading?: boolean
}

function EditMatchTeamForm({
  teamLabel,
  customTeamName,
  slots,
  onClose,
  onSubmit,
  loading,
}: EditMatchTeamFormProps) {
  const [teamName, setTeamName] = useState(customTeamName)
  const [textByField, setTextByField] = useState(() => initialTextByField(slots))

  const textSlots = useMemo(() => slots.filter((s) => s.kind === 'text'), [slots])

  const handleSubmit = async () => {
    try {
      await onSubmit({ teamName, textByField })
    } catch {
      // El padre muestra el error; mantenemos el formulario.
    }
  }

  const clearCompanion = (field: keyof TextPlayerFields) => {
    setTextByField((prev) => ({ ...prev, [field]: '' }))
  }

  return (
    <SafeAreaView style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Editar pareja</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar">
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <Text style={styles.teamHint}>{teamLabel}</Text>

          <Input
            label="Nombre de la pareja (opcional)"
            placeholder="Nombre Jugador1 - Nombre Jugador2"
            value={teamName}
            onChangeText={setTeamName}
            autoCapitalize="words"
          />

          {slots.map((slot, index) => (
            <View key={`slot-${index}`} style={styles.slot}>
              <Text style={styles.slotLabel}>Jugador {index + 1}</Text>
              {slot.kind === 'registered' ? (
                <View style={styles.locked}>
                  <Text style={styles.lockedName}>{slot.displayName}</Text>
                  <Text style={styles.lockedHint}>Inscrito con cuenta (no editable)</Text>
                </View>
              ) : (
                <>
                  <Input
                    label="Nombre (texto)"
                    placeholder={index === 0 ? 'Nombre del jugador' : 'Compañero'}
                    value={textByField[slot.field] ?? ''}
                    onChangeText={(value) =>
                      setTextByField((prev) => ({ ...prev, [slot.field]: value }))
                    }
                    autoCapitalize="words"
                  />
                  {index > 0 || textSlots.length > 1 ? (
                    <Pressable
                      onPress={() => clearCompanion(slot.field)}
                      accessibilityRole="button"
                      accessibilityLabel="Quitar compañero">
                      <Text style={styles.clearCompanion}>Quitar compañero</Text>
                    </Pressable>
                  ) : null}
                </>
              )}
            </View>
          ))}

          <Text style={styles.note}>
            Deja vacío el nombre de un jugador de texto para quitarlo de la pareja.
          </Text>

          <Button title="Guardar cambios" onPress={() => void handleSubmit()} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export function EditMatchTeamModal({
  visible,
  teamLabel,
  customTeamName,
  slots,
  onClose,
  onSubmit,
  loading,
}: EditMatchTeamModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      {visible ? (
        <EditMatchTeamForm
          key={`${teamLabel}-${slots.map((s) => (s.kind === 'text' ? s.field : 'reg')).join('-')}`}
          teamLabel={teamLabel}
          customTeamName={customTeamName}
          slots={slots}
          onClose={onClose}
          onSubmit={onSubmit}
          loading={loading}
        />
      ) : null}
    </Modal>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background },
  keyboard: { flex: 1 },
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
  teamHint: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
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
  clearCompanion: {
    marginTop: 8,
    fontSize: 13,
    color: Colors.danger,
    fontFamily: Fonts.semiBold,
    textDecorationLine: 'underline',
    alignSelf: 'flex-start',
  },
  note: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16, lineHeight: 18 },
})
