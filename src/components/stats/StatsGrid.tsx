import { StyleSheet, View, type ViewStyle } from 'react-native'

import { StatCard } from '@/components/stats/StatCard'

type StatItem = { label: string; value: string }

export function StatsGrid({ items, style }: { items: StatItem[]; style?: ViewStyle }) {
  return (
    <View style={[styles.grid, style]}>
      {items.map((item) => (
        <StatCard key={item.label} label={item.label} value={item.value} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
})
