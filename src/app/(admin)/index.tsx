import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AdminCloseBar } from '@/components/admin/AdminCloseBar'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export default function AdminDashboardScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View style={styles.root}>
      <AdminCloseBar fallbackHref={'/(tabs)/profile' as Href} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.navSection}>
          <Pressable
            style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
            onPress={() => router.push('/(admin)/reports' as Href)}
            accessibilityRole="button">
            <Text style={styles.navButtonTitle}>Moderación de reportes</Text>
            <Text style={styles.navButtonDesc}>Revisar, resolver y tomar acciones</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
            onPress={() => router.push('/(admin)/feedback' as Href)}
            accessibilityRole="button">
            <Text style={styles.navButtonTitle}>Feedback de usuarios</Text>
            <Text style={styles.navButtonDesc}>
              Sugerencias, errores y comentarios por categoría
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
            onPress={() => router.push('/(admin)/analytics' as Href)}
            accessibilityRole="button">
            <Text style={styles.navButtonTitle}>Analíticas detalladas</Text>
            <Text style={styles.navButtonDesc}>Gráficas, ciudades y ranking de usuarios</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    flexGrow: 1,
    padding: 20,
  },
  navSection: { gap: 12 },
  navButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  navButtonPressed: { opacity: 0.85 },
  navButtonTitle: {
    fontSize: 17,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
  },
  navButtonDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
})
