/** Pure helpers for debounced realtime pending-id accumulation. */

export function collectPendingMatchIds(previous: Iterable<string>, nextMatchId?: string): string[] {
  const set = new Set(previous)
  if (nextMatchId) set.add(nextMatchId)
  return [...set]
}
