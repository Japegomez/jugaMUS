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
import { useOrientationLock } from '@/hooks/useOrientationLock'
import * as ScreenOrientation from 'expo-screen-orientation'
import { useAuthStore } from '@/hooks/useAuth'
import { AppRatingPromptHost } from '@/components/AppRatingPromptHost'
import { useBackgroundSessionTimeout } from '@/hooks/useBackgroundSessionTimeout'
import { useExploreListsRealtimeSync } from '@/hooks/useExploreListsRealtimeSync'
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
  const { session, initialized, passwordRecoveryPending } = useAuthStore()
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
  useBackgroundSessionTimeout()
  useOrientationLock(ScreenOrientation.OrientationLock.PORTRAIT_UP)

  useEffect(() => {
    useAuthStore.getState().initializeAuth()
  }, [])

  useEffect(() => {
    if (!initialized) return
    if (!navigationState?.key) return

    const routePath = segments.join('/')
    const inAuthGroup = routePath.startsWith('(auth)')
    const inOAuthCallback = routePath === 'auth/callback'
    const inPasswordUpdate = routePath === 'auth/update-password'
    const inAuthLegal = routePath === '(auth)/terms' || routePath === '(auth)/privacy'

    const timeoutId = setTimeout(() => {
      if (inOAuthCallback || inPasswordUpdate) return

      if (session && passwordRecoveryPending) {
        router.replace('/auth/update-password')
        return
      }

      if (!session && !inAuthGroup) {
        router.replace('/(auth)/login')
      } else if (session && inAuthGroup && !inAuthLegal) {
        router.replace('/(tabs)/matches')
      }
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [session, initialized, passwordRecoveryPending, segments, navigationState?.key, router])

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
        <AppQueryScope />
        <AppRatingPromptHost />
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </PostHogProvider>
  )
}

/** Hooks that need QueryClientProvider (Realtime list sync). */
function AppQueryScope() {
  useExploreListsRealtimeSync()
  return null
}

export default Sentry.wrap(RootLayout)
