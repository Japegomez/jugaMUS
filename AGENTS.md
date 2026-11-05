# AGENTS.md — jugaMUS

App móvil (Expo / React Native) para organizar partidas, torneos y ligas de mus en España. **No incluye lógica del juego** (reglas, envites, puntos oficiales del mus): solo organización, social y marcador local.

## Stack y comandos

- **Cliente:** Expo SDK 54, Expo Router, TypeScript, Zustand, TanStack Query, React Hook Form, tema en `src/theme/`.
- **Backend:** Supabase (Auth, Postgres + RLS, Storage, Edge Functions, Realtime, pg_cron).
- **Calidad / release:** GitHub Actions (`quality.yml`, `secret-scan.yml`, `eas.yml`), EAS Build/Submit, Sentry, PostHog, Turnstile.
- Comandos: `npm start` · `npm run lint` · `npm run type-check` · `npm test` · `npm run test:ci` · `npm run audit:ci`.
- Secretos locales: gitleaks en pre-commit (`gitleaks protect --staged`). **Requisito del hook:** el binario `gitleaks` debe estar en el `PATH` (Husky no lo instala).
  - macOS / Linux: `brew install gitleaks`
  - Windows: `winget install --id Gitleaks.Gitleaks -e` (o binario en [releases](https://github.com/gitleaks/gitleaks/releases))
  - Comprobar: `gitleaks version`
- CI: TruffleHog en `secret-scan.yml`. No mezclar gitleaks + TruffleHog en el mismo job. Exigir el check **TruffleHog** en el ruleset de **`main`** (junto a `quality / Quality`); no hacerlo obligatorio en `develop`.

## Estructura

- `src/app/` pantallas (Expo Router) · `src/components/` UI · `src/services/` acceso a Supabase/RPCs · `src/hooks/` React Query · `src/lib/` / `src/utils/` helpers · `src/theme/` design tokens.
- `supabase/migrations/` esquema y RLS · `supabase/functions/` Edge Functions.
- No editar a mano: `vendor/` (shims CJS), `coverage/`, `.expo/`, lockfiles salvo bumps explícitos.

## Especificación (SDD)

- Fuente de verdad: `REQUIREMENTS.md` (decisiones/alcance) + `TASKS.md` (backlog). Specs puntuales en `docs/superpowers/specs/`. Tests: `docs/testing.md`.
- No inventes tablas, RPCs, pantallas ni flujos fuera de esos docs; si falta algo, pregunta.
- Cambios de 3+ archivos o alcance ambiguo: plan aprobado antes de código.
- Docs (`TASKS` / `REQUIREMENTS`): solo si el usuario pide explícitamente actualizar documentación.

## Mapa del codebase (Graphify)

- Si existe `graphify-out/graph.json`, antes de explorar con Read/Grep/Glob: `graphify query "<pregunta>"` (o `path` / `explain`) y abre solo lo citado.
- Tras cambiar código: `graphify update .`.

## Git, PRs y release

- GitFlow: trabajo en `feature/*` desde `develop`; `main` = producción (EAS). No desarrollar en `main`.
- PRs en **inglés**; base por defecto `develop`. Al crear PR: `--reviewer Japegomez --assignee Japegomez`. **No** merges por CLI salvo petición explícita.
- Commits convencionales (`feat`/`fix`/`chore`/`docs`…). Commits y push solo si el usuario lo pide.
- Antes de merge: lint, type-check y tests verdes. Cobertura CI ≥60% en `src/{utils,lib,services,hooks}`.

## Prohibiciones

- No secretos ni PII en prompts, commits ni logs. No commitear `.env*`, `google-services.json`, claves `.p8` / Play JSON.
- No `git push --force` a `main`/`master`. No desplegar EAS/stores ni aplicar migraciones remotas sin aprobación.
- No forzar overrides de `image-size` / `minimatch` / `glob` para “cerrar” Dependabot: rompen Expo SDK 54; allowlist solo por GHSA en `scripts/npm-audit-ci.mjs`.
- No añadir lógica del juego de mus. En web, confirmaciones destructivas con modales (no confiar en `Alert.alert`).

## Skills / revisiones

- Seguridad pre-merge: skills `security-review` / `security-audit` (y thermos en Cursor) sobre el diff.
- No sustituyen CI ni el escaneo de secretos.
