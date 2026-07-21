/**
 * Map expo-router segments to a post-login invite destination, or null if not an invite route.
 */
export function inviteHrefFromSegments(segments: readonly string[]): string | null {
  const parts = segments.filter(Boolean)
  if (parts.length < 2) return null

  // Root or HTTPS stubs: matches/:id | tournaments/:id | m/:id | t/:id
  // Tabs: (tabs)/matches/:id | (tabs)/tournaments/:id
  let kind: 'match' | 'tournament' | null = null
  let id: string | undefined

  if (parts[0] === '(tabs)' && parts.length >= 3) {
    if (parts[1] === 'matches') {
      kind = 'match'
      id = parts[2]
    } else if (parts[1] === 'tournaments') {
      kind = 'tournament'
      id = parts[2]
    }
  } else if (parts[0] === 'matches') {
    kind = 'match'
    id = parts[1]
  } else if (parts[0] === 'tournaments') {
    kind = 'tournament'
    id = parts[1]
  } else if (parts[0] === 'm') {
    kind = 'match'
    id = parts[1]
  } else if (parts[0] === 't') {
    kind = 'tournament'
    id = parts[1]
  }

  if (!kind || !id || id === 'create' || id === 'edit') return null

  return kind === 'match' ? `/(tabs)/matches/${id}` : `/(tabs)/tournaments/${id}`
}
