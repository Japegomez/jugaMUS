import { useMemo } from 'react'
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native'
import { BarChart, LineChart } from 'react-native-chart-kit'

import { AdminCloseBar } from '@/components/admin/AdminCloseBar'

import {
  useAnalyticsSummary,
  useMatchesByCity,
  useMatchesByWeek,
  useUserRanking,
} from '@/hooks/useAnalytics'

const screenWidth = Dimensions.get('window').width - 40

const chartConfig = {
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(26, 95, 74, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(102, 102, 102, ${opacity})`,
  propsForDots: { r: '4', strokeWidth: '2', stroke: '#1a5f4a' },
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

export default function AdminAnalyticsScreen() {
  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary()
  const { data: byWeek, isLoading: weekLoading } = useMatchesByWeek(12)
  const { data: byCity, isLoading: cityLoading } = useMatchesByCity(10)
  const { data: ranking, isLoading: rankingLoading } = useUserRanking(20)

  const lineData = useMemo(() => {
    const rows = byWeek ?? []
    return {
      labels: rows.map((r) => {
        const d = new Date(r.week_start)
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
      }),
      datasets: [{ data: rows.length ? rows.map((r) => r.count) : [0] }],
    }
  }, [byWeek])

  const barData = useMemo(() => {
    const rows = byCity ?? []
    return {
      labels: rows.map((r) => (r.city.length > 10 ? `${r.city.slice(0, 9)}…` : r.city)),
      datasets: [{ data: rows.length ? rows.map((r) => r.count) : [0] }],
    }
  }, [byCity])

  return (
    <View style={styles.root}>
      <AdminCloseBar />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Analíticas</Text>
        {summaryLoading ? (
          <ActivityIndicator size="large" color="#1a5f4a" />
        ) : summary ? (
          <View style={styles.statsGrid}>
            <StatCard label="MAU" value={String(summary.mau)} />
            <StatCard label="Partidas" value={String(summary.total_matches)} />
            <StatCard label="% confirmados" value={`${summary.pct_confirmed}%`} />
            <StatCard label="% disputados" value={`${summary.pct_disputed}%`} />
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Partidas por semana</Text>
        {weekLoading ? (
          <ActivityIndicator color="#1a5f4a" />
        ) : (
          <LineChart
            data={lineData}
            width={screenWidth}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            yAxisLabel=""
            yAxisSuffix=""
          />
        )}

        <Text style={styles.sectionTitle}>Top ciudades</Text>
        {cityLoading ? (
          <ActivityIndicator color="#1a5f4a" />
        ) : (
          <BarChart
            data={barData}
            width={screenWidth}
            height={240}
            chartConfig={chartConfig}
            style={styles.chart}
            yAxisLabel=""
            yAxisSuffix=""
            fromZero
            showValuesOnTopOfBars
          />
        )}

        <Text style={styles.sectionTitle}>Ranking de usuarios</Text>
        {rankingLoading ? (
          <ActivityIndicator color="#1a5f4a" />
        ) : !ranking?.length ? (
          <Text style={styles.empty}>Sin datos de participación.</Text>
        ) : (
          <View style={styles.rankingCard}>
            {ranking.map((row, index) => (
              <View key={row.user_id} style={styles.rankingRow}>
                <Text style={styles.rankNum}>{index + 1}</Text>
                <Text style={styles.rankName} numberOfLines={1}>
                  {row.display_name}
                </Text>
                <Text style={styles.rankCount}>{row.match_count} partidas</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f7f4' },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  scroll: {
    flexGrow: 1,
    padding: 20,
    gap: 16,
    backgroundColor: '#f6f7f4',
    paddingBottom: 40,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    minWidth: '47%',
    flexGrow: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a5f4a',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 8,
  },
  chart: {
    borderRadius: 12,
    marginVertical: 4,
  },
  rankingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
  },
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    gap: 10,
  },
  rankNum: {
    width: 24,
    fontSize: 14,
    fontWeight: '700',
    color: '#1a5f4a',
  },
  rankName: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a1a',
  },
  rankCount: {
    fontSize: 13,
    color: '#666',
  },
  empty: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 16,
  },
})
