import { Ionicons } from '@expo/vector-icons'
import { type ComponentProps } from 'react'
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'

import { Colors } from '@/theme/colors'

type IconButtonProps = {
  name: ComponentProps<typeof Ionicons>['name']
  onPress: () => void
  accessibilityLabel: string
  size?: number
  color?: string
  variant?: 'ghost' | 'outline' | 'primary'
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  size = 22,
  color,
  variant = 'ghost',
  disabled,
  style,
}: IconButtonProps) {
  const iconColor =
    color ??
    (variant === 'primary' ? Colors.white : variant === 'outline' ? Colors.primary : Colors.textSecondary)

  return (
    <Pressable
      style={[
        styles.base,
        variant === 'outline' && styles.outline,
        variant === 'primary' && styles.primary,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}>
      <Ionicons name={name} size={size} color={iconColor} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  primary: {
    backgroundColor: Colors.primary,
  },
  disabled: { opacity: 0.45 },
})
