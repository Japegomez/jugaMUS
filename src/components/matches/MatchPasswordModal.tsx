import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Ionicons } from '@expo/vector-icons'

import { Button } from '@/components/ui/Button'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

interface MatchPasswordModalProps {
  visible: boolean
  onClose: () => void
  onSubmit: (password: string, team: string) => Promise<void>
  teamOptions?: { label: string; value: string; disabled: boolean }[]
  isLoading?: boolean
  /** When true, only asks for password (tournament access). */
  accessOnly?: boolean
  title?: string
  hint?: string
}

export function MatchPasswordModal({
  visible,
  onClose,
  onSubmit,
  teamOptions = [],
  isLoading = false,
  accessOnly = false,
  title = accessOnly ? 'Acceso al torneo privado' : 'Unirse a partida privada',
  hint = accessOnly
    ? 'Este torneo es privado. Introduce la contraseña para ver parejas y unirte.'
    : 'Esta partida es privada. Introduce la contraseña para unirte.',
}: MatchPasswordModalProps) {
  const insets = useSafeAreaInsets()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<string>(
    teamOptions.find((t) => !t.disabled)?.value ?? ''
  )
  const [error, setError] = useState<string | null>(null)

  const availableTeams = teamOptions.filter((t) => !t.disabled)

  const handleClose = () => {
    setPassword('')
    setError(null)
    onClose()
  }

  const handleSubmit = async () => {
    if (!password.trim()) {
      setError('Introduce la contraseña')
      return
    }
    if (!accessOnly && !selectedTeam) {
      setError('Selecciona un equipo')
      return
    }
    setError(null)
    try {
      await onSubmit(password.trim(), accessOnly ? '' : selectedTeam)
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Contraseña incorrecta')
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <View style={styles.headerLeft} />
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={handleClose} hitSlop={12} accessibilityLabel="Cerrar">
            <Text style={styles.closeBtn}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.hint}>{hint}</Text>

          {!accessOnly && availableTeams.length > 1 ? (
            <>
              <Text style={styles.label}>Equipo</Text>
              <View style={styles.teamRow}>
                {availableTeams.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[styles.teamChip, selectedTeam === opt.value && styles.teamChipOn]}
                    onPress={() => setSelectedTeam(opt.value)}>
                    <Text
                      style={[
                        styles.teamChipText,
                        selectedTeam === opt.value && styles.teamChipTextOn,
                      ]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.label}>Contraseña</Text>
          <View style={[styles.inputWrap, error ? styles.inputError : null]}>
            <TextInput
              style={styles.input}
              placeholder="Contraseña de acceso"
              placeholderTextColor={Colors.textSecondary}
              value={password}
              onChangeText={(v) => {
                setPassword(v)
                setError(null)
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              onSubmitEditing={() => void handleSubmit()}
              returnKeyType="done"
            />
            <Pressable
              onPress={() => setShowPassword((s) => !s)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              style={styles.eyeBtn}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={Colors.textSecondary}
              />
            </Pressable>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {isLoading ? (
            <ActivityIndicator style={styles.loading} color={Colors.primary} />
          ) : (
            <Button
              title={accessOnly ? 'Acceder' : 'Unirse'}
              onPress={() => void handleSubmit()}
              style={styles.btn}
              disabled={!accessOnly && availableTeams.length === 0}
            />
          )}

          {!accessOnly && availableTeams.length === 0 ? (
            <Text style={styles.fullNote}>Ambos equipos están completos.</Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flex: 1 },
  title: {
    flex: 3,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
  },
  closeBtn: {
    flex: 1,
    textAlign: 'right',
    fontSize: 18,
    color: Colors.textSecondary,
  },
  body: {
    flex: 1,
    padding: 24,
    gap: 8,
  },
  lockIcon: {
    fontSize: 36,
    textAlign: 'center',
    marginBottom: 4,
  },
  hint: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: Fonts.regular,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
    marginTop: 8,
  },
  teamRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  teamChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  teamChipOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.wonBackground,
  },
  teamChipText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
  },
  teamChipTextOn: {
    color: Colors.primary,
  },
  inputWrap: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    marginBottom: 4,
  },
  inputError: {
    borderColor: '#e53935',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#e53935',
    fontFamily: Fonts.regular,
    marginBottom: 4,
  },
  loading: {
    marginTop: 16,
  },
  btn: {
    marginTop: 16,
  },
  fullNote: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
})
