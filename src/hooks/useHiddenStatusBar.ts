import { useEffect } from 'react'
import { Platform, StatusBar } from 'react-native'

/**
 * Oculta la barra de estado del sistema mientras el componente está montado
 * (hora, batería, cobertura). Útil en el marcador landscape a pantalla completa.
 */
export function useHiddenStatusBar() {
  useEffect(() => {
    if (Platform.OS === 'web') return

    StatusBar.setHidden(true, 'fade')
    return () => {
      StatusBar.setHidden(false, 'fade')
    }
  }, [])
}
