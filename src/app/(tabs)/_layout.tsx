import { Tabs } from 'expo-router'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
      }}>
      <Tabs.Screen name="explore/index" options={{ title: 'Descubrir' }} />
      <Tabs.Screen name="matches/index" options={{ title: 'Partidas' }} />
      <Tabs.Screen name="matches/create" options={{ href: null }} />
      <Tabs.Screen name="matches/[id]" options={{ href: null }} />
      <Tabs.Screen name="matches/edit/[id]" options={{ href: null }} />
      <Tabs.Screen name="profile/index" options={{ title: 'Perfil' }} />
      <Tabs.Screen name="profile/edit" options={{ href: null }} />
    </Tabs>
  )
}
