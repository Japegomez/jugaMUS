import { QueryClient } from '@tanstack/react-query'

/** Shared React Query client (used outside React for post-auth cache updates). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})
