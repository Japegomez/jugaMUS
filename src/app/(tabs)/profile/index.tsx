import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'

import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'

function AvatarCircle({ uri, name }: { uri: string | null; name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  if (uri) {
    return <Image source={{ uri }} style={styles.avatar} />
  }

  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarInitials}>{initials || '?'}</Text>
    </View>
  )
}

export default function ProfileScreen() {
  const router = useRouter()
  const signOut = useAuthStore((s) => s.signOut)
  const sessionUserId = useAuthStore((s) => s.session?.user.id)
  const { data: profile, isLoading, isError } = useProfile(sessionUserId)
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

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a5f4a" />
      </View>
    )
  }

  if (isError || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No se pudo cargar el perfil.</Text>
        <Button
          title="Cerrar sesión"
          variant="outline"
          onPress={onSignOut}
          style={styles.signOutBtn}
          textStyle={styles.signOutLabel}
        />
      </View>
    )
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <AvatarCircle uri={profile.photo_url} name={profile.display_name} />
        <Text style={styles.displayName}>{profile.display_name}</Text>
        {profile.city ? <Text style={styles.city}>{profile.city}</Text> : null}
      </View>

      {/* Info rows */}
      <View style={styles.card}>
        <InfoRow label="Teléfono" value={profile.phone_e164 || '—'} />
      </View>

      {/* Notification prefs */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notificaciones</Text>
        <NotifRow label="Correo electrónico" value={profile.notify_email} />
        <NotifRow label="Push" value={profile.notify_push} />
      </View>

      {/* Actions */}
      <Pressable
        style={styles.editButton}
        onPress={() => router.push('/(tabs)/profile/edit')}
        accessibilityRole="button">
        <Text style={styles.editButtonText}>Editar perfil</Text>
      </Pressable>

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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

function NotifRow({ label, value }: { label: string; value: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Switch
        value={value}
        disabled
        thumbColor={value ? '#1a5f4a' : '#ccc'}
        trackColor={{ true: '#a8d5c2', false: '#e0e0e0' }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
    backgroundColor: '#f6f7f4',
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f6f7f4',
    gap: 16,
  },
  errorText: {
    fontSize: 15,
    color: '#666',
  },
  header: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#ddd',
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1a5f4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 4,
  },
  city: {
    fontSize: 15,
    color: '#555',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  infoLabel: {
    fontSize: 15,
    color: '#333',
  },
  infoValue: {
    fontSize: 15,
    color: '#555',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  editButton: {
    backgroundColor: '#1a5f4a',
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutBtn: {
    borderColor: '#b42318',
  },
  signOutLabel: {
    color: '#b42318',
  },
})
