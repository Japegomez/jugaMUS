import { StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import {
  displayLeaguePairName,
  leaguePairMemberLabels,
  type LeaguePairRow,
} from '@/services/leagues.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

type LeaguePairCardProps = {
  pair: LeaguePairRow
  subtitle?: string
  eloLabel?: string
  joinLabel?: string
  onJoin?: () => void
  joinLoading?: boolean
  onEdit?: () => void
  challengeLabel?: string
  onChallenge?: () => void
}

export function LeaguePairCard({
  pair,
  subtitle,
  eloLabel,
  joinLabel,
  onJoin,
  joinLoading,
  onEdit,
  challengeLabel,
  onChallenge,
}: LeaguePairCardProps) {
  const members = leaguePairMemberLabels(pair)

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardMain}>
          {members.length > 0 ? (
            <Text style={styles.members}>{members.join(' · ')}</Text>
          ) : (
            <Text style={styles.empty}>Sin jugadores</Text>
          )}
          <Text style={styles.name}>{displayLeaguePairName(pair)}</Text>
        </View>
        {onEdit ? (
          <IconButton
            name="create-outline"
            onPress={onEdit}
            accessibilityLabel="Editar pareja"
            style={styles.editBtn}
          />
        ) : null}
      </View>
      {eloLabel ? <Text style={styles.elo}>{eloLabel}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.actions}>
        {onJoin && joinLabel ? (
          <Button
            title={joinLabel}
            variant="outline"
            onPress={onJoin}
            loading={joinLoading}
            style={styles.actionBtn}
          />
        ) : null}
        {onChallenge && challengeLabel ? (
          <Button
            title={challengeLabel}
            variant="primary"
            onPress={onChallenge}
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
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardMain: { flex: 1 },
  editBtn: { marginTop: -4 },
  name: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary, marginTop: 6 },
  members: { fontSize: 14, color: Colors.textSecondary },
  empty: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  elo: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary, marginTop: 6 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  actionBtn: { flexGrow: 1, minWidth: 100 },
})
