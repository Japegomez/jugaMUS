import { Alert, Linking, Platform } from 'react-native'
import * as StoreReview from 'expo-store-review'

/** Opens in-app review or falls back to the store listing URL. */
export async function requestAppStoreRating(): Promise<void> {
  if (Platform.OS === 'web') {
    Alert.alert('Valorar app', 'La valoración en tienda solo está disponible en la app móvil.')
    return
  }

  if (await StoreReview.isAvailableAsync()) {
    await StoreReview.requestReview()
    return
  }

  const url = StoreReview.storeUrl()
  if (url && (await Linking.canOpenURL(url))) {
    await Linking.openURL(url)
    return
  }

  Alert.alert(
    'Valorar app',
    Platform.OS === 'ios'
      ? 'La valoración integrada no está disponible en pruebas (TestFlight). Cuando la app esté publicada en la App Store podrás valorarla desde aquí o desde la ficha de la app.'
      : 'No se pudo abrir la valoración integrada. Si usas una versión de prueba, valora la app cuando esté publicada en Google Play.'
  )
}
