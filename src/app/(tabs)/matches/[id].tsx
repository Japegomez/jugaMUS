import { View, Text, StyleSheet } from 'react-native'
import { useLocalSearchParams } from 'expo-router'

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <View style={styles.container}>
      <Text>Detalle de partida {id} — próximamente</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
