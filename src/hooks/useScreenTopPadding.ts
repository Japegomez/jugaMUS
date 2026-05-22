import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { screenTopPadding } from '@/theme/layout'

export function useScreenTopPadding(min = 16): number {
  const insets = useSafeAreaInsets()
  return screenTopPadding(insets.top, min)
}
