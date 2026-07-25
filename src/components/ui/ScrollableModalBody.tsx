import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type ScrollableModalBodyProps = {
  children: ReactNode
  contentContainerStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
}

/**
 * Cuerpo de modal pageSheet que hace scroll en pantallas bajas / landscape
 * y respeta el safe area inferior.
 */
export function ScrollableModalBody({
  children,
  contentContainerStyle,
  style,
}: ScrollableModalBodyProps) {
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      style={[styles.scroll, style]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, 20) + 8 },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}>
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    flexGrow: 1,
  },
})
