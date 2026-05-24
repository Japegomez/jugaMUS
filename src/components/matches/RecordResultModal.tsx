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
  initialTeamAGames?: number
  initialTeamBGames?: number
  lockValues?: boolean
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
  initialTeamAGames,
  initialTeamBGames,
  lockValues,
  onSubmit,
}: RecordResultModalProps) {
  return (
    <MatchScoreModal
      visible={visible}
      onClose={onClose}
      title="Registrar resultado"
      durationTargetGames={durationTargetGames}
      teamAName={teamAName}
      teamBName={teamBName}
      hint={hint}
      submitLabel={submitLabel}
      loading={loading}
      initialTeamAGames={initialTeamAGames}
      initialTeamBGames={initialTeamBGames}
      lockValues={lockValues}
      onSubmit={onSubmit}
    />
  )
}
