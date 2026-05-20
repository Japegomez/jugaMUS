import { useMemo, useState } from 'react'
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'

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
}: {
  label: string
  value: number
  options: number[]
  onChange: (n: number) => void
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.chipRow}>
        {options.map((n) => (
          <Pressable
            key={n}
            style={[s.chip, value === n && s.chipOn]}
            onPress={() => onChange(n)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === n }}
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
  onSubmit,
}: MatchScorePickerProps) {
  const options = useMemo(() => scoreOptions(durationTargetGames), [durationTargetGames])
  const [teamAGames, setTeamAGames] = useState(durationTargetGames)
  const [teamBGames, setTeamBGames] = useState(0)
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
        Partida a {durationTargetGames} juego{durationTargetGames > 1 ? 's' : ''}. Elige el marcador
        (sin empates).
      </Text>

      <ScoreChipRow
        label={`Juegos ${teamAName}`}
        value={teamAGames}
        options={options}
        onChange={setTeamAGames}
      />
      <ScoreChipRow
        label={`Juegos ${teamBName}`}
        value={teamBGames}
        options={options}
        onChange={setTeamBGames}
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
  return <MatchScorePickerFields key={props.durationTargetGames} {...props} />
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
  hint: { fontSize: 15, color: '#444', marginBottom: 6 },
  sub: { fontSize: 14, color: '#666', marginBottom: 16, lineHeight: 20 },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minWidth: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  chipOn: { borderColor: '#1a5f4a', backgroundColor: '#eef7f3' },
  chipText: { fontSize: 16, fontWeight: '600', color: '#666' },
  chipTextOn: { color: '#1a5f4a' },
  error: { fontSize: 14, color: '#c0392b', marginTop: 4 },
})
