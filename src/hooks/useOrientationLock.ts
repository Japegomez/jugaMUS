import { useEffect } from 'react'
import { Platform } from 'react-native'
import * as ScreenOrientation from 'expo-screen-orientation'

// Restaurar la orientación se difiere para poder cancelarlo si el componente
// vuelve a montarse de inmediato (doble efecto de StrictMode / transición de
// navegación). Así se evita el parpadeo horizontal → vertical → horizontal.
let pendingRestore: ReturnType<typeof setTimeout> | null = null

function cancelPendingRestore() {
  if (pendingRestore) {
    clearTimeout(pendingRestore)
    pendingRestore = null
  }
}

/**
 * Bloquea la orientación mientras el componente está montado y restaura
 * `PORTRAIT_UP` al desmontar. En web es un no-op (la API nativa no aplica).
 */
export function useOrientationLock(lock: ScreenOrientation.OrientationLock) {
  useEffect(() => {
    if (Platform.OS === 'web') return

    cancelPendingRestore()
    void ScreenOrientation.lockAsync(lock).catch(() => {
      /* algunos dispositivos no permiten el bloqueo */
    })

    return () => {
      cancelPendingRestore()
      pendingRestore = setTimeout(() => {
        pendingRestore = null
        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(
          () => {
            /* ignore */
          }
        )
      }, 300)
    }
  }, [lock])
}
