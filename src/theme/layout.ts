export const Layout = {
  /** Extra space below the safe area (or minimum inset). */
  screenTopExtra: 12,
  /** Fixed top padding for auth screens without dynamic safe area handling. */
  authScreenTopPadding: 52,
} as const

/** Top padding for scrollable screen content below the status bar. */
export function screenTopPadding(safeAreaTop: number, min = 16): number {
  return Math.max(safeAreaTop, min) + Layout.screenTopExtra
}
