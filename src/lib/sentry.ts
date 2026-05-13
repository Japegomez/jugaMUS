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
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})

export { Sentry }
