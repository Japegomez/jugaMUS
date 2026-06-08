# Tareas - jugaMUS

> Actualizado: 09/06/2026 (cierre sesión; CI hardening, Quality gate unificado, Dependabot Expo-safe)
> Metodología: Kanban personal. Actualizar al inicio y al final de cada sesión de trabajo.

---

## Estado del proyecto

| Fase                | Estado     | Descripción                                                          |
| ------------------- | ---------- | -------------------------------------------------------------------- |
| Fase 1 - Core       | Completada | Auth, Perfil, Partidas, Descubrir                                    |
| Fase 2 - Resultados | Completada | Notificaciones, Resultados, Reportes                                 |
| Fase 3 - Admin      | Completada | Panel admin, Analíticas, Disputas                                    |
| Fase 4 - Torneos    | Completada | Cuadros, parejas, explore, UX móvil                                  |
| Fase 5 - Marcador   | Completada | Marcador en vivo local + enlace a resultado; guest sin login en rama |
| UI — Ultra Limpio   | Completada | Rediseño visual                                                      |

---

## Fase 1 — Core

### Setup inicial del proyecto

- [x] Inicializar proyecto Expo con TypeScript: `npx create-expo-app musapp --template blank-typescript`
- [x] Configurar Expo Router
- [x] Configurar ESLint + Prettier
- [x] Configurar Husky + pre-commit hooks (lint + type-check)
- [x] Crear repositorio en GitHub y primer commit
  - Nota: repo `Japegomez/musApp` creado y ramas GitFlow base (`main`, `develop`) configuradas y protegidas en GitHub.
- [x] Configurar GitHub Actions básico (lint + type-check en cada PR)
  - Nota: workflow `ci.yml` creado (lint + type-check).
  - Pendiente: validar que corre en PRs (checks verdes) en el siguiente PR.

### Setup Supabase

- [x] Crear proyecto en Supabase (vía MCP)
  - Proyecto: `musApp`, ref `gnseokumiqtdtdzyrldk`, región `eu-west-1`.
- [x] Crear tabla `profiles` con migración versionada
- [x] Crear tabla `matches` con migración versionada
- [x] Crear tabla `match_participants` con migración versionada
- [x] Configurar Row Level Security (RLS) en las tres tablas
- [x] Crear trigger para sincronizar `auth.users` → `profiles`
- [x] Crear índices de rendimiento (idx*matches_search, idx_matches_user_history, idx_participants*\*)
- [x] Generar tipos TypeScript (vía MCP)
  - SQL versionado también en `supabase/migrations/` (reproducible), incl. `005` (revokes RPC en triggers + endurecimiento `search_path`).
  - Pendiente: rotar clave `anon` si se expuso fuera del equipo; `.env.local` en cada máquina (no versionado).

### F1 - Autenticación

- [x] Instalar y configurar SDK de Supabase en la app
  - Cliente en `src/lib/supabase.ts` + `EXPO_PUBLIC_*` en `.env.local` / `.env.example`.
  - `useAuthStore` / `useAuth` cableados a `supabase.auth` (`initializeAuth`, `onAuthStateChange`).
  - Migraciones `006`/`007` en repo: RLS sin recursión en `match_participants` + backfill `profiles` desde `auth.users` (evitar 500 tras login).
- [x] Pantalla de login con email/contraseña
  - Mensajes claros si Supabase devuelve 429 (rate limit por IP en plan gratuito).
- [x] Pantalla de registro con aceptación de términos y política de privacidad
  - Textos estáticos en `src/app/(auth)/terms.tsx` y `privacy.tsx` con disclaimer jurídico; revisión legal pendiente antes de release.
  - En Supabase está **desactivada la confirmación por email** (dev / pruebas); **reactivar en producción** (proveedor Email + plantillas + URLs).
- [x] Pantalla de recuperación de contraseña
- [x] Login con Google (OAuth via Supabase)
  - Requiere MANUAL-1 y MANUAL-2 del plan (Google Cloud + Supabase provider).
  - Redirects típicos: `exp://**` (Expo Go), `jugamus://auth/callback`, y en web el `http://localhost:PUERTO/` del `expo start --web`.
