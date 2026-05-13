import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack, useRouter, useSegments } from 'expo-router'
import { useAuthStore } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

export default function RootLayout() {
  const { session, initialized } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useNotifications()

  useEffect(() => {
    useAuthStore.getState().initializeAuth()
  }, [])

  useEffect(() => {
    if (!initialized) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/matches')
    }
  }, [session, initialized, segments, router])

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  )
}
