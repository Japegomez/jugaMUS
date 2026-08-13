import { StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'

import type { TurnstileWidgetProps } from '@/components/auth/TurnstileWidget.types'
import {
  CAPTCHA_WIDGET_ERROR_MESSAGE,
  getTurnstileSiteKey,
  getTurnstileWebViewSource,
  parseTurnstileWebViewMessage,
} from '@/lib/turnstile'

export type { TurnstileWidgetProps }

export function TurnstileWidget({ onTokenChange, onError, resetNonce = 0 }: TurnstileWidgetProps) {
  const siteKey = getTurnstileSiteKey()
  if (!siteKey) return null

  const onMessage = (event: WebViewMessageEvent) => {
    const message = parseTurnstileWebViewMessage(event.nativeEvent.data)
    if (!message) return
    if (message.type === 'token') {
      onTokenChange(message.token)
      return
    }
    onTokenChange(null)
    onError?.(CAPTCHA_WIDGET_ERROR_MESSAGE)
  }

  return (
    <View style={styles.wrap} accessibilityLabel="Verificación de seguridad">
      <WebView
        key={resetNonce}
        source={getTurnstileWebViewSource(siteKey)}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        automaticallyAdjustContentInsets={false}
        scrollEnabled={false}
        mixedContentMode="always"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        onMessage={onMessage}
        style={styles.webview}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: 140,
    marginVertical: 8,
    overflow: 'hidden',
  },
  webview: {
    backgroundColor: 'transparent',
    height: 140,
    width: '100%',
  },
})
