import { useState } from 'react'
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useRouter, type Href } from 'expo-router'

import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

type CreateFabProps = {
  bottom?: number
  right?: number
}

const FAB_SIZE = 56
const FAB_GAP_ABOVE_TAB_BAR = 6

export function CreateFab({ bottom, right = 20 }: CreateFabProps) {
  const router = useRouter()
  const tabBarHeight = useBottomTabBarHeight()
  const [open, setOpen] = useState(false)
  const bottomOffset = bottom ?? tabBarHeight + FAB_GAP_ABOVE_TAB_BAR

  const navigate = (href: Href) => {
    Keyboard.dismiss()
    setOpen(false)
    // Esperar a que el modal del menú cierre para que iOS no reasigne el foco a un TextInput.
    setTimeout(() => {
      router.push(href)
    }, 50)
  }

  return (
    <>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdropContainer}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.menuWrap, { bottom: bottomOffset + FAB_SIZE + 8, right }]}>
            <View style={styles.menu}>
              <Pressable
                style={styles.menuItem}
                onPress={() => navigate('/(tabs)/matches/create')}
                accessibilityRole="button"
                accessibilityLabel="Crear partida">
                <Text style={styles.menuText}>Crear partida</Text>
              </Pressable>
              <Pressable
                style={[styles.menuItem, styles.menuItemLast]}
                onPress={() => navigate('/(tabs)/tournaments/create')}
                accessibilityRole="button"
                accessibilityLabel="Organizar torneo">
                <Text style={styles.menuText}>Organizar torneo</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={[styles.wrap, { bottom: bottomOffset, right }]} pointerEvents="box-none">
        <Pressable
          style={[styles.fab, open && styles.fabOpen]}
          onPress={() => setOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Cerrar menú de creación' : 'Abrir menú de creación'}>
          <Text style={styles.fabIcon}>{open ? '×' : '+'}</Text>
        </Pressable>
      </View>
    </>
  )
}

const webFixedBackdrop = { position: 'fixed' } as unknown as ViewStyle

const styles = StyleSheet.create({
  backdropContainer: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    ...(Platform.OS === 'web' ? webFixedBackdrop : null),
  },
  menuWrap: {
    position: 'absolute',
    alignItems: 'flex-end',
  },
  menu: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 180,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuText: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: Colors.textPrimary,
  },
  wrap: {
    position: 'absolute',
    zIndex: 10,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  fabOpen: {
    backgroundColor: Colors.textSecondary,
    borderColor: Colors.textSecondary,
  },
  fabIcon: {
    color: Colors.white,
    fontSize: 28,
    lineHeight: 32,
    fontFamily: Fonts.regular,
    fontWeight: '300',
  },
})
