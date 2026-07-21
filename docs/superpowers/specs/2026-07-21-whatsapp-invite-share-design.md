# Design: Share match/tournament invite via WhatsApp (HTTPS)

**Date:** 2026-07-21  
**Status:** Approved for spec review  
**Scope:** Invite links for matches and tournaments, WhatsApp share, Firebase Hosting + Universal/App Links

---

## Problem

Users want to share a match or tournament sheet over WhatsApp so others can open it and join. Join still requires a registered account. Private entities require the existing password unlock modal before full view/join.

Today the app only has a custom-scheme helper (`jugamus://matches/{id}`). WhatsApp works poorly with custom schemes; HTTPS links are needed. Firebase is already used for FCM and can host the HTTPS endpoints.

## Decisions (locked)

| Topic                  | Choice                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| Link type              | HTTPS on Firebase Hosting default domain (`*.web.app` / `*.firebaseapp.com`)                    |
| No-app behavior        | Redirect straight to Play Store / App Store (no content landing page)                           |
| Who can share          | Any authenticated user who can view the sheet (after password unlock if private)                |
| What can be shared     | Matches and tournaments                                                                         |
| Private open           | Existing password modal first (`accessOnly` / grant), then join                                 |
| Post-install deep link | Out of scope (no deferred deep linking); user may need to tap the chat link again after install |

## Architecture

```
WhatsApp message (HTTPS)
        │
        ▼
Firebase Hosting
  /m/{id}, /t/{id}     ──app installed──►  jugaMUS (Universal / App Link)
  /.well-known/* (AASA / assetlinks)         → match or tournament detail
        │                                    → login first if logged out
        │                                    → password modal if private
        └──not installed──► Play / App Store redirect
```

- **Backend remains Supabase.** Hosting only serves static redirect + association files.
- **No full Expo web deploy** on Firebase for this feature.

## URL scheme

| Entity     | HTTPS path                         | In-app destination                                                                       |
| ---------- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Match      | `https://<firebase-host>/m/{uuid}` | `/(tabs)/matches/{id}` (via deep-link entry, same as today for `jugamus://matches/{id}`) |
| Tournament | `https://<firebase-host>/t/{uuid}` | `/(tabs)/tournaments/{id}` (new deep-link entry mirroring matches)                       |

Custom scheme `jugamus://…` may remain for internal/dev use; share UX uses HTTPS only.

## Firebase Hosting

Static site in the repo (e.g. `invite-hosting/`):

1. **`/m/**` and `/t/**`** — minimal HTML/JS: detect mobile OS via User-Agent and `location.replace` to:
   - Android: Play Store URL for `com.javiwacho.musapp`
   - iOS: App Store URL (existing `ascAppId` / store listing)
   - Other: optional fallback to Play Store or a single store chooser is acceptable; prefer Play as default for unknown UA
2. **`/.well-known/assetlinks.json`** — Digital Asset Links for package `com.javiwacho.musapp` and release signing cert SHA-256
3. **`/apple-app-site-association`** (and/or `.well-known/`) — `applinks` paths `/m/*`, `/t/*`; `appID` = `{AppleTeamId}.com.javiwacho.musapp`
4. Deploy with Firebase CLI to the existing Firebase project (Hosting product; same project as FCM is fine)

## Native app configuration

- Expo `app.json` / config plugins:
  - Android intent filters for `https://<firebase-host>` paths `/m/*`, `/t/*` (`autoVerify: true`)
  - iOS `associatedDomains`: `applinks:<firebase-host>`
- Rebuild native binaries required for App Links / Universal Links to take effect (EAS build).

## In-app share UX

On match detail and tournament detail (when the viewer has sheet access):

- Primary action: **Compartir por WhatsApp**
- Message body: short Spanish text (title + optional city/date) + HTTPS invite URL
- Implementation preference: open WhatsApp share URL / app; if unavailable, fall back to the system share sheet with the same payload
- Do not show share until private unlock succeeds (same gate as full sheet content)

## Receive / join flow

1. Open HTTPS → OS opens app if verified App/Universal Link; else Hosting redirects to store
2. If not authenticated → login/register, then return to the same match/tournament id
3. If `visibility === private` and no password grant (and not creator) → existing password modal
4. Public → normal sheet; join if planned and seats available
5. Invalid / missing entity → clear error and navigate to a safe list (Mis partidas / Descubrir)

## Components to add or change (indicative)

| Area                                                       | Change                                                                                                                                              |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/matchInviteLink.ts` (or rename to invite helpers) | Build HTTPS invite URLs for match and tournament from env/config host                                                                               |
| `src/app/tournaments/[id].tsx` (root)                      | Deep-link redirect entry like `src/app/matches/[id].tsx`                                                                                            |
| Match / tournament detail screens                          | Share button + WhatsApp/share helper                                                                                                                |
| `app.json`                                                 | Associated domains / intent filters                                                                                                                 |
| `invite-hosting/`                                          | Static Hosting site + well-known files                                                                                                              |
| Docs (`REQUIREMENTS.md` / `TASKS.md`)                      | Only when user asks to update docs; note share-in-social was previously out of scope — this feature narrows that exception to WhatsApp invite links |

## Out of scope

- Intermediate marketing landing page
- Deferred deep linking after first install from the store
- Hosting the full Expo web app on Firebase
- Sharing to other social networks beyond WhatsApp + system share fallback
- Changing private/public visibility rules or password RPCs
- Custom domain (can migrate later from `*.web.app`)

## Test plan

- [ ] HTTPS match link opens match detail with app installed (Android + iOS)
- [ ] HTTPS tournament link opens tournament detail with app installed
- [ ] Without app, `/m/{id}` and `/t/{id}` redirect to the correct store
- [ ] Private match/tournament shows password modal before full content
- [ ] Logged-out user: login → lands on the same entity
- [ ] WhatsApp opens with prefilled message; fallback share sheet works if WhatsApp missing
- [ ] Share hidden or blocked until private access granted
- [ ] Broken id shows error and safe navigation

## Risks / notes

- **App Links verification** needs the correct Play App Signing cert SHA-256 in `assetlinks.json` (often the Google Play App Signing key, not only the upload keystore).
- **iOS Universal Links** need the correct Apple Team ID and a Hosting response that serves AASA with `application/json` (no unexpected redirects on the AASA URL).
- Choosing store-only redirect means **first-time installers lose the entity id** until they tap the WhatsApp link again after install — accepted explicitly.
- Firebase Dynamic Links are deprecated/shutdown; do not use them.
