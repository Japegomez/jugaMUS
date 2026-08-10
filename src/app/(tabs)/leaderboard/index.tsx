import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MunicipalityPicker } from '@/components/ui/MunicipalityPicker'
import { useLeaderboard } from '@/hooks/useStats'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'

export default function LeaderboardScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [city, setCity] = useState('')
  const { data, isPending, isError, refetch } = useLeaderboard(city || null)

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace('/(tabs)/profile' as Href)
  }, [router])

  return (
    <View style={[styles.root, { paddingTop: screenTopPadding(insets.top) }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          hitSlop={8}
          style={styles.closeWrap}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Ranking ELO</Text>
        <Text style={styles.subtitle}>Clasificación por puntuación ELO</Text>

        <View style={styles.filter}>
          <MunicipalityPicker
            label="Filtrar por ciudad"
            value={city}
            onChangeText={setCity}
            placeholder="Todas las ciudades"
          />
          {city ? (
            <Pressable onPress={() => setCity('')} style={styles.clearBtn}>
              <Text style={styles.clearText}>Quitar filtro</Text>
            </Pressable>
          ) : null}
        </View>

        {isPending ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} /> : null}

        {isError ? (
          <Pressable onPress={() => void refetch()} style={styles.errorBox}>
            <Text style={styles.errorText}>No se pudo cargar. Toca para reintentar.</Text>
          </Pressable>
        ) : null}

        {!isPending && !isError ? (
          <View style={styles.card}>
            {(data ?? []).length === 0 ? (
              <Text style={styles.empty}>Aún no hay jugadores en el ranking</Text>
            ) : (
              (data ?? []).map((entry, index) => (
                <Pressable
                  key={entry.user_id}
                  onPress={() => router.push(`/(tabs)/profile/${entry.user_id}` as Href)}
                  style={[styles.row, index === (data?.length ?? 0) - 1 && styles.rowLast]}>
                  <Text style={styles.rank}>{index + 1}</Text>
                  <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>
                      {entry.display_name}
                    </Text>
                    <Text style={styles.meta}>
                      {`${entry.city ?? '—'} · ${entry.wins}G/${entry.matches_played} · ${entry.win_rate}%`}
                    </Text>
                  </View>
                  <Text style={styles.elo}>{entry.elo_rating}</Text>
                </Pressable>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16 },
  closeWrap: { alignSelf: 'flex-end', padding: 8 },
  close: { fontSize: 22, color: Colors.textSecondary, padding: 8 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    gap: 12,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  filter: {
    gap: 8,
  },
  clearBtn: {
    alignSelf: 'flex-start',
  },
  clearText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.primary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rank: {
    width: 28,
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.primary,
  },
  info: {
    flex: 1,
  },
  name: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  meta: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  elo: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.primary,
  },
  empty: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  errorBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  errorText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.danger,
    textAlign: 'center',
  },
})
