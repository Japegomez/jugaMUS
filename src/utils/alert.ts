import { Alert, Platform } from 'react-native'

type ConfirmAlertOptions = {
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}

/** Native-style confirm; on web uses `window.confirm` (RN Alert buttons are unreliable). */
export function confirmAlert(
  title: string,
  message: string,
  options?: ConfirmAlertOptions
): Promise<boolean> {
  const confirmText = options?.confirmText ?? 'Aceptar'
  const cancelText = options?.cancelText ?? 'Cancelar'

  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`))
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmText,
        style: options?.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ])
  })
}

export function showAlert(title: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`)
    return
  }
  Alert.alert(title, message)
}
