/** Host for HTTPS invite links (Firebase Hosting), without protocol. */
export function getInviteHost(): string {
  const raw = process.env.EXPO_PUBLIC_INVITE_HOST?.trim() ?? ''
  if (!raw) {
    throw new Error('Falta EXPO_PUBLIC_INVITE_HOST (hostname de Firebase Hosting, sin https://).')
  }
  return raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}

export function buildMatchHttpsInviteUrl(matchId: string): string {
  return `https://${getInviteHost()}/m/${matchId}`
}

export function buildTournamentHttpsInviteUrl(tournamentId: string): string {
  return `https://${getInviteHost()}/t/${tournamentId}`
}
