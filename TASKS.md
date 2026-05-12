# Tareas - Mus Sin Fronteras

> Actualizado: 11/05/2026 (cierre de sesión)
> Metodología: Kanban personal. Actualizar al inicio y al final de cada sesión de trabajo.

---

## Estado del proyecto

| Fase                | Estado    | Descripción                          |
| ------------------- | --------- | ------------------------------------ |
| Fase 1 - Core       | Pendiente | Auth, Perfil, Partidas, Descubrir    |
| Fase 2 - Resultados | Pendiente | Notificaciones, Resultados, Reportes |
| Fase 3 - Admin      | Pendiente | Panel admin, Analíticas, Disputas    |

---

## En progreso

_Ninguna tarea en progreso actualmente._

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
  - Textos legales placeholder en `src/app/(auth)/terms.tsx` y `privacy.tsx` (sustituir antes de release).
  - En Supabase está **desactivada la confirmación por email** (dev / pruebas); **reactivar en producción** (proveedor Email + plantillas + URLs).
- [x] Pantalla de recuperación de contraseña
- [x] Login con Google (OAuth via Supabase)
  - Requiere MANUAL-1 y MANUAL-2 del plan (Google Cloud + Supabase provider).
  - Redirects típicos: `exp://**` (Expo Go), `musapp://auth/callback`, y en web el `http://localhost:PUERTO/` del `expo start --web`.
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

### F2 - Perfil de usuario

- [x] Pantalla de perfil (vista propia)
- [x] Pantalla de edición de perfil
- [x] Campo de teléfono con validación E.164 (selector de país + número; validación genérica `+` y 7–15 dígitos)
- [x] Subida de foto de perfil a Supabase Storage (compresión ≤ 500 KB; bucket `avatars` migración `008`; subida sin `Blob.arrayBuffer` en iOS/Hermes)
- [x] Preferencias de notificación (email y push)
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
  - [x] Botones "Editar" y "Cancelar" (solo para el creador)
  - [x] Teléfonos visibles solo si eres participante confirmado
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

- [ ] Instalar y configurar Sentry (crash reporting básico)
- [ ] Instalar y configurar PostHog (analytics básico)
- [ ] Configurar Expo EAS Build (primer build de prueba en Android)
- [ ] Configurar Expo EAS Build para iOS

---

## Fase 2 — Resultados y Notificaciones

### Migraciones de base de datos

- [ ] Crear tabla `match_results`
- [ ] Crear tabla `result_confirmations`
- [ ] Crear tabla `reports`
- [ ] Crear tabla `notification_queue`
- [ ] Crear tabla `match_state_transitions`
- [ ] Añadir índices correspondientes (idx_notifications_pending)

### F7 - Notificaciones

- [ ] Configurar Expo Push Notifications (registro de tokens)
- [ ] Guardar token de push en `profiles`
- [ ] Supabase Edge Function: disparar notificación al unirse alguien a tu partida
- [ ] Supabase Edge Function: disparar notificación al editar o cancelar partida
- [ ] Configurar `pg_cron` para transiciones automáticas de estado
  - [ ] `planned` → `in_progress` al llegar `start_at`
  - [ ] Recordatorio a las 5h si sigue `in_progress`
  - [ ] `in_progress` → `finished_no_result` a las 12h si no hay resultado
- [ ] Recordatorio automático 24h antes de la partida
- [ ] Recordatorio automático 2h antes de la partida
- [ ] Gestión de reintentos en `NotificationQueue` (max 3 intentos)

### F7 - Resultados

- [ ] Pantalla/modal de introducción de resultado
- [ ] Lógica de validación por equipo rival
- [ ] Pantalla/modal de confirmación o disputa de resultado
- [ ] Estado `resultado en revisión` cuando hay disputa
- [ ] Reporte automático generado al abrir una disputa

### F8 - Reportes (formulario)

- [ ] Pantalla/modal de reporte (usuario, partida o resultado)
- [ ] Lista de motivos predefinidos + comentario libre
- [ ] Guardar reporte como anónimo para el reportado

### CI/CD Fase 2

- [ ] Configurar EAS Submit para publicación automática en Google Play
- [ ] Configurar EAS Submit para publicación automática en App Store
- [ ] Pipeline completo: lint → type-check → tests → EAS Build → EAS Submit

---

## Fase 3 — Admin y Analíticas

### Migraciones de base de datos

- [ ] Crear tabla `audit_logs`
- [ ] Añadir índices de auditoría

### F8 - Panel de moderación

- [ ] Pantalla de lista de reportes abiertos (solo admin)
- [ ] Filtros por tipo de reporte y estado
- [ ] Acciones: resolver reporte, bloquear usuario, eliminar partida/resultado
- [ ] Registro automático en `audit_logs` de cada acción admin

### F9 - Panel de analíticas

- [ ] Pantalla de métricas para admin:
  - [ ] MAU (usuarios activos mensuales)
  - [ ] Partidas creadas (total y por semana)
  - [ ] % partidas con resultado confirmado
  - [ ] % con disputa
- [ ] Gráficas: serie temporal semanal de partidas
- [ ] Gráficas: barras por ciudad/pueblo (top 10)
- [ ] Ranking de usuarios por número de partidas

### Observabilidad avanzada

- [ ] Health checks cada 5 minutos para Edge Functions críticas
- [ ] Alertas en Sentry para errores 5xx y latencia alta
- [ ] Dashboard de performance en Sentry

---

## Backlog general (sin fase asignada)

- [ ] Pantalla de Términos y Condiciones (texto estático)
- [ ] Pantalla de Política de Privacidad (texto estático)
- [ ] Flujo de eliminación de cuenta (derecho de supresión RGPD)
- [ ] Pantalla de configuración de notificaciones avanzada
- [ ] Icono de app y splash screen
- [ ] Onboarding (primeras pantallas para nuevos usuarios)
- [ ] Tests unitarios de validaciones (E.164, reglas de partida)
- [ ] README de desarrollo con instrucciones de setup local
- [ ] Documentación de variables de entorno (`.env.example`)
