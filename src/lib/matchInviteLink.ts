import * as Linking from 'expo-linking'

/** Deep link that opens the match detail screen (`src/app/matches/[id].tsx` redirects to tabs). */
export function buildMatchInviteUrl(matchId: string): string {
  return Linking.createURL(`matches/${matchId}`)
}
