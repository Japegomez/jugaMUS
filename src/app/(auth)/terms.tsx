import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { Button } from '@/components/ui/Button'

export default function TermsScreen() {
  const router = useRouter()

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Términos y Condiciones</Text>
      <Text style={styles.p}>
        Texto legal definitivo pendiente de revisión jurídica. Al usar Mus Sin Fronteras te
        comprometes a respetar a otros jugadores y a usar la app de forma responsable.
      </Text>
      <Text style={styles.p}>
        Esta pantalla se ampliará con las condiciones completas del servicio antes del lanzamiento
        público.
      </Text>
      <View style={styles.actions}>
        <Button title="Volver" variant="outline" onPress={() => router.back()} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  p: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
    color: '#333',
  },
  actions: {
    marginTop: 24,
  },
})
