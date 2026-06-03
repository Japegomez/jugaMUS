import { StyleSheet, Text, View } from 'react-native'

import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

interface MatchResultScoreLinesProps {
  teamAName: string
  teamBName: string
  teamAScore: number
  teamBScore: number
}

export function MatchResultScoreLines({
  teamAName,
  teamBName,
  teamAScore,
  teamBScore,
}: MatchResultScoreLinesProps) {
  return (
    <View style={s.block}>
      <View style={s.line}>
        <Text style={s.teamName} numberOfLines={2}>
          {teamAName}
        </Text>
        <Text style={s.teamScore}>{teamAScore}</Text>
      </View>
      <View style={s.line}>
        <Text style={s.teamName} numberOfLines={2}>
          {teamBName}
        </Text>
        <Text style={s.teamScore}>{teamBScore}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  block: {
    gap: 6,
    marginBottom: 6,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  teamName: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  teamScore: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    minWidth: 28,
    textAlign: 'right',
  },
})