- [x] Login con Apple ID (OAuth via Supabase)
  - iOS: `signInWithIdToken` + `expo-apple-authentication`. Web: OAuth Supabase.
  - Apple Developer: App ID `com.javiwacho.musapp` (Sign In with Apple + Push), Services ID `com.javiwacho.musapp.signin` (web/OAuth futuro).
  - Supabase: provider Apple activo **solo iOS nativo** (`Client IDs`: `com.javiwacho.musapp`; sin JWT/secret OAuth).
- [x] Persistencia de sesión entre cierres de la app
  - `persistSession: true`; `src/lib/authStorage.ts` (web: `localStorage`, nativo: AsyncStorage compatible Expo Go).
- [x] Redirección automática: usuarios autenticados → pantalla principal, no autenticados → login
  - Guardia en `src/app/_layout.tsx` tras `initialized`.
  - Tabs: rutas `matches/index`, `profile/index`, etc. en `(tabs)/_layout.tsx` (Expo Router web).
- [x] Hook `useAuth.ts` con Zustand para estado global de sesión
- [x] Cerrar sesión desde pantalla de perfil
- [x] Flujo de eliminación de cuenta (derecho de supresión RGPD)
  - Edge Function `delete-account` (desplegada en remoto) + RPC `delete_user_account_data` (migraciones `023`–`025`).
  - Anonimización: partidas y resultados se conservan; creador/participante/referencias pasan al perfil sentinel **Usuario eliminado** (`00000000-0000-4000-8000-000000000001`, cuenta interna sin login).
  - UI: `DeleteAccountModal` + botón en perfil; `deleteAccount()` en `useAuth`.
  - PR #21 mergeado en `develop`.

### F2 - Perfil de usuario

- [x] Pantalla de perfil (vista propia)
- [x] Pantalla de edición de perfil
- [x] Campo de teléfono con validación E.164 (selector de país + número; validación genérica `+` y 7–15 dígitos)
- [x] Subida de foto de perfil a Supabase Storage (compresión ≤ 500 KB; bucket `avatars` migración `008`; subida sin `Blob.arrayBuffer` en iOS/Hermes)
- [x] Preferencias de notificación (push; sin email, migración `057`)
- [x] Preferencias granulares de notificación en pantalla de perfil (canal + por evento)
  - Migración `022`: `notify_on_join`, `notify_on_match_change`, `notify_on_result`, `notify_on_reminder` en `profiles` (aplicada en remoto).
  - Toggles editables en `profile/index.tsx` (grupos **Canal** y **Por evento**); guardado inmediato. Sin pantalla `settings` separada.
  - Enlaces a Términos y Política de privacidad en sección **Legal** del perfil (debajo del historial).
  - PR #19 mergeado en `develop`.
- [x] Lógica de visibilidad del teléfono: solo visible para participantes de la misma partida
  - RPC `get_profile_with_phone` usada en detalle de partida (pantalla `[id].tsx`).

### F3 - Ubicaciones

- [x] Integrar JSON estático de municipios del INE
  - `npm run sync:municipalities` → `src/data/municipalities.json` (~8k municipios; fuente por defecto CSV codeforspain alineado INE).
- [x] Componente de selector de municipio con búsqueda local
  - `MunicipalityPicker` en edición de perfil; **pendiente**: mismo selector en formulario de creación/edición de partida (F4).
- [x] Campo "lugar por definir" en formulario de partida

### F4 - Partidas (Core)

- [x] Pantalla de creación de partida (formulario completo)
  - [x] Título, descripción
  - [x] Fecha y hora (selector nativo)
  - [x] Selector de ciudad/pueblo (municipios INE)
  - [x] Lugar (texto libre o "por definir")
  - [x] Duración en juegos (1-6, selector)
  - [x] Visibilidad (pública / con enlace)
  - [x] Notas opcionales
