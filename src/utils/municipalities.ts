import municipalitiesData from '../data/municipalities.json'

/**
 * Municipios españoles (código INE 5 dígitos + nombre).
 * Datos generados con `npm run sync:municipalities` desde CSV oficial / derivado INE.
 */
export interface Municipality {
  code: string
  name: string
}

export const MUNICIPALITIES: Municipality[] = municipalitiesData as Municipality[]

/**
 * Busca municipios por coincidencia parcial en el nombre (sin acentos, minúsculas).
 * Devuelve como máximo `limit` resultados.
 */
export function searchMunicipalities(query: string, limit = 20): Municipality[] {
  if (!query.trim()) return []
  const normalized = normalizeText(query.trim())
  return MUNICIPALITIES.filter((m) => normalizeText(m.name).includes(normalized)).slice(0, limit)
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
