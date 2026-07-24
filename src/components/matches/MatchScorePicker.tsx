import { useMemo, useState } from 'react'
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export type MatchScoreValues = {
  teamAGames: number
  teamBGames: number
}

type MatchScorePickerProps = {
  durationTargetGames: number
  teamAName: string
  teamBName: string
  hint?: string
  submitLabel: string
  loading: boolean
  initialTeamAGames?: number
  initialTeamBGames?: number
  lockValues?: boolean
  onSubmit: (values: MatchScoreValues) => void
}

function scoreOptions(duration: number): number[] {
  return Array.from({ length: duration + 1 }, (_, i) => i)
}

export function validateMatchScores(
  teamAGames: number,
  teamBGames: number,
  durationTargetGames: number
): string | null {
  if (teamAGames === teamBGames) return 'No puede haber empate.'
  if (teamAGames < 0 || teamBGames < 0) return 'Marcador no válido.'
  if (teamAGames > durationTargetGames || teamBGames > durationTargetGames) {
    return `Cada equipo puede marcar entre 0 y ${durationTargetGames} juegos.`
  }
  if (Math.max(teamAGames, teamBGames) !== durationTargetGames) {
    return `El ganador debe alcanzar ${durationTargetGames} juegos.`
  }
  return null
}

function ScoreChipRow({
  label,
  value,
  options,
  onChange,
  locked = false,
}: {
  label: string
  value: number
  options: number[]
  onChange: (n: number) => void
  locked?: boolean
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.chipRow}>
        {options.map((n) => (
          <Pressable
            key={n}
            style={[s.chip, value === n && s.chipOn, locked && value !== n && s.chipLocked]}
            onPress={() => !locked && onChange(n)}
            disabled={locked}
            accessibilityRole="button"
            accessibilityState={{ selected: value === n, disabled: locked }}
            accessibilityLabel={`${n} juegos`}>
            <Text style={[s.chipText, value === n && s.chipTextOn]}>{n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

function MatchScorePickerFields({
  durationTargetGames,
  teamAName,
  teamBName,
  hint,
  submitLabel,
  loading,
  initialTeamAGames,
  initialTeamBGames,
  lockValues = false,
  onSubmit,
}: MatchScorePickerProps) {
  const options = useMemo(() => scoreOptions(durationTargetGames), [durationTargetGames])
  const [teamAGames, setTeamAGames] = useState(initialTeamAGames ?? durationTargetGames)
  const [teamBGames, setTeamBGames] = useState(initialTeamBGames ?? 0)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    const validationError = validateMatchScores(teamAGames, teamBGames, durationTargetGames)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    onSubmit({ teamAGames, teamBGames })
  }

  return (
    <View>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      <Text style={s.sub}>
        {lockValues
          ? `Partida a ${durationTargetGames} juego${durationTargetGames > 1 ? 's' : ''}. Confirma el marcador.`
          : `Partida a ${durationTargetGames} juego${durationTargetGames > 1 ? 's' : ''}. Elige el marcador (sin empates).`}
      </Text>

      <ScoreChipRow
        label={`Juegos ${teamAName}`}
        value={teamAGames}
        options={options}
        onChange={setTeamAGames}
        locked={lockValues}
      />
      <ScoreChipRow
        label={`Juegos ${teamBName}`}
        value={teamBGames}
        options={options}
        onChange={setTeamBGames}
        locked={lockValues}
      />

      {error ? <Text style={s.error}>{error}</Text> : null}

      <Button
        title={submitLabel}
        onPress={handleSubmit}
        loading={loading}
        style={{ marginTop: 12 }}
      />
    </View>
  )
}

export function MatchScorePicker(props: MatchScorePickerProps) {
  const pickerKey = `${props.durationTargetGames}-${props.initialTeamAGames ?? 'a'}-${props.initialTeamBGames ?? 'b'}-${props.lockValues ? 'locked' : 'open'}`
  return <MatchScorePickerFields key={pickerKey} {...props} />
}

type MatchScoreModalProps = MatchScorePickerProps & {
  visible: boolean
  onClose: () => void
  title: string
}

export function MatchScoreModal({
  visible,
  onClose,
  title,
  loading,
  ...pickerProps
}: MatchScoreModalProps) {
  const close = () => {
    if (loading) return
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
          <Text style={s.title}>{title}</Text>
          <Pressable
            onPress={close}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Cerrar">
            <Text style={s.close}>✕</Text>
          </Pressable>
        </View>
        <View style={s.body}>
          <MatchScorePicker {...pickerProps} loading={loading} />
          <Button
            title="Cancelar"
            variant="outline"
            onPress={close}
            disabled={loading}
            style={{ marginTop: 8 }}
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
  hint: { fontSize: 15, color: Colors.textSecondary, marginBottom: 6 },
  sub: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16, lineHeight: 20 },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minWidth: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  chipOn: { borderColor: Colors.primary, backgroundColor: Colors.wonBackground },
  chipLocked: { opacity: 0.35 },
  chipText: { fontSize: 16, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  chipTextOn: { color: Colors.primary },
  error: { fontSize: 14, color: Colors.danger, marginTop: 4 },
})
