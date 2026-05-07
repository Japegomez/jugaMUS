import { View, Text, StyleSheet } from 'react-native'

export default function MatchesScreen() {
  return (
    <View style={styles.container}>
      <Text>Listado de partidas — próximamente</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
