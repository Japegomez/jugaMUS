import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { IconButton } from '@/components/ui/IconButton'

type AddPairButtonProps = {
  onPress: () => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

export function AddPairButton({
  onPress,
  accessibilityLabel = 'Añadir pareja',
  style,
}: AddPairButtonProps) {
  return (
    <View style={[styles.wrap, style]}>
      <IconButton
        name="add"
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        variant="outline"
        size={24}
        style={styles.btn}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 4,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
})
