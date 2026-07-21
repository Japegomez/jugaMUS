import * as Linking from 'expo-linking'

import { buildMatchHttpsInviteUrl } from '@/lib/inviteLinks'

/** Custom-scheme deep link (`jugamus://matches/{id}`). Prefer HTTPS invites for WhatsApp. */
export function buildMatchInviteUrl(matchId: string): string {
  return Linking.createURL(`matches/${matchId}`)
}

export { buildMatchHttpsInviteUrl }
