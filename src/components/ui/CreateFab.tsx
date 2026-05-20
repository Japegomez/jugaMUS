import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'

type CreateFabProps = {
  bottom?: number
  right?: number
}

export function CreateFab({ bottom = 28, right = 24 }: CreateFabProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const navigate = (href: Href) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      {open ? (
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Cerrar menú"
        />
      ) : null}

      <View style={[styles.wrap, { bottom, right }]} pointerEvents="box-none">
        {open ? (
          <View style={styles.menu}>
            <Pressable
              style={styles.menuItem}
              onPress={() => navigate('/(tabs)/matches/create')}
              accessibilityRole="button"
              accessibilityLabel="Crear partida">
              <Text style={styles.menuText}>Crear partida</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => navigate('/(tabs)/tournaments/create')}
              accessibilityRole="button"
              accessibilityLabel="Organizar torneo">
              <Text style={styles.menuText}>Organizar torneo</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          style={[styles.fab, open && styles.fabOpen]}
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Cerrar menú de creación' : 'Abrir menú de creación'}>
          <Text style={styles.fabIcon}>{open ? '×' : '+'}</Text>
        </Pressable>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: Platform.select({
    web: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9,
    },
    default: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 9,
    },
  }),
  wrap: {
    position: 'absolute',
    alignItems: 'flex-end',
    zIndex: 10,
  },
  menu: {
    marginBottom: 12,
    gap: 8,
    alignItems: 'flex-end',
  },
  menuItem: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1a5f4a',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  menuText: { fontSize: 15, fontWeight: '600', color: '#1a5f4a' },
  fab: {
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
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  fabOpen: { backgroundColor: '#555' },
  fabIcon: { color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '300' },
})
