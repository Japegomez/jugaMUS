/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  plugins: [...(config.plugins ?? []), 'expo-font'],
  android: {
    ...config.android,
    // Local: google-services.json in repo root (gitignored).
    // EAS Build: upload via `eas env:create` (file) as GOOGLE_SERVICES_JSON.
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
