/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  const inviteHost = (
    process.env.EXPO_PUBLIC_INVITE_HOST ?? 'musapp-731e1.web.app'
  )
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')

  return {
    ...config,
    plugins: [...(config.plugins ?? []), 'expo-font'],
    ios: {
      ...config.ios,
      associatedDomains: [`applinks:${inviteHost}`],
    },
    android: {
      ...config.android,
      // Local: google-services.json in repo root (gitignored).
      // EAS Build: upload via `eas env:create` (file) as GOOGLE_SERVICES_JSON.
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: inviteHost,
              pathPrefix: '/m',
            },
            {
              scheme: 'https',
              host: inviteHost,
              pathPrefix: '/t',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  }
}
