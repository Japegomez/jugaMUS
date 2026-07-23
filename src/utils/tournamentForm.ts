export const DEFAULT_TOURNAMENT_TITLE = 'Torneo'
export const DEFAULT_TOURNAMENT_CITY = 'Ciudad por definir'

export const AUTO_CANCEL_NO_BRACKET_ALERT = {
  title: 'Cuadro no organizado',
  message:
    'Si llega la hora de inicio y el cuadro no está organizado, el torneo se cancelará automáticamente.',
} as const

/** Same place semantics as match create: empty text → undefined place. */
export function tournamentPlacePayload(placeText?: string): {
  place_defined: boolean
  place_text: string | null
} {
  const trimmed = placeText?.trim()
  if (trimmed) {
    return { place_defined: true, place_text: trimmed }
  }
  return { place_defined: false, place_text: null }
}
