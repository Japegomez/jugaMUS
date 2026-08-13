import { StyleSheet, View } from 'react-native'
import { Turnstile } from '@marsidev/react-turnstile'

import type { TurnstileWidgetProps } from '@/components/auth/TurnstileWidget.types'
import { CAPTCHA_WIDGET_ERROR_MESSAGE, getTurnstileSiteKey } from '@/lib/turnstile'

export type { TurnstileWidgetProps }

export function TurnstileWidget({ onTokenChange, onError, resetNonce = 0 }: TurnstileWidgetProps) {
  const siteKey = getTurnstileSiteKey()
  if (!siteKey) return null

  return (
    <View style={styles.wrap} accessibilityLabel="Verificación de seguridad">
      <Turnstile
        key={resetNonce}
        siteKey={siteKey}
        options={{ theme: 'light', size: 'normal', language: 'es' }}
        onSuccess={(token) => onTokenChange(token)}
        onExpire={() => onTokenChange(null)}
        onTimeout={() => {
          onTokenChange(null)
          onError?.(CAPTCHA_WIDGET_ERROR_MESSAGE)
        }}
        onError={() => {
          onTokenChange(null)
          onError?.(CAPTCHA_WIDGET_ERROR_MESSAGE)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 8,
    minHeight: 70,
  },
})
