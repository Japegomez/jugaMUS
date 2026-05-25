import { StyleSheet, View, type ViewStyle } from 'react-native'

import { Colors } from '@/theme/colors'

export type StatusDotTone = 'active' | 'pending' | 'upcoming'

const toneColors: Record<StatusDotTone, string> = {
  active: Colors.statusActive,
  pending: Colors.statusPending,
  upcoming: Colors.statusUpcoming,
}

type StatusDotProps = {
  tone?: StatusDotTone
  size?: number
  style?: ViewStyle
}

export function StatusDot({ tone = 'upcoming', size = 6, style }: StatusDotProps) {
  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: toneColors[tone],
        },
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  dot: {
    flexShrink: 0,
  },
})
