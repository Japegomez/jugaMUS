# Implementation Plan: WhatsApp HTTPS invite share

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development (or write failing tests first when a pure function exists). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Share match/tournament sheets via WhatsApp using HTTPS links on Firebase Hosting that open the app (Universal/App Links) or redirect to the store.

**Architecture:** Static Firebase Hosting site (`/m/{id}`, `/t/{id}` + well-known association files) + Expo associated domains/intent filters + in-app WhatsApp share button. Supabase unchanged. Spec: `docs/superpowers/specs/2026-07-21-whatsapp-invite-share-design.md`.

**Tech notes:**

- Apple Team ID (from `eas.json`): `BUT9B76X33`
- Android package: `com.javiwacho.musapp`
- App Store Connect id: `6775626292`
- Auth gate today sends post-login users to `/(tabs)/matches` (`src/app/_layout.tsx`) — invite flow needs a return-to path

---

## Chunk 1 — Invite URL helpers + unit tests

### Task 1: HTTPS invite URL builders

**Files:**

- Modify: `src/lib/matchInviteLink.ts` (expand or rename to `src/lib/inviteLinks.ts` and re-export if needed)
- Create: `src/lib/inviteLinks.test.ts`
- Modify: `.env.example` (add `EXPO_PUBLIC_INVITE_HOST`)

- [ ] **Step 1: Write failing tests**

```ts
// inviteLinks.test.ts — expected behavior
import { buildMatchHttpsInviteUrl, buildTournamentHttpsInviteUrl } from './inviteLinks'

describe('inviteLinks', () => {
  const prev = process.env.EXPO_PUBLIC_INVITE_HOST
  beforeEach(() => {
    process.env.EXPO_PUBLIC_INVITE_HOST = 'jugamus.web.app'
  })
  afterEach(() => {
    process.env.EXPO_PUBLIC_INVITE_HOST = prev
  })

  it('builds match HTTPS URL', () => {
    expect(buildMatchHttpsInviteUrl('abc-123')).toBe('https://jugamus.web.app/m/abc-123')
  })

  it('builds tournament HTTPS URL', () => {
    expect(buildTournamentHttpsInviteUrl('t-9')).toBe('https://jugamus.web.app/t/t-9')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement** `buildMatchHttpsInviteUrl` / `buildTournamentHttpsInviteUrl` reading `EXPO_PUBLIC_INVITE_HOST` (no protocol in env; always `https://`). Keep `buildMatchInviteUrl` (custom scheme) if still useful for tests/dev, or deprecate with a comment.
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Document env** in `.env.example` and note EAS `eas env:create` for production

---

## Chunk 2 — Share helper (WhatsApp + fallback)

### Task 2: `shareInviteViaWhatsApp`

**Files:**

- Create: `src/lib/shareInvite.ts`
- Create: `src/lib/shareInvite.test.ts` (pure message builder only)

- [ ] **Step 1: Write failing test for message text**

```ts
it('formats match share text with title and url', () => {
  expect(
    buildInviteShareMessage({
      kind: 'match',
      title: 'Mus viernes',
      meta: 'Madrid · 21/07 20:00',
      url: 'https://jugamus.web.app/m/1',
    })
  ).toContain('Mus viernes')
  // includes url on its own line
})
```

- [ ] **Step 2: Implement** `buildInviteShareMessage` + `shareInviteViaWhatsApp(message)`:
  - Try `Linking.openURL('whatsapp://send?text=' + encodeURIComponent(message))` (and/or `https://wa.me/?text=`)
  - On failure / `canOpenURL` false → `Share.share({ message })` from `react-native`
- [ ] **Step 3: Tests pass for message builder**

---

## Chunk 3 — Deep link entries + post-login return-to

### Task 3: Tournament deep-link redirect screen

**Files:**

- Create: `src/app/tournaments/[id].tsx` (mirror `src/app/matches/[id].tsx`)

- [ ] **Step 1:** Add redirect to `/(tabs)/tournaments/${id}` when `id` present; else `/(tabs)/matches` or explore
- [ ] **Step 2:** Manually verify with `npx uri-scheme open "jugamus://tournaments/{id}" --android` (optional smoke)

### Task 4: Preserve invite destination across login

**Files:**

- Modify: `src/hooks/useAuth.ts` (or small store) — `pendingInvitePath: string | null`
- Modify: `src/app/_layout.tsx` — before kicking logged-out users from `matches/[id]` / `tournaments/[id]` / tabs detail, save path; after login replace to pending path instead of always `/(tabs)/matches`
- Modify: `src/app/matches/[id].tsx` / new tournament entry if needed so cold-start HTTPS → redirect entry still runs inside auth gate

- [ ] **Step 1:** When `!session` and current route is an invite target (`matches/<uuid>` or `tournaments/<uuid>` under tabs or root), set `pendingInvitePath`
- [ ] **Step 2:** When `session && inAuthGroup`, `router.replace(pendingInvitePath ?? '/(tabs)/matches')` and clear pending
- [ ] **Step 3:** Manual check: kill session → open invite route → login → land on entity

---

## Chunk 4 — UI: share button on match & tournament sheets

### Task 5: Match detail share

**Files:**

