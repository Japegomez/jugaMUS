import { useState } from 'react'
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'

import { buildMatchInviteUrl } from '@/lib/matchInviteLink'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

type MatchInviteLinkCardProps = {
  matchId: string
}

export function MatchInviteLinkCard({ matchId }: MatchInviteLinkCardProps) {
  const [copied, setCopied] = useState(false)
  const inviteUrl = buildMatchInviteUrl(matchId)

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      Alert.alert('Enlace', 'No se pudo copiar el enlace.')
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Solo con enlace</Text>
      <Text style={styles.hint}>
        Esta partida no aparece en el listado público. Comparte el enlace para que otros se unan.
      </Text>
      <View style={styles.urlRow}>
        <Text style={styles.url} numberOfLines={2} selectable>
          {inviteUrl}
        </Text>
        <Pressable
          onPress={() => void handleCopy()}
          style={({ pressed }) => [styles.copyBtn, pressed && styles.copyBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Copiar enlace de invitación">
          <Text style={styles.copyBtnText}>{copied ? 'Copiado' : 'Copiar'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
  },
  hint: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  url: {
    flex: 1,
    fontSize: 13,
    color: Colors.primary,
    fontFamily: Fonts.medium,
  },
  copyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...Platform.select({ web: { cursor: 'pointer' as const } }),
  },
  copyBtnPressed: { opacity: 0.85 },
  copyBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontFamily: Fonts.semiBold,
  },
})
