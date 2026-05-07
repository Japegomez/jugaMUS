// Lista de municipios del INE (JSON estático)
// Se añade el fichero JSON completo en la tarea F3
export const municipalities: string[] = []

export function searchMunicipalities(query: string): string[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return municipalities.filter((m) => m.toLowerCase().includes(q)).slice(0, 20)
}
