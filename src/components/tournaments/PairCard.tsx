import { StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import type { TournamentPairRow } from '@/services/tournaments.service'
import { pairMemberLabels } from '@/services/tournaments.service'

type PairCardProps = {
  pair: TournamentPairRow
  subtitle?: string
  joinLabel?: string
  onJoin?: () => void
  joinLoading?: boolean
}

export function PairCard({ pair, subtitle, joinLabel, onJoin, joinLoading }: PairCardProps) {
  const members = pairMemberLabels(pair)

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{pair.name}</Text>
      {members.length > 0 ? (
        <Text style={styles.members}>{members.join(' · ')}</Text>
      ) : (
        <Text style={styles.empty}>Sin jugadores</Text>
      )}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {onJoin && joinLabel ? (
        <Button
          title={joinLabel}
          variant="outline"
          onPress={onJoin}
          loading={joinLoading}
          style={styles.joinBtn}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  name: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  members: { fontSize: 14, color: '#555', marginTop: 4 },
  empty: { fontSize: 14, color: '#999', marginTop: 4, fontStyle: 'italic' },
  subtitle: { fontSize: 12, color: '#888', marginTop: 6 },
  joinBtn: { marginTop: 12 },
})
