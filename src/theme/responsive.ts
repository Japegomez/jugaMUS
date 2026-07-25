import { useMemo } from 'react'
import { useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Layout } from '@/theme/layout'

export type ResponsiveLayout = {
  width: number
  height: number
  shortSide: number
  longSide: number
  isLandscape: boolean
  /** Altura corta (p. ej. iPhone en landscape o SE). */
  isCompactHeight: boolean
  /** Ancho estrecho (SE / split). */
  isNarrow: boolean
  /** 0.82–1 según altura útil. */
  scale: number
  space: (n: number) => number
  font: (n: number) => number
  insets: ReturnType<typeof useSafeAreaInsets>
  /** Padding superior auth con safe area. */
  authTopPadding: number
  /** Altura útil vertical tras safe areas. */
  contentHeight: number
}

/**
 * Escala tipografía/espaciado y flags de layout para pantallas pequeñas o landscape.
 * No sustituye ScrollView: combínalo con scroll en formularios y modales.
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  return useMemo(() => {
    const shortSide = Math.min(width, height)
    const longSide = Math.max(width, height)
    const isLandscape = width > height
    const contentHeight = Math.max(240, height - insets.top - insets.bottom)
    const scale = Math.min(1, Math.max(0.82, Math.min(shortSide, contentHeight) / 420))
    const space = (n: number) => (n === 0 ? 0 : Math.max(1, Math.round(n * scale)))
    const font = (n: number) => Math.max(11, Math.round(n * scale))

    return {
      width,
      height,
      shortSide,
      longSide,
      isLandscape,
      isCompactHeight: contentHeight < 480 || shortSide < 400,
      isNarrow: width < 390,
      scale,
      space,
      font,
      insets,
      authTopPadding: Math.max(insets.top, 16) + Layout.screenTopExtra,
      contentHeight,
    }
  }, [width, height, insets.top, insets.bottom, insets.left, insets.right])
}
