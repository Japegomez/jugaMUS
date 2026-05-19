import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type AdminCloseBarProps = {
  /** Where to go when back is unavailable (common on web). */
  fallbackHref?: Href
}

export function AdminCloseBar({ fallbackHref = '/(admin)/' as Href }: AdminCloseBarProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const handleClose = () => {
    // Expo Web often has no stack history; replace is reliable.
    if (Platform.OS === 'web') {
      router.replace(fallbackHref)
      return
    }

    if (router.canGoBack?.()) {
      router.back()
    } else {
      router.replace(fallbackHref)
    }
  }

  return (
    <View style={[styles.bar, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.spacer} />
      <Pressable
        onPress={handleClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}>
        <Text style={styles.closeX}>✕</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 4,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  spacer: { flex: 1 },
  closeBtn: Platform.select({
    web: { cursor: 'pointer' as const },
    default: {},
  }),
  closeBtnPressed: { opacity: 0.65 },
  closeX: {
    fontSize: 22,
    color: '#555',
    padding: 8,
  },
})
