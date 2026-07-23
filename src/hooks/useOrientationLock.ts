import { useEffect } from 'react'
import { Platform } from 'react-native'
import * as ScreenOrientation from 'expo-screen-orientation'

import { acquireOrientationLock } from '@/lib/orientationLock'

/**
 * Solicita un bloqueo de orientación mientras el componente está montado.
 * Usa un coordinador compartido para que root (portrait) y pantallas landscape
 * no peleen entre sí ni provoquen parpadeos al navegar.
 * En web es un no-op.
 */
export function useOrientationLock(lock: ScreenOrientation.OrientationLock, ownerId: string) {
  useEffect(() => {
    if (Platform.OS === 'web') return
    return acquireOrientationLock(ownerId, lock)
  }, [lock, ownerId])
}
