import { View, Text, StyleSheet } from 'react-native'

export default function CreateMatchScreen() {
  return (
    <View style={styles.container}>
      <Text>Crear partida — próximamente</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
