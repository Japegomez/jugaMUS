import { Linking, Platform, Share } from 'react-native'

export type InviteShareKind = 'match' | 'tournament'

export type InviteShareMessageInput = {
  kind: InviteShareKind
  title: string
  url: string
  meta?: string
}

export function buildInviteShareMessage(input: InviteShareMessageInput): string {
  const label = input.kind === 'match' ? 'partida' : 'torneo'
  const lines = [`¡Únete a esta ${label} en jugaMUS!`, input.title.trim()]
  if (input.meta?.trim()) {
    lines.push(input.meta.trim())
  }
  lines.push('', input.url)
  return lines.join('\n')
}

/** Opens WhatsApp with prefilled text; falls back to the system share sheet. */
export async function shareInviteViaWhatsApp(message: string): Promise<void> {
  const encoded = encodeURIComponent(message)
  const whatsappUrl =
    Platform.OS === 'web' ? `https://wa.me/?text=${encoded}` : `whatsapp://send?text=${encoded}`

  try {
    const canOpen = await Linking.canOpenURL(whatsappUrl)
    if (canOpen) {
      await Linking.openURL(whatsappUrl)
      return
    }
  } catch {
    /* fall through to Share */
  }

  if (Platform.OS === 'web') {
    try {
      await Linking.openURL(`https://wa.me/?text=${encoded}`)
      return
    } catch {
      /* fall through */
    }
  }

  await Share.share({ message })
}
