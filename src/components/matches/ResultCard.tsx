import { StyleSheet, Text, View } from 'react-native'

import { RESULT_STATUS } from '@/constants'
import type { MatchResultRow } from '@/services/results.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

function statusBadge(status: string) {
  switch (status) {
    case RESULT_STATUS.PENDING_VALIDATION:
      return { text: 'Pendiente de validación', color: Colors.warning }
    case RESULT_STATUS.CONFIRMED:
      return { text: 'Confirmado', color: Colors.primary }
    case RESULT_STATUS.DISPUTED:
      return { text: 'En disputa', color: Colors.danger }
    case RESULT_STATUS.VOID:
      return { text: 'Anulado', color: Colors.textSecondary }
    default:
      return { text: status, color: Colors.textSecondary }
  }
}

interface ResultCardProps {
  result: MatchResultRow
  teamAName?: string
  teamBName?: string
}

export function ResultCard({
  result,
  teamAName = 'Equipo A',
  teamBName = 'Equipo B',
}: ResultCardProps) {
  const badge = statusBadge(result.status)

  return (
    <View style={s.card}>
      <View style={s.row}>
        <Text style={s.sectionTitle}>Resultado</Text>
        <View style={[s.badge, { borderColor: badge.color }]}>
          <Text style={[s.badgeText, { color: badge.color }]}>{badge.text}</Text>
        </View>
      </View>
      <Text style={s.score}>
        {teamAName}: {result.team_a_games} — {teamBName}: {result.team_b_games}
      </Text>
      <Text style={s.meta}>
        Enviado por {result.submitted_by_team === 'A' ? teamAName : teamBName}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary },
  badge: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 12, fontFamily: Fonts.semiBold },
  score: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 6 },
  meta: { fontSize: 13, color: Colors.textSecondary },
})