- [x] Pantalla de detalle de partida
  - [x] Información completa de la partida
  - [x] Lista de participantes por equipo (A y B)
  - [x] Botón "Unirse" (si hay plaza y no eres participante)
  - [x] Botón "Abandonar" (si eres participante y partida en estado `planned`)
  - [x] Confirmación de abandonar con `LeaveMatchModal` (web); re-unión tras abandonar actualiza fila existente (sin error 23505).
  - [x] Botones "Editar" y "Cancelar" (solo para el creador)
  - [x] Cancelar partida también en `in_progress` (creador, sin exigir ser participante); confirmación con modal (`CancelMatchModal`) para que funcione en web (sin `Alert`).
  - [x] Teléfonos visibles solo si eres participante confirmado
  - [x] Jugadores por nombre (texto) en crear/editar; nombres de equipo editables; creador como jugador 1 equipo A al crear.
  - [x] Plazas libres / cron / explore cuentan jugadores de texto (`016` + `freeTeamSlots` en cliente).
  - [x] Edición de plantilla: no permite más jugadores de texto de los que caben si hay cuentas registradas en el equipo.
  - [x] Marcador directo por creador en partidas sin otros registrados (`record_match_result_direct`); botón solo con partida `in_progress` (`017`).
  - [x] FAB «Nueva partida» en pantalla Mis partidas (como Descubrir).
  - [x] Nombres de equipo por defecto desde plantilla (`matchTeamNames`: `Jugador1 - Jugador2`; orden alineado con lista de integrantes).
  - [x] Crear partida: hora de inicio = ahora al abrir formulario; reset al entrar en pantalla (sin arrastrar última partida).
  - [x] Promoción a `in_progress` al crear/unirse si `start_at <= now` y plantilla completa (4 plazas).
  - [x] Cron/plantilla (`050`/`051`): join solo en `planned`; sin roster completo al llegar la hora → `cancelled`; explore filtra `start_at >= now`.
  - [x] Detalle partida: refetch al foco (`useMatch` + `useFocusEffect`) — etiqueta de estado coherente con Mis partidas en móvil.
