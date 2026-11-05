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

  const source = getTurnstileWebViewSource(siteKey)
  const webSource = 'uri' in source ? { uri: `${source.uri}&v=${resetNonce + 1}` } : source

  return (
    <View style={styles.wrap} accessibilityLabel="Verificación de seguridad">
      <WebView
        key={resetNonce}
        source={webSource}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled={false}
        startInLoadingState
        automaticallyAdjustContentInsets={false}
        scrollEnabled
        mixedContentMode="always"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={() => true}
        onMessage={onMessage}
        onHttpError={() => onError?.(CAPTCHA_WIDGET_ERROR_MESSAGE)}
        onError={() => onError?.(CAPTCHA_WIDGET_ERROR_MESSAGE)}
        style={styles.webview}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: 220,
    marginVertical: 8,
    overflow: 'hidden',
  },
  webview: {
    backgroundColor: 'transparent',
    height: 220,
    width: '100%',
  },
})
