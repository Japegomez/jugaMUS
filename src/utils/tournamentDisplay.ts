import { TOURNAMENT_STATUS } from '@/constants'
import { Colors } from '@/theme/colors'

export function tournamentStatusDisplay(tournament: { status: string }): {
  text: string
  color: string
} {
  switch (tournament.status) {
    case TOURNAMENT_STATUS.REGISTRATION:
      return { text: 'Planificado', color: Colors.primary }
    case TOURNAMENT_STATUS.IN_PROGRESS:
      return { text: 'En curso', color: Colors.warning }
    case TOURNAMENT_STATUS.FINISHED:
      return { text: 'Finalizado', color: Colors.textSecondary }
    case TOURNAMENT_STATUS.CANCELLED:
      return { text: 'Cancelado', color: Colors.danger }
    default:
      return { text: tournament.status, color: Colors.textSecondary }
  }
}
