/** City and venue label for matches and tournaments. */
export function formatCityAndPlace(
  city: string,
  placeDefined: boolean,
  placeText: string | null | undefined
): string {
  const cityLabel = city.trim() || '—'

  if (placeDefined && placeText?.trim()) {
    return `${cityLabel} · ${placeText.trim()}`
  }

  if (!placeDefined) {
    return `${cityLabel} · Lugar por definir`
  }

  return cityLabel
}
