# Tareas - Mussa Suerte

> Actualizado: 20/05/2026 (cierre de sesión — torneos UX)
> Metodología: Kanban personal. Actualizar al inicio y al final de cada sesión de trabajo.

---

## Estado del proyecto

| Fase                | Estado     | Descripción                          |
| ------------------- | ---------- | ------------------------------------ |
| Fase 1 - Core       | Completada | Auth, Perfil, Partidas, Descubrir    |
| Fase 2 - Resultados | Completada | Notificaciones, Resultados, Reportes |
| Fase 3 - Admin      | Completada | Panel admin, Analíticas, Disputas    |
| Fase 4 - Torneos    | En curso   | Cuadros, parejas, explore, UX móvil  |

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
  - Redirects típicos: `exp://**` (Expo Go), `mussasuerte://auth/callback`, y en web el `http://localhost:PUERTO/` del `expo start --web`.
- [x] Login con Apple ID (OAuth via Supabase)
  - iOS: `signInWithIdToken` + `expo-apple-authentication`. Web: OAuth Supabase.
  - **Pendiente manual:** Manual-3 y Manual-4 del plan (Apple Developer y Supabase provider).
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
- [x] Preferencias de notificación (email y push)
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
- [x] Pantalla de edición de partida (mismo formulario que creación)
- [x] Lógica de unirse a partida con selección de equipo
- [x] Constraint: máximo 2 confirmados por equipo
- [x] Historial de partidas del usuario (sección en pantalla de perfil)

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
  - Perfil `production` en Android; FCM vía `google-services.json` + `eas credentials`.
- [x] Icono de app y splash screen (baraja española minimalista)
  - Assets unificados en `assets/` (`icon`, `adaptive-icon`, `splash-icon`, `favicon`); fondo de marca `#1a5f4a` en `app.json`.
  - PR #20 mergeado en `develop`.
- [ ] Configurar Expo EAS Build para iOS
  - **Bloqueado:** requiere Apple Developer Program (cuenta de pago). Reanudar cuando haya membresía activa.

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

- [x] **Android (FCM):** crear proyecto en Firebase Console para el package `com.javiwacho.musapp`, descargar `google-services.json` en la raíz del repo y subirlo en `eas credentials` (Android).
- [ ] **iOS (APNs):** crear Push Notifications key (`.p8`) en Apple Developer y configurarla en `eas credentials` (iOS) con Key ID y Team ID.
  - **Pendiente:** mismo bloqueo que EAS iOS (Apple Developer Program).
- [x] **Build de prueba (Android):** build `production` Android con credenciales FCM.
  - **Pendiente:** validación push end-to-end en dispositivo físico si aún no se ha hecho; iOS cuando exista programa Apple.

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
  - Workflow `.github/workflows/eas.yml`: push a `main` → `eas build` Android `production` → `eas submit` Android. Secrets: `EXPO_TOKEN`, `SENTRY_AUTH_TOKEN`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (genera `google-service-account.json` en el runner).
- [ ] Configurar EAS Submit para publicación automática en App Store
  - **Bloqueado** hasta Apple Developer Program; reañadir job iOS al workflow cuando proceda.
- [x] Pipeline completo: lint → type-check → tests → EAS Build → EAS Submit
  - Workflow reutilizable `.github/workflows/quality.yml` (lint, `tsc`, `jest --ci`). `ci.yml` en PRs/`develop`; `eas.yml` en `main` encadena quality → build Android → submit Play. Tests iniciales en `src/utils/validators.test.ts` (E.164).

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
- [x] Sincronización multi-dispositivo: refetch al foco, polling 30 s y pull-to-refresh en detalle torneo
- [x] Test unitario `buildBracketLayout`

### F11 - Pendiente / opcional

- [ ] Supabase Realtime en torneos (sync instantáneo entre web y móvil sin esperar polling)

---

## Backlog general (sin fase asignada)

- [x] Pantalla de Términos y Condiciones (texto estático)
  - Secciones en `src/app/(auth)/terms.tsx`; disclaimer «Texto legal definitivo pendiente de revisión jurídica.»
- [x] Pantalla de Política de Privacidad (texto estático)
  - Secciones en `src/app/(auth)/privacy.tsx`; mismo disclaimer. Rebrand app → **Mussa Suerte** (`src/constants/app.ts`, `app.json`).
- [x] Flujo de eliminación de cuenta (derecho de supresión RGPD) — ver F1 / PR #21
- [x] Preferencias de notificación avanzadas — integradas en perfil (ver F2 / PR #19); sin pantalla de configuración dedicada
- [x] Icono de app y splash screen — ver Servicios externos Fase 1 / PR #20
- [ ] Onboarding (primeras pantallas para nuevos usuarios)
- [ ] Tests unitarios de validaciones (E.164, reglas de partida)
- [ ] README de desarrollo con instrucciones de setup local
- [x] Documentación de variables de entorno (`.env.example`) — incluye `EDGE_CRON_SECRET` para CI
- [x] **Security hardening (may. 2026, rama `chore/security`, migraciones 038–048):** anti-escalada admin, PII lockdown, cron secret, Edge Functions, Sentry, OAuth release
  - Pendiente manual: configurar `CRON_SECRET` en Supabase Dashboard → Edge Functions (mismo valor que `private.runtime_config.cron_secret`) y secret `EDGE_CRON_SECRET` en GitHub
