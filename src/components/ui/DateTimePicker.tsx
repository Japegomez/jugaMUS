/**
 * Metro resolves `DateTimePicker.native.tsx` / `DateTimePicker.web.tsx` before this file.
 * This shim exists so TypeScript can resolve `@/components/ui/DateTimePicker`.
 */
export type { DateTimePickerProps } from './DateTimePicker.types'
export { DateTimePicker } from './DateTimePicker.native'
