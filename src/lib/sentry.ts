import * as Sentry from '@sentry/react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { Platform } from 'react-native'

// Expo Go no incluye el SDK nativo de Sentry; web tampoco debe usar el transporte nativo.
const useJsTransportOnly =
  Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim()

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  ...(useJsTransportOnly ? { enableNative: false } : {}),
  sendDefaultPii: true,
  // Performance monitoring (CA_MON2)
  tracesSampleRate: 0.2,
  profilesSampleRate: 0.1,
  enableAutoPerformanceTracing: true,
  enableAppStartTracking: true,
  replaysOnErrorSampleRate: 1.0,
})

export { Sentry }
