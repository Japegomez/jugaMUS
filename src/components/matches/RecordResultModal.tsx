import { MatchScoreModal } from '@/components/matches/MatchScorePicker'

export interface RecordResultModalProps {
  visible: boolean
  onClose: () => void
  teamAName: string
  teamBName: string
  durationTargetGames: number
  hint?: string
  submitLabel?: string
  loading: boolean
  onSubmit: (values: { teamAGames: number; teamBGames: number }) => void
}

export function RecordResultModal({
  visible,
  onClose,
  teamAName,
  teamBName,
  durationTargetGames,
  hint,
  submitLabel = 'Confirmar marcador',
  loading,
  onSubmit,
}: RecordResultModalProps) {
  return (
    <MatchScoreModal
      visible={visible}
      onClose={onClose}
      title="Registrar marcador"
      durationTargetGames={durationTargetGames}
      teamAName={teamAName}
      teamBName={teamBName}
      hint={hint}
      submitLabel={submitLabel}
      loading={loading}
      onSubmit={onSubmit}
    />
  )
}
