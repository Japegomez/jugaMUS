import { StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import type { LeagueChallengeRow } from '@/services/leagues.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

type ChallengeListProps = {
  challenges: LeagueChallengeRow[]
  userPairId: string | null
  isOrganizer?: boolean
  onAccept: (challengeId: string) => void
  onReject: (challengeId: string) => void
  actionLoadingId?: string | null
}

export function ChallengeList({
  challenges,
  userPairId,
  isOrganizer = false,
  onAccept,
  onReject,
  actionLoadingId,
}: ChallengeListProps) {
  const pending = challenges.filter((c) => c.status === 'pending')

  if (pending.length === 0) {
    return <Text style={styles.empty}>No hay desafíos pendientes</Text>
  }

  return (
    <View style={styles.list}>
      {pending.map((ch) => {
        const canRespond =
          isOrganizer || (userPairId !== null && ch.challenged_pair_id === userPairId)
        const loading = actionLoadingId === ch.id
        return (
          <View key={ch.id} style={styles.card}>
            <Text style={styles.title}>
              {ch.challenger_name ?? 'Pareja'} → {ch.challenged_name ?? 'Pareja'}
            </Text>
            <Text style={styles.status}>Pendiente de aceptación</Text>
            {canRespond ? (
              <View style={styles.actions}>
                <Button
                  title="Aceptar"
                  onPress={() => onAccept(ch.id)}
                  loading={loading}
                  style={styles.btn}
                />
                <Button
                  title="Rechazar"
                  variant="secondary"
                  onPress={() => onReject(ch.id)}
                  disabled={loading}
                  style={styles.btn}
                />
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  empty: { color: Colors.textSecondary, fontStyle: 'italic', paddingVertical: 8 },
  list: { gap: 10 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  title: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  status: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { flex: 1 },
})
