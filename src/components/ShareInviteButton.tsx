import { useState } from 'react'
import { Alert, type StyleProp, type ViewStyle } from 'react-native'

import { Button } from '@/components/ui/Button'
import {
  buildLeagueHttpsInviteUrl,
  buildMatchHttpsInviteUrl,
  buildTournamentHttpsInviteUrl,
} from '@/lib/inviteLinks'
import {
  buildInviteShareMessage,
  shareInviteViaWhatsApp,
  type InviteShareKind,
} from '@/lib/shareInvite'

type ShareInviteButtonProps = {
  kind: InviteShareKind
  id: string
  title: string
  meta?: string
  style?: StyleProp<ViewStyle>
}

export function ShareInviteButton({ kind, id, title, meta, style }: ShareInviteButtonProps) {
  const [sharing, setSharing] = useState(false)

  const handleShare = async () => {
    setSharing(true)
    try {
      const url =
        kind === 'match'
          ? buildMatchHttpsInviteUrl(id)
          : kind === 'tournament'
            ? buildTournamentHttpsInviteUrl(id)
            : buildLeagueHttpsInviteUrl(id)
      const message = buildInviteShareMessage({ kind, title, meta, url })
      await shareInviteViaWhatsApp(message)
    } catch (err) {
      Alert.alert(
        'Compartir',
        err instanceof Error ? err.message : 'No se pudo abrir WhatsApp ni el menú de compartir.'
      )
    } finally {
      setSharing(false)
    }
  }

  return (
    <Button
      title="Compartir por WhatsApp"
      variant="secondary"
      loading={sharing}
      onPress={() => void handleShare()}
      style={style}
      accessibilityLabel="Compartir por WhatsApp"
    />
  )
}
