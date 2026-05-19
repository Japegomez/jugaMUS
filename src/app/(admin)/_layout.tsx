import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'

import { useAuthStore } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'

export default function AdminLayout() {
  const router = useRouter()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)
  const { data: profile, isLoading, isError } = useProfile(sessionUserId)

  useEffect(() => {
    if (isLoading) return
    if (!sessionUserId || isError || !profile || profile.role !== 'admin') {
      router.replace('/(tabs)/matches')
    }
  }, [isLoading, isError, profile, sessionUserId, router])

  if (isLoading || !profile || profile.role !== 'admin') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a5f4a" />
      </View>
    )
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: '#1a5f4a',
        headerStyle: { backgroundColor: '#f6f7f4' },
        headerTitleStyle: { fontWeight: '600' },
      }}>
      <Stack.Screen name="index" options={{ title: 'Administración' }} />
      <Stack.Screen name="reports" options={{ title: 'Reportes' }} />
      <Stack.Screen name="analytics" options={{ title: 'Analíticas' }} />
    </Stack>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f7f4',
  },
})
