const appJson = require('./app.json');

/** @type {import('expo/config').ExpoConfig} */
module.exports = () => {
  const expo = appJson.expo;

  return {
    ...expo,
    android: {
      ...expo.android,
      // Local: google-services.json in repo root (gitignored).
      // EAS Build: upload via `eas env:create` (file) as GOOGLE_SERVICES_JSON.
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
  };
};
