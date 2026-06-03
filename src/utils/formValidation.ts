import { showAlert } from '@/utils/alert'

export const FORM_FIELDS_MISSING_ALERT = {
  title: 'Campos incompletos',
  message: 'Revisa los campos marcados en rojo y complétalos antes de continuar.',
} as const

export function showFormFieldsMissingAlert(): void {
  showAlert(FORM_FIELDS_MISSING_ALERT.title, FORM_FIELDS_MISSING_ALERT.message)
}
