import { Pressable, StyleSheet, Text } from 'react-native'

import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export type ChipProps = {
  label: string
  sublabel?: string
  selected: boolean
  onPress: () => void
}

export function Chip({ label, sublabel, selected, onPress }: ChipProps) {
  return (
    <Pressable
      style={[chip.base, selected && chip.selected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <Text style={[chip.label, selected && chip.labelSelected]}>{label}</Text>
      {sublabel ? (
        <Text style={[chip.sublabel, selected && chip.sublabelSelected]}>{sublabel}</Text>
      ) : null}
    </Pressable>
  )
}

const chip = StyleSheet.create({
  base: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 48,
    marginHorizontal: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  selected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.wonBackground,
  },
  label: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  labelSelected: { color: Colors.primary },
  sublabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  sublabelSelected: { color: Colors.primary },
})
