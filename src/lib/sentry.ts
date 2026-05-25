import * as Sentry from '@sentry/react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { Platform } from 'react-native'

// Expo Go no incluye el SDK nativo de Sentry; web tampoco debe usar el transporte nativo.
const useJsTransportOnly =
  Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim()

const SENSITIVE_HEADER_KEYS = new Set(['authorization', 'apikey', 'x-api-key', 'cookie'])

function redactHeaders(
  headers: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!headers) return headers
  const redacted: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = SENSITIVE_HEADER_KEYS.has(key.toLowerCase()) ? '[Filtered]' : value
  }
  return redacted
}

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  ...(useJsTransportOnly ? { enableNative: false } : {}),
  sendDefaultPii: false,
  tracesSampleRate: 0.2,
  profilesSampleRate: 0.1,
  enableAutoPerformanceTracing: true,
  enableAppStartTracking: true,
  replaysOnErrorSampleRate: 0.1,
  beforeSend(event) {
    if (event.request?.headers) {
      event.request.headers = redactHeaders(
        event.request.headers as Record<string, string>
      ) as typeof event.request.headers
    }
    return event
  },
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
      const data = breadcrumb.data as Record<string, unknown> | undefined
      if (data?.headers && typeof data.headers === 'object') {
        data.headers = redactHeaders(data.headers as Record<string, string>)
      }
    }
    return breadcrumb
  },
})

export { Sentry }
