import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'

import { useAnalyticsSummary } from '@/hooks/useAnalytics'

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

export default function AdminDashboardScreen() {
  const router = useRouter()
  const { data: summary, isLoading, isError } = useAnalyticsSummary()

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.subtitle}>Resumen de la plataforma</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color="#1a5f4a" style={styles.loader} />
      ) : isError || !summary ? (
        <Text style={styles.errorText}>No se pudieron cargar las métricas.</Text>
      ) : (
        <View style={styles.statsGrid}>
          <StatCard label="MAU (30 días)" value={String(summary.mau)} />
          <StatCard label="Partidas totales" value={String(summary.total_matches)} />
          <StatCard label="Esta semana" value={String(summary.matches_this_week)} />
          <StatCard label="% confirmados" value={`${summary.pct_confirmed}%`} />
          <StatCard label="% disputados" value={`${summary.pct_disputed}%`} />
        </View>
      )}

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
    gap: 20,
    backgroundColor: '#f6f7f4',
  },
  subtitle: {
    fontSize: 15,
    color: '#555',
  },
  loader: { marginVertical: 24 },
  errorText: {
    fontSize: 15,
    color: '#b42318',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    minWidth: '47%',
    flexGrow: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a5f4a',
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
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
