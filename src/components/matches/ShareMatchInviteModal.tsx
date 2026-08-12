import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'

import { IconButton } from '@/components/ui/IconButton'
import { buildMatchHttpsInviteUrl } from '@/lib/inviteLinks'
import { buildInviteShareMessage, shareInviteViaWhatsApp } from '@/lib/shareInvite'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export type ShareMatchInviteModalProps = {
  visible: boolean
  matchId: string
  title: string
  meta?: string
  onClose: () => void
}

export function ShareMatchInviteModal({
  visible,
  matchId,
  title,
  meta,
  onClose,
}: ShareMatchInviteModalProps) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const copiedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inviteUrl = buildMatchHttpsInviteUrl(matchId)
  const shareMessage = useMemo(
    () =>
      buildInviteShareMessage({
        kind: 'match',
        title,
        url: inviteUrl,
        meta: meta ?? 'Te he invitado a participar en esta partida',
      }),
    [inviteUrl, meta, title]
  )

  useEffect(() => {
    return () => {
      if (copiedResetRef.current) clearTimeout(copiedResetRef.current)
    }
  }, [])

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(shareMessage)
      setCopied(true)
      if (copiedResetRef.current) clearTimeout(copiedResetRef.current)
      copiedResetRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      Alert.alert('Enlace', 'No se pudo copiar la invitación.')
    }
  }

  const handleShare = async () => {
    setSharing(true)
    try {
      await shareInviteViaWhatsApp(shareMessage)
    } catch (err) {
      Alert.alert(
        'Compartir',
        err instanceof Error ? err.message : 'No se pudo abrir el menú de compartir.'
      )
    } finally {
      setSharing(false)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => setCopied(false)}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Cerrar">
        <Pressable style={s.card} onPress={(e) => e.stopPropagation()}>
          <View style={s.header}>
            <Text style={s.title}>Comparte la invitación</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Text style={s.close}>✕</Text>
            </Pressable>
          </View>
          <Text style={s.message}>
            Copia el enlace o compártelo para que tus amigos invitados puedan unirse a la partida.
          </Text>
          <View style={s.urlBox}>
            <Text style={s.url} numberOfLines={1} ellipsizeMode="middle" selectable>
              {inviteUrl}
            </Text>
            <View style={s.actions}>
              <IconButton
                name={copied ? 'checkmark' : 'copy-outline'}
                variant="outline"
                accessibilityLabel={copied ? 'Invitación copiada' : 'Copiar invitación'}
                onPress={() => void handleCopy()}
                color={Colors.primary}
              />
              <IconButton
                name="share-outline"
                variant="primary"
                accessibilityLabel="Compartir enlace"
                disabled={sharing}
                onPress={() => void handleShare()}
              />
            </View>
          </View>
          {copied ? <Text style={s.copiedHint}>Invitación copiada</Text> : null}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { flex: 1, fontSize: 17, fontFamily: Fonts.bold, color: Colors.textPrimary },
  close: { fontSize: 18, color: Colors.textSecondary, padding: 4 },
  message: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  urlBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  url: {
    flex: 1,
    fontSize: 13,
    color: Colors.primary,
    fontFamily: Fonts.medium,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copiedHint: { fontSize: 13, color: Colors.primary, fontFamily: Fonts.semiBold },
})
