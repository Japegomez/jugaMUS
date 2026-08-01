export const DEFAULT_TOURNAMENT_TITLE = 'Torneo'
export const DEFAULT_TOURNAMENT_CITY = 'Ciudad por definir'

export const AUTO_CANCEL_NO_BRACKET_ALERT = {
  title: 'Aviso',
  message:
    'Si llega la hora de inicio y el cuadro no está organizado, el torneo se cancelará automáticamente.\n\nPuedes generar el cuadro en la siguiente pantalla.',
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

/** Empty → null; accepts "10", "10.5", "10,50" (up to 2 decimals). */
export function parseEntryFeeInput(value: string | undefined | null): number | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return null
  const normalized = trimmed.replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Introduce un importe válido (número entero o con hasta 2 decimales)')
  }
  const n = Number(normalized)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Introduce un importe válido')
  }
  return Math.round(n * 100) / 100
}

function coerceEntryFee(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(n) ? n : null
}

export function formatEntryFee(value: number | string | null | undefined): string | null {
  const n = coerceEntryFee(value)
  if (n == null) return null
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export function entryFeeToFormValue(value: number | string | null | undefined): string {
  const n = coerceEntryFee(value)
  if (n == null) return '0'
  if (Number.isInteger(n)) return String(n)
  return String(n)
}
