import { Tabs } from 'expo-router'

import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.border,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.medium,
          fontSize: 11,
        },
      }}>
      <Tabs.Screen name="explore/index" options={{ title: 'Descubrir' }} />
      <Tabs.Screen name="matches/index" options={{ title: 'Mis partidas' }} />
      <Tabs.Screen name="matches/create" options={{ href: null }} />
      <Tabs.Screen name="matches/[id]" options={{ href: null }} />
      <Tabs.Screen name="matches/edit/[id]" options={{ href: null }} />
      <Tabs.Screen
        name="matches/scoreboard/[id]"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen name="tournaments/create" options={{ href: null }} />
      <Tabs.Screen name="tournaments/[id]" options={{ href: null }} />
      <Tabs.Screen name="tournaments/edit/[id]" options={{ href: null }} />
      <Tabs.Screen name="profile/index" options={{ title: 'Perfil' }} />
      <Tabs.Screen name="profile/edit" options={{ href: null }} />
    </Tabs>
  )
}
