import { Platform } from 'react-native'

export const Layout = {
  /** Extra space below the safe area (or minimum inset). */
  screenTopExtra: 12,
  /**
   * @deprecated Prefer `useResponsiveLayout().authTopPadding` (safe-area aware).
   * Kept as fallback for screens not yet migrated.
   */
  authScreenTopPadding: 52,
  /** Tab bar content height excluding bottom safe area (system nav / home indicator). */
  tabBarContentHeight: Platform.select({ ios: 54, android: 58, default: 58 }) ?? 58,
} as const

/** Total tab bar height including bottom safe area inset. */
export function tabBarHeight(bottomInset: number): number {
  return Layout.tabBarContentHeight + bottomInset
}

/** Top padding for scrollable screen content below the status bar. */
export function screenTopPadding(safeAreaTop: number, min = 16): number {
  return Math.max(safeAreaTop, min) + Layout.screenTopExtra
}
