import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { Button } from '@/components/ui/Button'

export default function PrivacyScreen() {
  const router = useRouter()

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Política de privacidad</Text>
      <Text style={styles.p}>
        Texto legal definitivo pendiente de revisión jurídica. Tratamos tus datos personales de
        acuerdo con el RGPD y solo para los fines descritos en el registro de actividades de
        tratamiento del proyecto.
      </Text>
      <Text style={styles.p}>
        Proveedores: Supabase (hosting de datos y autenticación), Expo/EAS para builds y
        distribución. Esta política se detallará antes del lanzamiento público.
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
