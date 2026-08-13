/**
 * Metro resolves `TurnstileWidget.native.tsx` / `TurnstileWidget.web.tsx` before this file.
 * This shim exists so TypeScript can resolve `@/components/auth/TurnstileWidget`.
 */
export type { TurnstileWidgetProps } from './TurnstileWidget.types'
export { TurnstileWidget } from './TurnstileWidget.native'
