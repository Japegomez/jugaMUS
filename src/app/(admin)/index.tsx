import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'

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
    backgroundColor: '#f6f7f4',
  },
  navSection: { gap: 12 },
  navButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e8e4',
  },
  navButtonPressed: { opacity: 0.85 },
  navButtonTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  navButtonDesc: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
})
