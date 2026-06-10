import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Redirect, Stack } from 'expo-router'

import { useAuthStore } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export default function AdminLayout() {
  const initialized = useAuthStore((s) => s.initialized)
  const sessionUserId = useAuthStore((s) => s.session?.user.id)
  const { data: profile, isLoading, isError, isFetched } = useProfile(sessionUserId)

  if (initialized && !sessionUserId) {
    return <Redirect href="/(auth)/login" />
  }

  if (initialized && isFetched && !isLoading && (isError || profile?.role !== 'admin')) {
    return <Redirect href="/(tabs)/matches" />
  }

  return (
    <View style={styles.root}>
      <Stack
        screenOptions={{
          headerShown: true,
          headerTintColor: Colors.primary,
          headerStyle: { backgroundColor: Colors.background },
          headerTitleStyle: { fontFamily: Fonts.semiBold },
        }}>
        <Stack.Screen name="index" options={{ title: 'Administración' }} />
        <Stack.Screen name="reports" options={{ headerShown: false }} />
        <Stack.Screen name="feedback" options={{ headerShown: false }} />
        <Stack.Screen name="analytics" options={{ headerShown: false }} />
      </Stack>
      {(!initialized || isLoading || profile?.role !== 'admin') && (
        <View style={styles.accessOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  accessOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
})
