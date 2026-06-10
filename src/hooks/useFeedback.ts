import { useMutation } from '@tanstack/react-query'

import { useAuthStore } from '@/hooks/useAuth'
import { submitFeedback, type FeedbackCategory } from '@/services/feedback.service'

export type SubmitFeedbackPayload = {
  category: FeedbackCategory
  message: string
}

export function useSubmitFeedback() {
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: (payload: SubmitFeedbackPayload) => {
      if (!sessionUserId) throw new Error('No autenticado')
      return submitFeedback({ ...payload, userId: sessionUserId })
    },
  })
}
