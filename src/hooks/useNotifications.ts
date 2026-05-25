import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import type { Subscription } from 'expo-notifications'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/hooks/useAuth'
import { Colors } from '@/theme/colors'

// How incoming notifications behave while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications are only available on physical devices
  if (!Device.isDevice) {
    console.warn('[useNotifications] Push notifications require a physical device.')
    return null
  }

  // Android requires an explicit notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notificaciones',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: `${Colors.danger}7C`,
    })
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.warn('[useNotifications] Push notification permission denied.')
    return null
  }

  // projectId is required for Expo Go and standalone builds
  const expoConfig = (global as Record<string, unknown>).__expoConfig as
    | { extra?: { eas?: { projectId?: string } } }
    | undefined
  const projectId = expoConfig?.extra?.eas?.projectId

  const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)

  return tokenData.data
}

async function savePushToken(token: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')

  if (error) {
    console.error('[useNotifications] Failed to save push token:', error.message)
  }
}

/**
 * Registers the device for Expo push notifications, saves the token to the
 * user's profile, and returns subscription references for cleanup.
 *
 * Must be called inside an authenticated context (session must be active).
 */
export function useNotifications() {
  const { session } = useAuthStore()
  const notificationListener = useRef<Subscription | null>(null)
  const responseListener = useRef<Subscription | null>(null)

  useEffect(() => {
    if (!session) return

    let cancelled = false

    registerForPushNotificationsAsync()
      .then((token) => {
        if (!cancelled && token) {
          savePushToken(token)
        }
      })
      .catch((err) => console.error('[useNotifications] registration error:', err))

    // Listener for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Foreground notifications are handled by the OS banner.
    })

    // Listener for when the user taps a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>
      void data
      // Navigation to specific match can be wired here via expo-router:
      //   if (data?.match_id) router.push(`/(tabs)/matches/${data.match_id}`)
    })

    return () => {
      cancelled = true
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [session])
}
