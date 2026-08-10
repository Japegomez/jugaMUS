export const DEFAULT_LEAGUE_TITLE = 'Liga'
export const DEFAULT_LEAGUE_CITY = 'Ciudad por definir'

export const AUTO_START_LEAGUE_ALERT = {
  title: 'Liga creada',
  message:
    'Añade al menos 2 parejas completas y pulsa «Iniciar liga» cuando estés listo. En ida/ida y vuelta se generarán los enfrentamientos automáticamente.',
} as const

export function leaguePlacePayload(placeText: string | undefined | null): {
  place_defined: boolean
  place_text: string | null
} {
  const trimmed = placeText?.trim() ?? ''
  if (!trimmed) {
    return { place_defined: false, place_text: null }
  }
  return { place_defined: true, place_text: trimmed }
}
