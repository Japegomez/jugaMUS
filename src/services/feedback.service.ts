import { supabase } from '@/lib/supabase'

export type FeedbackCategory = 'issue' | 'feature' | 'other'

export const FEEDBACK_CATEGORIES: readonly { value: FeedbackCategory; label: string }[] = [
  { value: 'issue', label: 'Problema o error' },
  { value: 'feature', label: 'Sugerencia de función' },
  { value: 'other', label: 'Otro' },
] as const

export type SubmitFeedbackInput = {
  userId: string
  category: FeedbackCategory
  message: string
}

export function feedbackCategoryLabel(category: FeedbackCategory | string): string {
  return FEEDBACK_CATEGORIES.find((c) => c.value === category)?.label ?? category
}

export async function submitFeedback(input: SubmitFeedbackInput): Promise<void> {
  const message = input.message.trim()
  if (message.length < 10) {
    throw new Error('El mensaje debe tener al menos 10 caracteres')
  }

  const { error } = await supabase.from('user_feedback').insert({
    user_id: input.userId,
    category: input.category,
    message,
  })

  if (error) {
    throw new Error(error.message || 'No se pudo enviar el feedback')
  }
}
