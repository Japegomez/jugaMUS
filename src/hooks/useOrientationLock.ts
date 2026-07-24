import { useCallback, useEffect } from 'react'
import { Platform } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import * as ScreenOrientation from 'expo-screen-orientation'

import { acquireOrientationLock } from '@/lib/orientationLock'

type UseOrientationLockOptions = {
  /**
   * `focused` (default): libera el lock al perder el foco (pantallas en Tabs que
   * siguen montadas). `mounted`: hasta desmontar (p. ej. root layout).
   */
  while?: 'focused' | 'mounted'
}

/**
 * Solicita un bloqueo de orientación.
 * Usa un coordinador compartido para que root (portrait) y pantallas landscape
 * no peleen entre sí. En web es un no-op.
 */
export function useOrientationLock(
  lock: ScreenOrientation.OrientationLock,
  ownerId: string,
  options?: UseOrientationLockOptions
) {
  const whileMode = options?.while ?? 'focused'

  useEffect(() => {
    if (Platform.OS === 'web' || whileMode !== 'mounted') return
    return acquireOrientationLock(ownerId, lock)
  }, [lock, ownerId, whileMode])

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web' || whileMode !== 'focused') return
      return acquireOrientationLock(ownerId, lock)
    }, [lock, ownerId, whileMode])
  )
}