- [x] Pantalla de edición de partida (mismo formulario que creación)
- [x] Lógica de unirse a partida con selección de equipo
- [x] Constraint: máximo 2 confirmados por equipo
- [x] Historial de partidas del usuario (sección en pantalla de perfil)
- [x] **Perfil de otro usuario** (`/(tabs)/profile/[userId]`): nombre, ciudad, teléfono (si comparten partida confirmada) e historial navegable a detalle de partida
- [x] Acceso al perfil ajeno desde la tarjeta de participante registrado en detalle de partida
- [x] RPCs `get_viewable_user_profile` y `list_user_viewable_matches` (migración `056`); componente compartido `MatchHistoryList` (PR #57)

### F5 - Descubrir y filtrar

- [x] Pantalla principal con listado de partidas públicas
- [x] Ordenación por fecha (próximas primero)
- [x] Filtros: ciudad/pueblo, fecha, plazas libres, estado
- [x] Búsqueda por texto (campo título)
- [x] Paginación de 20 elementos (infinite scroll o botón "cargar más")
- [x] Cache con TanStack Query (5 minutos)
- [x] Estado vacío (sin partidas que coincidan con filtros)
  - Nota: aplicar migración `009_list_public_matches` en Supabase (RPC `list_public_matches`); ya versionada en `supabase/migrations/`.

### Servicios externos (Fase 1)

- [x] Instalar y configurar Sentry (crash reporting básico)
  - `src/lib/sentry.ts`, plugin en `app.json` (UE `de.sentry.io`), `Sentry.wrap` en `_layout.tsx`; botón de prueba en perfil solo `__DEV__`.
- [x] Instalar y configurar PostHog (analytics básico)
  - `src/lib/posthog.ts` + `PostHogProvider` en layout; host EU; cliente desactivado si falta API key.
- [x] Configurar Expo EAS Build (primer build de prueba en Android)
  - Perfil `production` en Android; FCM vía `google-services.json` (gitignored). CI/EAS: variable de entorno de tipo **file** `GOOGLE_SERVICES_JSON` en entorno `production` (`app.config.js` + `eas env:create`).
- [x] Icono de app y splash screen (baraja española minimalista)
  - Assets unificados en `assets/` (`icon`, `adaptive-icon`, `splash-icon`, `favicon`); fondo de marca `#1a5f4a` en `app.json`.
  - PR #20 mergeado en `develop`.
- [x] Configurar Expo EAS Build para iOS
  - Primer build `production` iOS + `--auto-submit` a App Store Connect (TestFlight). `eas.json`: `ascAppId` `6775626292`, `appleTeamId`, `ios.autoIncrement`.
  - `app.json`: `ITSAppUsesNonExemptEncryption: false` (export compliance).

---

## Fase 2 — Resultados y Notificaciones

### Migraciones de base de datos

- [x] Crear tabla `match_results`
- [x] Crear tabla `result_confirmations`
- [x] Crear tabla `reports`
- [x] Crear tabla `notification_queue`
- [x] Crear tabla `match_state_transitions`
- [x] Añadir índices correspondientes (idx_notifications_pending)
  - Migraciones `010` y `011` aplicadas en Supabase. También incluye `idx_reports_status`, `idx_results_match`, `idx_state_transitions_match`. RLS habilitada en todas las tablas nuevas.
  - Migraciones `012` / `018` (triggers de confirmación de resultado + notificación al enviar resultado): **aplicadas en remoto** (18/05); incluyen backfill de filas aprobadas sin actualizar estado. `useCancelMatch` invalida cache de resultado al cancelar.

### F6 - Notificaciones

- [x] Configurar Expo Push Notifications (registro de tokens)
  - `expo-notifications` + `expo-device` instalados. Plugin añadido a `app.json`.
- [x] Guardar token de push en `profiles`
  - `useNotifications` hook guarda el token via `supabase.from('profiles').update({ push_token })`. Hook cableado en `_layout.tsx`.
- [x] Supabase Edge Function: disparar notificación al unirse alguien a tu partida
  - Trigger `trg_notify_participant_join` (migration 011) escribe en `notification_queue`. Edge Function `process-notifications` envía al Expo Push API.
- [x] Supabase Edge Function: disparar notificación al editar o cancelar partida
  - Trigger `trg_notify_match_change` (migration 011) escribe en `notification_queue` para todos los participantes confirmados.
- [x] Configurar `pg_cron` para transiciones automáticas de estado
  - [x] `planned` → `in_progress` al llegar `start_at`
  - [x] Recordatorio a las 5h si sigue `in_progress`
  - [x] `in_progress` → `finished_no_result` a las 12h si no hay resultado
  - Función `process_match_state_transitions()` + job `match-state-transitions` (cada minuto).
- [x] Recordatorio automático 24h antes de la partida
- [x] Recordatorio automático 2h antes de la partida
  - Reminders deduplicados por `(user_id, type, match_id)` en `notification_queue`.
- [x] Gestión de reintentos en `NotificationQueue` (max 3 intentos)
  - Edge Function incrementa `attempts`; marca `failed` al alcanzar `max_attempts`. Limpia `push_token` si Expo devuelve `DeviceNotRegistered`.

#### Credenciales push (manual — builds nativos)

Las notificaciones push **no** funcionan en Expo Go; hace falta un build con credenciales en EAS.

- [x] **Android (FCM):** Firebase para `com.javiwacho.musapp`; `google-services.json` local (gitignored). En EAS: `eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment production --visibility secret` (obligatorio para builds en la nube / CI).
- [x] **Sentry source maps (EAS):** `SENTRY_AUTH_TOKEN` en entorno EAS `production` (subida de source maps en Gradle). Documentado en `.env.example` / TASKS.
- [x] **Sentry en runtime (app):** opcional `EXPO_PUBLIC_SENTRY_DSN` en EAS `production` para reportar crashes en dashboard (sin DSN, `enabled: false` en `sentry.ts`).
- [x] **iOS (APNs):** Push Notifications key (`.p8`) en Apple Developer
  - Key creada en portal Apple (may. 2026). EAS suele haberla subido en el primer build iOS.
  - **Pendiente QA:** validar recepción de push en iPhone (TestFlight); si falla, revisar `eas credentials` → iOS → Push Key.
- [x] **Build de prueba (Android):** build `production` Android con credenciales FCM.
  - **Pendiente:** validación push end-to-end en dispositivo físico (Android e iOS en TestFlight).

### F7 - Resultados

- [x] Pantalla/modal de introducción de resultado
- [x] Lógica de validación por equipo rival
- [x] Pantalla/modal de confirmación o disputa de resultado
  - Aprobación con `ApproveResultModal` (misma idea que disputa: evita `Alert` vacío en Expo Web).
  - Trigger `fn_process_result_confirmation` reparado en remoto (`018`); al aprobar pasa resultado a `confirmed` y partida a `finished`.
- [x] Estado `resultado en revisión` cuando hay disputa
- [x] Reporte automático generado al abrir una disputa

### F8 - Reportes (formulario)

- [x] Pantalla/modal de reporte (usuario, partida o resultado)
- [x] Lista de motivos predefinidos + comentario libre
- [x] Guardar reporte como anónimo para el reportado

### CI/CD Fase 2

- [x] Configurar EAS Submit para publicación automática en Google Play
  - Workflow `.github/workflows/eas.yml`: push a `main` → `eas build` → `eas submit` Android. Secrets GitHub: `EXPO_TOKEN`, `GOOGLE_PLAY_SERVICE_KEY_JSON` (clave JSON de **cuenta de servicio** en Google Cloud: `type`, `private_key`, `client_email` — **no** `google-services.json` de Firebase). Variables EAS `production`: `GOOGLE_SERVICES_JSON`, `SENTRY_AUTH_TOKEN`.
  - PRs mergeados en `develop`: slug EAS `musapp`, `appVersionSource: remote`, `app.config.js` + `GOOGLE_SERVICES_JSON`, validación JSON Play submit, `npm ci` antes de `eas submit`.
- [x] **Variables EAS `production` obligatorias para el bundle:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (sin ellas la app en release queda en pantalla en blanco). Opcional: `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_POSTHOG_API_KEY`.
  - Confirmar con `eas env:list --environment production`; **nuevo build** tras añadirlas.
- [x] Configurar EAS Submit para publicación automática en App Store
  - PR #59 mergeado en `develop`: jobs `build-ios` + `submit-ios`; submit iOS vía ASC API key en EAS (`EXPO_TOKEN`).
  - Release en `main` validado (PR #86); tags en `https://github.com/Japegomez/jugaMUS/tags`.
- [x] Pipeline completo: lint → type-check → tests → EAS Build → EAS Submit
  - Workflow reutilizable `.github/workflows/quality.yml` (job `Quality`: Gitleaks, `expo-doctor`, lint, `tsc`, `jest --ci`). `ci.yml` en PRs/`develop`; `eas.yml` en `main` encadena quality → release-tag → build Android/iOS → submit Play + TestFlight.

### CI/CD hardening (checklist Nana — jun. 2026)

- [x] **Cobertura Jest con umbral 1%** — `coverageThreshold` en `jest.config.js`; artefacto `coverage/` en `quality.yml`.
- [x] **Auditoría de dependencias** — `npm audit --audit-level=high` en `quality.yml`; `.github/dependabot.yml` (npm + github-actions, semanal).
- [x] **Quality gate unificado** — workflow `quality.yml` (job `Quality`): Gitleaks + `expo-doctor` + lint + type-check + tests + cobertura. Eliminado `secret-scan.yml`.
- [x] **GitHub Actions Node 24** — `checkout`/`setup-node` v6, `upload-artifact` v7.
- [x] **Dependabot Expo-safe** — grupo runtime limitado a libs independientes; ignora patch/minor en stack Expo/RN. PR #84 cerrada (conflictos + bumps incompatibles SDK 54).
- [x] **Fix deps Expo SDK 54 en `main`** — `async-storage` 2.2.0, `expo-splash-screen` ~31.0.13 (PR #85/#86).
- [x] **Tags de release en `main`** — job `release-tag` en `eas.yml`: `v{app.json version}-{YYYYMMDD.HHmm}` UTC antes de EAS build. Visibles en GitHub → Tags.
- [ ] **Pendiente manual (GitHub):** Settings → Code security → Dependabot **security updates** (opción 3) + Push protection; ruleset `status check` en `develop`/`main` (check `quality / Quality`).

---

## Fase 3 — Admin y Analíticas

### Migraciones de base de datos

- [x] Crear tabla `audit_logs`
  - Migración `019_audit_logs_admin_rls.sql`: tabla, `auth_is_admin()`, RLS admin en `reports`, `profiles`, `matches`, `match_results`.
- [x] Añadir índices de auditoría
  - Índices en `audit_logs` (`admin_id`, `created_at`) en `019`.
- [x] RPCs de analíticas admin
  - Migración `020_admin_analytics_rpcs.sql`: `admin_get_analytics`, `admin_get_matches_by_week`, `admin_get_matches_by_city`, `admin_get_user_ranking`.
- [x] RLS lectura de objetivos reportados (admin)
  - Migración `021_admin_select_targets_rls.sql` (aplicada en remoto vía MCP).

### F9 - Panel de moderación

- [x] Pantalla de lista de reportes abiertos (solo admin)
  - Ruta `/(admin)/reports`; guardia de rol en `(admin)/_layout.tsx`.
- [x] Filtros por tipo de reporte y estado
- [x] Acciones: resolver reporte, bloquear usuario, eliminar partida/resultado
  - Confirmaciones con `AdminConfirmModal` (compatible web; sin `Alert.alert`).
  - Contexto del objetivo reportado (usuario, partida, resultado) en la tarjeta.
- [x] Registro automático en `audit_logs` de cada acción admin
  - `admin.service.ts` → `writeAuditLog` en cada mutación.

### F10 - Panel de analíticas

- [x] Pantalla de métricas para admin:
  - [x] MAU (usuarios activos mensuales — participantes en partida confirmada, últimos 30 días)
  - [x] Partidas creadas (total y por semana)
  - [x] % partidas con resultado confirmado
  - [x] % con disputa
  - Dashboard admin (`/(admin)/index`) solo enlaces a moderación y analíticas; **sin** resumen de métricas en portada.
- [x] Gráficas: serie temporal semanal de partidas
- [x] Gráficas: barras por ciudad/pueblo (top 10)
- [x] Ranking de usuarios por número de partidas
  - Ruta `/(admin)/analytics`; `react-native-chart-kit` + `react-native-svg`.

### Observabilidad avanzada

- [x] Health checks cada 5 minutos para Edge Functions críticas
  - Workflow `.github/workflows/sentry-health.yml` + check-in Sentry Cron Monitor (`process-notifications`).
- [x] Alertas en Sentry para errores 5xx y latencia alta
  - Configuradas en proyecto Sentry (workflow + reglas de alerta).
- [x] Dashboard de performance en Sentry
  - Cliente: `tracesSampleRate`, `profilesSampleRate`, auto-tracing en `src/lib/sentry.ts`.
  - Pendiente: validar secret `SENTRY_AUTH_TOKEN` en GitHub Actions si el cron no reporta en Sentry.

---

## Fase 4 — Torneos

### Migraciones de base de datos

- [x] Tablas `tournaments`, `tournament_pairs`; columnas `tournament_*` en `matches` (migración `026`)
- [x] RPCs: `add_tournament_pair`, `join_tournament_pair`, `generate_tournament_bracket`, `advance_tournament_round`, `list_tournament_bracket`, `record_tournament_match_result_as_referee`
- [x] Aplicar migración `026` en Supabase remoto
- [x] Migraciones `027`–`037` en repo y remoto: RLS matches, RPC `create_tournament`, UX cuadro (bye, avance parcial, cierre final), explore sin partidas de torneo, stats sin bye, títulos de ronda, una pareja por jugador registrado

### F11 - Torneos (UI + flujo)

- [x] FAB speed-dial: crear partida / organizar torneo
- [x] Wizard crear torneo (paso 1 parámetros, paso 2 parejas); reset del wizard al abandonar la pantalla
- [x] Detalle torneo: pestañas Cuadro (`BracketCanvas` SVG) y Partidos pendientes
- [x] Añadir pareja (mixta texto/registrado); unirse a pareja con hueco libre (botón **Unirme** dentro de la tarjeta)
- [x] Un jugador registrado solo puede estar en **una pareja** por torneo (validación RPC + UI)
- [x] Organizar cuadro (organizador): eliminación directa, byes, partidos `in_progress` con hora actual
- [x] Avance automático de ronda al confirmar resultado; propagación bye; relleno parcial del cuadro
- [x] Cierre del torneo al terminar/cancelar la final
- [x] Árbitro: registrar resultado en partidos solo-texto; auto-confirmación si rival es solo texto
- [x] Badge de torneo en ficha de partida del cuadro; sin unirse/abandonar manual en partidas de torneo
- [x] Descubrir: filtro Todo / Partidas / Torneos; torneos en inscripción; partidas del cuadro excluidas
- [x] Mis partidas: torneos del usuario junto a partidas activas
- [x] Detalle y tarjetas: organizador, ciudad + lugar; títulos de ronda (Cuartos, Semifinal…)
- [x] Historial perfil: victoria/derrota con fondo verde/rojo; partidas bye excluidas de historial y stats admin
- [x] Crear/editar partida y torneo: lugar obligatorio o casilla «Lugar por definir»
- [x] Sincronización multi-dispositivo: Supabase Realtime + invalidación de listas (Descubrir, Mis partidas, historial, ficha/cuadro torneo); migración `058`; hook `useExploreListsRealtimeSync`
- [x] Test unitario `buildBracketLayout`
- [x] **Editar y eliminar parejas** en detalle del torneo (organizador, inscripción abierta, sin cuadro): modal `EditPairModal`; RPCs `update_tournament_pair` / `remove_tournament_pair` (migración `055`, PR #56)
- [x] Enlace **🏆 Ir al torneo** en ficha de partida del cuadro (chip con estilo previo, tamaño ampliado)

### F11 - Pendiente / opcional

- [x] Supabase Realtime en partidas y torneos (sync instantáneo entre dispositivos; sustituye polling 30 s en detalle torneo)

---

## Fase 5 — Marcador en vivo (may. 2026)

> Rama de trabajo: `feature/scoreboard` (desde `develop`).

### F12 - Marcador local durante la partida

- [x] Constantes de mus (`MUS_PHASES`, apuesta por defecto, puntos por juego, etiquetas de fase) en `src/constants/index.ts`
- [x] Persistencia cross-platform (`src/lib/scoreboardStorage.ts`: AsyncStorage / `localStorage`)
- [x] Hook `useLiveScoreboard`: puntos, juegos, fases, envite, órdago, fin de partida
- [x] Componentes UI: `ScoreboardPairCard`, `PhaseRow`, `PointsAdjustModal`, `OrdagoModal`, `ResetScoreboardModal`
- [x] Pantalla `/(tabs)/matches/scoreboard/[id]`: marcador global, fases, botón órdago, reinicio local
- [x] Detalle partida: botones «Llevar la cuenta» y «Registrar resultado» (partida `in_progress`)
- [x] Prefill del modal de resultado desde marcador (`?openResult=1` + juegos; `MatchScorePicker` con valores bloqueados)
- [x] Reset del marcador local tras registrar resultado correctamente
- [x] Commit + PR `feature/scoreboard` → `develop` (revisor/asignado Japegomez)
- [x] QA en Android / iOS / web: flujo completo marcador → registrar resultado → historial

### F13 - Marcador sin registro (guest)

> Rama de trabajo: `feature/scoreboard_without_login` (desde `develop`).

- [x] Botón «Llevar la cuenta» en login (destacado) + texto orientativo (sesión vs cuenta sin registro)
- [x] Formulario rápido: nombres pareja A/B + juegos a ganar (1–6) en `/(auth)/guest-scoreboard`
- [x] Marcador reutilizando `useLiveScoreboard` y componentes F12 (`/(auth)/guest-scoreboard/play`)
- [x] Popup fin de partida con ganador y «Volver al inicio» → login; estado local con `GUEST_SCOREBOARD_STORAGE_ID`
- [ ] Commit + PR `feature/scoreboard_without_login` → `develop` (revisor/asignado Japegomez)
- [ ] QA manual: flujo login → guest → partida → victoria → login (Android / iOS / web)

---

## UI — Rediseño Ultra Limpio (may. 2026)

> Rama de trabajo: `feature/ui-redesign` (cambios locales sin commit al cierre de sesión).

- [x] Tokens centralizados (`src/theme/colors.ts`, `typography.ts`, `layout.ts`)
- [x] Fuente DM Sans (`@expo-google-fonts/dm-sans`, carga en `_layout.tsx`)
- [x] Mis partidas y Descubrir: listas con filas, separadores y `StatusDot` (sin tarjetas)
- [x] `ScreenHeader` + resto de pantallas/modales migrados al nuevo palette
- [x] FAB speed-dial (`CreateFab`) anclado justo encima de la tab bar (`useBottomTabBarHeight`)
- [x] Espaciado superior unificado (`screenTopPadding`, +12 px extra)
- [x] Toggle mostrar/ocultar contraseña en registro (`Input` + `@expo/vector-icons`)
- [x] Switches de notificaciones en perfil con mayor contraste (y filtros Descubrir al mismo estilo)
- [x] Preview Mis partidas y Descubrir: `ciudad · lugar` (`formatCityAndPlace` + `attachPlaceFields` en dashboard)
- [x] Migración `049` (`list_matches_awaiting_my_result_action` incluye lugar) — aplicada en Supabase remoto
- [x] Cabecera Mis partidas: solo título, sin contador de activas
- [x] Commit + PR `feature/ui-redesign` → `develop` (revisor/asignado Japegomez)
- [x] QA visual rápida en Android / iOS / web tras merge

---

## Release Android — Play Console (may. 2026)

- [x] Flujo GitFlow documentado y PRs `develop` → `main` (#23, #31, #33, #35, #37, #39…)
- [x] Primera subida manual del AAB a **Pruebas internas** (Google exige primer release manual; `eas submit` automático a partir del siguiente)
- [x] App instalable vía enlace de testers internos (`com.javiwacho.musapp`)
- [x] Páginas legales en `docs/` para GitHub Pages (privacidad, eliminación de cuenta; contacto `japenago@gmail.com`) — PR #40 / #41
- [x] Recursos gráficos Play: `assets/play-store/icon-512.png`, `feature-graphic-1024x500.png` + script `export-play-store-graphics.mjs`
- [x] Activar **GitHub Pages** (`/docs`) — live en `https://japegomez.github.io/jugaMUS/`
- [ ] Completar ficha Play (textos, capturas, clasificación, política de privacidad)
- [x] Corregir arranque en release (código): `edgeToEdgeEnabled: false`, SplashScreen hasta cargar fuentes
- [x] Variables `EXPO_PUBLIC_*` en EAS + nuevo build `production` + validar login en dispositivo (p. ej. Android 11)
- [x] PR `main` → `develop` para alinear historial tras releases

---

## Release iOS — App Store / TestFlight (may. 2026)

- [x] Apple Developer Program activo; App ID `com.javiwacho.musapp` (Sign In with Apple + Push)
- [x] App creada en App Store Connect (`ascAppId` `6775626292`)
- [x] Primer build iOS `production` + submit a TestFlight (`eas build --platform ios --auto-submit`)
- [x] Textos App Store redactados (promocional, descripción, keywords, URL soporte/privacidad)
- [x] PR #59 mergeado en `develop` (pipeline CI iOS)
- [x] Validar workflow Release en `main` (requiere merge `develop` → `main`)
- [x] Testing interno TestFlight: Sign in with Apple, push, partidas/torneos (QA manual en dispositivo)
- [ ] Completar ficha App Store Connect (pegar textos, capturas, App Privacy) y **Submit for Review**

---

## Backlog general (sin fase asignada)

- [x] Pantalla de Términos y Condiciones (texto estático)
  - Secciones en `src/app/(auth)/terms.tsx`; disclaimer «Texto legal definitivo pendiente de revisión jurídica.»
- [x] Pantalla de Política de Privacidad (texto estático)
  - Secciones en `src/app/(auth)/privacy.tsx`; mismo disclaimer. Rebrand app → **jugaMUS** (`src/constants/app.ts`, `app.json`).
- [x] Flujo de eliminación de cuenta (derecho de supresión RGPD) — ver F1 / PR #21
- [x] Preferencias de notificación avanzadas — integradas en perfil (ver F2 / PR #19); sin pantalla de configuración dedicada
- [x] Icono de app y splash screen — ver Servicios externos Fase 1 / PR #20
- [ ] Onboarding (primeras pantallas para nuevos usuarios)
- [ ] Tests unitarios de validaciones (E.164, reglas de partida)
- [ ] README de desarrollo con instrucciones de setup local
- [x] Documentación de variables de entorno (`.env.example`) — incluye `EDGE_CRON_SECRET` para CI
- [x] **Security hardening (may. 2026, rama `chore/security`, migraciones 038–048):** anti-escalada admin, PII lockdown, cron secret, Edge Functions, Sentry, OAuth release
  - Pendiente manual: configurar `CRON_SECRET` en Supabase Dashboard → Edge Functions (mismo valor que `private.runtime_config.cron_secret`) y secret `EDGE_CRON_SECRET` en GitHub
