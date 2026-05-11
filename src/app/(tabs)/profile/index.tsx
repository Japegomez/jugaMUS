import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/hooks/useAuth'

export default function ProfileScreen() {
  const signOut = useAuthStore((s) => s.signOut)
  const [signingOut, setSigningOut] = useState(false)

  const onSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo cerrar sesión'
      Alert.alert('Cerrar sesión', message)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Perfil</Text>
      <Text style={styles.sub}>Próximamente más opciones aquí.</Text>

      <View style={styles.spacer} />

      <Button
        title="Cerrar sesión"
        variant="outline"
        loading={signingOut}
        onPress={onSignOut}
        style={styles.signOutBtn}
        textStyle={styles.signOutLabel}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
    backgroundColor: '#f6f7f4',
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a5f4a',
    marginBottom: 8,
  },
  sub: {
    fontSize: 16,
    color: '#444',
  },
  spacer: { flex: 1, minHeight: 24 },
  signOutBtn: {
    borderColor: '#b42318',
  },
  signOutLabel: {
    color: '#b42318',
  },
})
