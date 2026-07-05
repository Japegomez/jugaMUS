import { useEffect } from 'react'
import { Platform } from 'react-native'
import * as ScreenOrientation from 'expo-screen-orientation'

/**
 * Bloquea la orientación mientras el componente está montado y restaura
 * `PORTRAIT_UP` al desmontar. En web es un no-op (la API nativa no aplica).
 */
export function useOrientationLock(lock: ScreenOrientation.OrientationLock) {
  useEffect(() => {
    if (Platform.OS === 'web') return

    void ScreenOrientation.lockAsync(lock).catch(() => {
      /* algunos dispositivos no permiten el bloqueo */
    })

    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {
        /* ignore */
      })
    }
  }, [lock])
}
