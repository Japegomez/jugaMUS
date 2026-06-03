import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
} from 'react-native'

type KeyboardAwareScrollViewProps = ScrollViewProps

/**
 * ScrollView that keeps focused inputs visible when the software keyboard opens.
 */
export function KeyboardAwareScrollView({
  children,
  contentContainerStyle,
  style,
  ...scrollProps
}: KeyboardAwareScrollViewProps) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <ScrollView
        style={[styles.flex, style]}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={scrollProps.showsVerticalScrollIndicator ?? false}
        {...scrollProps}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
})
