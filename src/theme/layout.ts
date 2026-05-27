import { Platform } from 'react-native'

export const Layout = {
  /** Extra space below the safe area (or minimum inset). */
  screenTopExtra: 12,
  /** Fixed top padding for auth screens without dynamic safe area handling. */
  authScreenTopPadding: 52,
  /** Tab bar content height excluding bottom safe area (system nav / home indicator). */
  tabBarContentHeight: Platform.select({ ios: 49, android: 56, default: 56 }) ?? 56,
} as const

/** Total tab bar height including bottom safe area inset. */
export function tabBarHeight(bottomInset: number): number {
  return Layout.tabBarContentHeight + bottomInset
}

/** Top padding for scrollable screen content below the status bar. */
export function screenTopPadding(safeAreaTop: number, min = 16): number {
  return Math.max(safeAreaTop, min) + Layout.screenTopExtra
}
