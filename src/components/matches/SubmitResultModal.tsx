import { MatchScoreModal } from '@/components/matches/MatchScorePicker'

export interface SubmitResultModalProps {
  visible: boolean
  onClose: () => void
  viewerTeamLabel: string
  teamAName: string
  teamBName: string
  durationTargetGames: number
  rivalAutoConfirms?: boolean
  loading: boolean
  onSubmit: (values: { teamAGames: number; teamBGames: number }) => void
}

export function SubmitResultModal({
  visible,
  onClose,
  viewerTeamLabel,
  teamAName,
  teamBName,
  durationTargetGames,
  rivalAutoConfirms = false,
  loading,
  onSubmit,
}: SubmitResultModalProps) {
  const hintParts = [`Tu equipo: ${viewerTeamLabel}`]
  if (rivalAutoConfirms) {
    hintParts.push('El rival no tiene cuenta: el marcador se confirmará al guardar.')
  }

  return (
    <MatchScoreModal
      visible={visible}
      onClose={onClose}
      title="Registrar resultado"
      durationTargetGames={durationTargetGames}
      teamAName={teamAName}
      teamBName={teamBName}
      hint={hintParts.join(' ')}
      submitLabel="Enviar resultado"
      loading={loading}
      onSubmit={onSubmit}
    />
  )
}
