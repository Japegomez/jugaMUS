import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

export default function MatchesScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <Text style={styles.empty}>
        Crea una partida o explora las públicas en la pestaña Descubrir.
      </Text>

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(tabs)/matches/create')}
        accessibilityRole="button"
        accessibilityLabel="Crear partida">
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7f4' },
  empty: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 15,
    color: '#999',
    paddingTop: '50%',
    paddingHorizontal: 24,
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a5f4a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  fabIcon: { color: '#fff', fontSize: 28, lineHeight: 32 },
})
