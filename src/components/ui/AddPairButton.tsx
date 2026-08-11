import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'

type AddPairButtonProps = {
  onPress: () => void
  /** When false, show the same primary CTA as other screens; when true, a compact +. */
  hasPairs?: boolean
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

export function AddPairButton({
  onPress,
  hasPairs = false,
  accessibilityLabel = 'Añadir pareja',
  style,
}: AddPairButtonProps) {
  if (!hasPairs) {
    return (
      <Button
        title="Añadir pareja"
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        style={style}
      />
    )
  }

  return (
    <View style={[styles.iconWrap, style]}>
      <IconButton
        name="add"
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        variant="primary"
        size={24}
        style={styles.iconBtn}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
})
