import { Platform, StyleSheet } from 'react-native'
import { Tabs } from 'expo-router'
import { PlatformPressable } from '@react-navigation/elements'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs'

import { Colors } from '@/theme/colors'
import { tabBarHeight } from '@/theme/layout'
import { Fonts } from '@/theme/typography'

const VISIBLE_TAB_OPTIONS = {
  tabBarIcon: () => null,
} as const

function TabBarButton(props: BottomTabBarButtonProps) {
  const focused = props.accessibilityState?.selected === true

  return (
    <PlatformPressable
      {...props}
      style={[styles.tabBarButton, props.style, focused && styles.tabBarButtonActive]}>
      {props.children}
    </PlatformPressable>
  )
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const bottomInset = insets.bottom
  const androidBottomInset = Platform.OS === 'android' ? Math.max(bottomInset, 12) : bottomInset

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: true,
        tabBarButton: (props) => <TabBarButton {...props} />,
        tabBarIcon: () => null,
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.border,
          paddingTop: Platform.OS === 'android' ? 4 : 0,
          paddingBottom: androidBottomInset,
          height: tabBarHeight(androidBottomInset),
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.medium,
          fontSize: 12,
          marginBottom: Platform.OS === 'android' ? 6 : 0,
        },
        tabBarIconStyle: {
          width: 0,
          height: 0,
          display: 'none',
        },
      }}>
      <Tabs.Screen name="explore/index" options={{ title: 'Descubrir', ...VISIBLE_TAB_OPTIONS }} />
      <Tabs.Screen
        name="matches/index"
        options={{ title: 'Mis partidas', ...VISIBLE_TAB_OPTIONS }}
      />
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
      <Tabs.Screen name="profile/index" options={{ title: 'Perfil', ...VISIBLE_TAB_OPTIONS }} />
      <Tabs.Screen name="profile/[userId]" options={{ href: null }} />
      <Tabs.Screen name="profile/edit" options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBarButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
    marginHorizontal: 4,
    borderRadius: 10,
    minHeight: 40,
  },
  tabBarButtonActive: {
    backgroundColor: Colors.tabBarActiveBackground,
  },
})
