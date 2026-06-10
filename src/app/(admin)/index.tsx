import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export default function AdminDashboardScreen() {
  const router = useRouter()

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
          <Text style={styles.navButtonDesc}>Sugerencias, errores y comentarios por categoría</Text>
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
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: Colors.background,
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
