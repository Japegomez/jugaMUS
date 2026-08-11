import { LEAGUE_FORMAT, LEAGUE_FORMAT_LABELS, LEAGUE_STATUS, type LeagueFormat } from '@/constants'
import { Colors } from '@/theme/colors'

export function leagueStatusDisplay(league: {
  status: string
  fixtures_generated_at?: string | null
}): {
  text: string
  color: string
} {
  switch (league.status) {
    case LEAGUE_STATUS.REGISTRATION:
      return {
        // Compatibilidad: si `fixtures_generated_at` no viene (undefined),
        // mantenemos el texto histórico "Inscripción".
        text: league.fixtures_generated_at === null ? 'Inscripción abierta' : 'Inscripción',
        color: Colors.primary,
      }
    case LEAGUE_STATUS.IN_PROGRESS:
      return { text: 'En curso', color: Colors.warning }
    case LEAGUE_STATUS.FINISHED:
      return { text: 'Finalizada', color: Colors.textSecondary }
    case LEAGUE_STATUS.CANCELLED:
      return { text: 'Cancelada', color: Colors.danger }
    default:
      return { text: league.status, color: Colors.textSecondary }
  }
}

export function leagueFormatDisplay(format: string): string {
  if (Object.hasOwn(LEAGUE_FORMAT_LABELS, format)) {
    return LEAGUE_FORMAT_LABELS[format as LeagueFormat]
  }
  return format
}

export function isRoundRobinFormat(format: string): boolean {
  return format === LEAGUE_FORMAT.SINGLE_ROUND || format === LEAGUE_FORMAT.DOUBLE_ROUND
}

export function isOpenEloFormat(format: string): boolean {
  return format === LEAGUE_FORMAT.OPEN_ELO
}
