import { StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import type { TournamentPairRow } from '@/services/tournaments.service'
import { displayPairName, pairMemberLabels } from '@/services/tournaments.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

type PairCardProps = {
  pair: TournamentPairRow
  subtitle?: string
  joinLabel?: string
  onJoin?: () => void
  joinLoading?: boolean
  editLabel?: string
  onEdit?: () => void
}

export function PairCard({
  pair,
  subtitle,
  joinLabel,
  onJoin,
  joinLoading,
  editLabel,
  onEdit,
}: PairCardProps) {
  const members = pairMemberLabels(pair)

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{displayPairName(pair)}</Text>
      {members.length > 0 ? (
        <Text style={styles.members}>{members.join(' · ')}</Text>
      ) : (
        <Text style={styles.empty}>Sin jugadores</Text>
      )}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.actions}>
        {onEdit && editLabel ? (
          <Button title={editLabel} variant="secondary" onPress={onEdit} style={styles.actionBtn} />
        ) : null}
        {onJoin && joinLabel ? (
          <Button
            title={joinLabel}
            variant="outline"
            onPress={onJoin}
            loading={joinLoading}
            style={styles.actionBtn}
          />
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  name: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary },
  members: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  empty: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  subtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionBtn: { flexGrow: 1, minWidth: 120 },
})
