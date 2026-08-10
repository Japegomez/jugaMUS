import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export type AddLeaguePairFormValues = {
  name: string
  playerAIsSelf: boolean
  playerAText: string
  playerBIsSelf: boolean
  playerBText: string
}

type AddLeaguePairModalProps = {
  visible: boolean
  onClose: () => void
  onSubmit: (values: AddLeaguePairFormValues) => void | Promise<void>
  loading?: boolean
  defaultSelfSlot?: 'a' | 'b' | null
  selfJoinDisabled?: boolean
  title?: string
}

export function AddLeaguePairModal({
  visible,
  onClose,
  onSubmit,
  loading,
  defaultSelfSlot = null,
  selfJoinDisabled = false,
  title = 'Añadir pareja',
}: AddLeaguePairModalProps) {
  const [name, setName] = useState('')
  const [playerAIsSelf, setPlayerAIsSelf] = useState(false)
  const [playerAText, setPlayerAText] = useState('')
  const [playerBIsSelf, setPlayerBIsSelf] = useState(false)
  const [playerBText, setPlayerBText] = useState('')

  // Resetear el formulario cuando el modal abre o cambian las reglas de auto-join.
  // Patrón "adjust state during render" (evita setState dentro de effect).
  const [lastOpenKey, setLastOpenKey] = useState<string | null>(null)
  const openKey = visible ? `${defaultSelfSlot ?? ''}|${selfJoinDisabled ? '1' : '0'}` : null
  if (openKey !== lastOpenKey) {
    setLastOpenKey(openKey)
    if (visible) {
      setName('')
      setPlayerAText('')
      setPlayerBText('')
      if (selfJoinDisabled) {
        setPlayerAIsSelf(false)
        setPlayerBIsSelf(false)
      } else {
        setPlayerAIsSelf(defaultSelfSlot === 'a')
        setPlayerBIsSelf(defaultSelfSlot === 'b')
      }
    }
  }

  const resetForm = () => {
    setName('')
    setPlayerAText('')
    setPlayerBText('')
    setPlayerAIsSelf(false)
    setPlayerBIsSelf(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async () => {
    try {
      await onSubmit({
        name,
        playerAIsSelf: selfJoinDisabled ? false : playerAIsSelf,
        playerAText,
        playerBIsSelf: selfJoinDisabled ? false : playerBIsSelf,
        playerBText,
      })
      resetForm()
    } catch {
      /* keep form */
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <SafeAreaView style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={handleClose} accessibilityRole="button" accessibilityLabel="Cerrar">
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
            <View style={styles.slot}>
              <Text style={styles.slotLabel}>Jugador 1</Text>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Soy yo</Text>
                <Switch
                  value={playerAIsSelf}
                  onValueChange={(v) => {
                    setPlayerAIsSelf(v)
                    if (v) {
                      setPlayerAText('')
                      setPlayerBIsSelf(false)
                    }
                  }}
                  disabled={selfJoinDisabled}
                  trackColor={{ true: Colors.primary, false: Colors.switchTrackOff }}
                  thumbColor={Colors.white}
                  ios_backgroundColor={Colors.switchTrackOff}
                />
              </View>
              {!playerAIsSelf ? (
                <Input
                  label="Nombre (texto)"
                  placeholder="Nombre del jugador"
                  value={playerAText}
                  onChangeText={setPlayerAText}
                  autoCapitalize="words"
                />
              ) : null}
            </View>

            <View style={styles.slot}>
              <Text style={styles.slotLabel}>Jugador 2 (opcional)</Text>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Soy yo</Text>
                <Switch
                  value={playerBIsSelf}
                  onValueChange={(v) => {
                    setPlayerBIsSelf(v)
                    if (v) {
                      setPlayerBText('')
                      setPlayerAIsSelf(false)
                    }
                  }}
                  disabled={selfJoinDisabled}
                  trackColor={{ true: Colors.primary, false: Colors.switchTrackOff }}
                  thumbColor={Colors.white}
                  ios_backgroundColor={Colors.switchTrackOff}
                />
              </View>
              {!playerBIsSelf ? (
                <Input
                  label="Nombre (texto)"
                  placeholder="Compañero"
                  value={playerBText}
                  onChangeText={setPlayerBText}
                  autoCapitalize="words"
                />
              ) : null}
            </View>

            <View style={styles.pairNameField}>
              <Input
                label="Nombre de la pareja (opcional)"
                placeholder="Nombre Jugador1 - Nombre Jugador2"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            <Button title="Guardar pareja" onPress={() => void handleSubmit()} loading={loading} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
  slot: { marginBottom: 16 },
  slotLabel: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.primary, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  rowLabel: { fontSize: 15, color: Colors.textPrimary },
  pairNameField: { marginBottom: 24 },
})
