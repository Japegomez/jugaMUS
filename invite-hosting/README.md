# Invite Hosting (Firebase)

Static HTTPS endpoints for WhatsApp invite links:

- `https://musapp-731e1.web.app/m/{matchId}`
- `https://musapp-731e1.web.app/t/{tournamentId}`

With the app installed and App/Universal Links verified, the OS opens jugaMUS. Otherwise `redirect.html` sends the browser to Play Store / App Store.

## Setup

1. Confirm `public/.well-known/assetlinks.json` has the Play App Signing SHA-256 (already set for production signing).
2. Install Firebase CLI and log in: `npm i -g firebase-tools` then `firebase login`.
3. From this folder: `firebase deploy --only hosting`.
4. Set app env:
   - Local `.env.local`: `EXPO_PUBLIC_INVITE_HOST=musapp-731e1.web.app`
   - EAS: `eas env:create --name EXPO_PUBLIC_INVITE_HOST --value "musapp-731e1.web.app" --environment production --visibility plain`
5. Ship a new native build (EAS) so associated domains / intent filters are in the binary.

## Verify

- Android: `adb shell pm get-app-links com.javiwacho.musapp`
- iOS: open the HTTPS link on device; should open the app without Safari bounce when verified