- Modify: `src/app/(tabs)/matches/[id].tsx`
- Optionally create: `src/components/matches/ShareInviteButton.tsx` (reuse on tournaments)

- [ ] **Step 1:** Show “Compartir por WhatsApp” only when viewer has full sheet access (not while private password modal is required)
- [ ] **Step 2:** On press → build HTTPS URL + message → `shareInviteViaWhatsApp`
- [ ] **Step 3:** Visual smoke on a public match

### Task 6: Tournament detail share

**Files:**

- Modify: `src/app/(tabs)/tournaments/[id].tsx`
- Reuse share button component

- [ ] Same gates and behavior as match
- [ ] Private tournament: share only after password grant

---

## Chunk 5 — Expo App Links / Universal Links

### Task 7: Configure `app.json`

**Files:**

- Modify: `app.json`

- [ ] **Step 1:** Add iOS `associatedDomains`: `["applinks:<EXPO_PUBLIC_INVITE_HOST>"]` — host must be the real Firebase Hosting domain (no `https://`)
- [ ] **Step 2:** Add Android `intentFilters` for `https` + host + pathPrefix `/m` and `/t` with `autoVerify: true`
- [ ] **Step 3:** Ensure expo-router can parse incoming `https://host/m/:id` into the match/tournament screens (may need `src/app/m/[id].tsx` + `src/app/t/[id].tsx` redirect stubs **or** a linking config mapping `/m/:id` → matches). Prefer thin redirects:

```tsx
// src/app/m/[id].tsx
import { Redirect, useLocalSearchParams } from 'expo-router'
export default function M() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <Redirect href={id ? `/(tabs)/matches/${id}` : '/(tabs)/matches'} />
}
```

Same for `src/app/t/[id].tsx` → tournaments.

- [ ] **Step 4:** Note in plan/PR: **EAS production rebuild required** before App Links work on devices

---

## Chunk 6 — Firebase Hosting static site

### Task 8: Create `invite-hosting/`

**Files:**

- Create: `invite-hosting/public/m/index.html` (or single SPA-style catch-all via `firebase.json` rewrites)
- Create: `invite-hosting/public/t/index.html` (or one `redirect.html` rewritten for both)
- Create: `invite-hosting/public/.well-known/assetlinks.json`
- Create: `invite-hosting/public/.well-known/apple-app-site-association` (and/or root `apple-app-site-association`)
- Create: `invite-hosting/firebase.json`
- Create: `invite-hosting/.firebaserc` (project id — fill with real Firebase project id used for FCM)
- Create: `invite-hosting/README.md` (deploy steps, how to get SHA-256)

**Redirect page behavior:**

- Parse path `/m/{id}` or `/t/{id}` (id unused for store redirect; kept for App Link path shape)
- UA → iOS App Store (`https://apps.apple.com/app/id6775626292`) or Play (`https://play.google.com/store/apps/details?id=com.javiwacho.musapp`)
- `location.replace(storeUrl)` immediately (no marketing UI)

**AASA sketch:**

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "BUT9B76X33.com.javiwacho.musapp",
        "paths": ["/m/*", "/t/*"]
      }
    ]
  }
}
```

**assetlinks.json sketch:**

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.javiwacho.musapp",
      "sha256_cert_fingerprints": ["REPLACE_WITH_PLAY_APP_SIGNING_SHA256"]
    }
  }
]
```

- [ ] **Step 1:** Scaffold files with placeholders for SHA-256 and Firebase project id
- [ ] **Step 2:** Configure Hosting headers so AASA is `Content-Type: application/json` and not redirected
- [ ] **Step 3:** Deploy with `firebase deploy --only hosting` (user must be logged into Firebase CLI)
- [ ] **Step 4:** Set `EXPO_PUBLIC_INVITE_HOST` to the resulting `*.web.app` host (EAS + `.env.local`)

---

## Chunk 7 — Cleanup + verification

### Task 9: Dead code / docs note

- [ ] Remove or leave unused `MatchInviteLinkCard` (currently unused) — either wire copy-HTTPS as secondary or delete in a follow-up; prefer leave untouched unless share button supersedes it
- [ ] Do **not** update `REQUIREMENTS.md` / `TASKS.md` unless user asks (“update docs”)

### Task 10: Test checklist (manual)

- [ ] HTTPS match link opens match with app installed (Android)
- [ ] HTTPS tournament link opens tournament with app installed
- [ ] Without app → store redirect
- [ ] Private entity → password modal
- [ ] Logged out → login → same entity
- [ ] WhatsApp share + system share fallback
- [ ] Share not shown before private unlock

---

## Execution order

1. Chunk 1 (URLs + tests)
2. Chunk 2 (share helper)
3. Chunk 3 (deep links + return-to)
4. Chunk 4 (UI buttons)
5. Chunk 5 (`app.json` + `/m` `/t` routes)
6. Chunk 6 (Firebase Hosting) — needs user Firebase login + Play signing SHA-256
7. Chunk 7 (verify) + EAS rebuild for production App Links

## Blockers requiring user input during implementation

1. Firebase project id (Hosting site name / `.firebaserc`)
2. Play App Signing SHA-256 fingerprint for `assetlinks.json`
3. Confirm final `*.web.app` hostname for `EXPO_PUBLIC_INVITE_HOST`
