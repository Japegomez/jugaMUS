// Sentry debe cargarse antes que el resto de módulos de la app.
import { Sentry } from '@/lib/sentry'
import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router'
import { PostHogProvider } from 'posthog-react-native'
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  useFonts,
} from '@expo-google-fonts/dm-sans'
import * as SplashScreen from 'expo-splash-screen'
import { useAuthStore } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { posthog } from '@/lib/posthog'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

function RootLayout() {
  const { session, initialized } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()
  const navigationState = useRootNavigationState()
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  })

  useNotifications()

  useEffect(() => {
    useAuthStore.getState().initializeAuth()
  }, [])

  useEffect(() => {
    if (!initialized) return
    if (!navigationState?.key) return

    const inAuthGroup = segments[0] === '(auth)'

    // Defer until the root Stack is mounted (avoids crash on web hard refresh).
    const timeoutId = setTimeout(() => {
      if (!session && !inAuthGroup) {
        router.replace('/(auth)/login')
      } else if (session && inAuthGroup) {
        router.replace('/(tabs)/matches')
      }
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [session, initialized, segments, navigationState?.key, router])

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded])

  if (!fontsLoaded) {
    return null
  }

  return (
    <PostHogProvider client={posthog}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </PostHogProvider>
  )
}

export default Sentry.wrap(RootLayout)
