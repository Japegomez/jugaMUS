# Requisitos - jugaMUS

> Documento generado el 06/05/2026. Revisado y refinado en sesión colaborativa a partir del documento original `MVP_Mus_App.docx`.

---

## 1. Visión y Objetivo

App móvil para jugadores de mus en España que permite encontrar contrincantes y organizar partidas puntuales (día/hora/lugar). **No incluye lógica del juego.**

### Decisiones clave

- **Marca y legal (may. 2026):** nombre comercial **jugaMUS** (`APP_DISPLAY_NAME`; nombre en launcher vía `app.json`). Deep link scheme `jugamus`. Términos y privacidad con texto estático y disclaimer «Texto legal definitivo pendiente de revisión jurídica.» hasta revisión legal.
- **CI/CD (may. 2026):** el workflow de EAS en GitHub Actions (`eas.yml`, push a `main`) incluye **Android** (build + submit a Play internal) e **iOS** (build + submit a TestFlight vía ASC API key en EAS; mergeado en `develop` con PR #59, pendiente release `develop` → `main`). Secret GitHub: `EXPO_TOKEN`, `GOOGLE_PLAY_SERVICE_KEY_JSON`. En EAS `production`: `GOOGLE_SERVICES_JSON`, `SENTRY_AUTH_TOKEN`, **`EXPO_PUBLIC_SUPABASE_URL`** / **`EXPO_PUBLIC_SUPABASE_ANON_KEY`**. iOS: `ascAppId` `6775626292`, Sign in with Apple nativo (Supabase `Client IDs` = bundle ID).
- **Legal / Play (may. 2026):** URLs públicas de privacidad y eliminación de cuenta vía **GitHub Pages** (`docs/` en `main`, carpeta `/docs`). Contacto de soporte: `japenago@gmail.com`. Package Android: `com.javiwacho.musapp`; slug EAS `musapp`.
- **Partidas (may. 2026):** el creador puede cancelar partidas en `planned` e `in_progress` desde la ficha (no hace falta ser participante). En web, las confirmaciones destructivas (cancelar, abandonar, aprobar resultado) usan **modales** en lugar de `Alert.alert`, que no es fiable en Expo Web.
- **Plantilla mixta (may. 2026):** en crear/editar se pueden añadir compañeros/rivales **por nombre** además de cuentas registradas; las plazas (UI, explore y cron) cuentan texto + confirmados (máx. 2 por equipo). El creador puede registrar marcador **sin validación rival** solo si no hay otros participantes con cuenta y la partida está **`in_progress`** (`record_match_result_direct`). Tras aprobar un resultado rival, un trigger en BD confirma el resultado y finaliza la partida (`018`).
- **Eliminación de cuenta (may. 2026):** derecho de supresión RGPD vía Edge Function `delete-account`. Se borran auth, perfil, avatar y datos personales (reportes, cola de notificaciones). El **historial de partidas se anonimiza**, no se elimina: referencias pasan al perfil interno **Usuario eliminado** (sentinel); las participaciones en plantilla se reasignan al sentinel para que sigan visibles en la UI.
- **Notificaciones en perfil (may. 2026):** preferencias por **canal** (email, push) y por **evento** (unión, cambio de partida, resultado, recordatorios) editables en la pantalla de perfil; enlaces legales (términos, privacidad) en la misma pantalla.
- **Branding (may. 2026):** icono y splash con diseño minimalista de baraja española (basto); color de fondo `#1a5f4a` en splash e icono adaptativo Android.
- **UI Ultra Limpio (may. 2026):** rediseño visual con tokens en `src/theme/` (fondo blanco, verde `#1A5F4A`, tipografía DM Sans). Listas principales (Mis partidas, Descubrir) con filas y punto de estado; previews con `ciudad · lugar`; cabecera Mis partidas sin contador de activas; FAB speed-dial encima de la tab bar; tab bar activa en verde brand. Pendiente commit/PR desde rama `feature/ui-redesign`.
- **Torneos (may. 2026):** eliminación directa con parejas mixtas (registradas + texto). Partidos del cuadro reutilizan `matches` (`tournament_id`, metadatos de ronda). FAB speed-dial: crear partida u organizar torneo. Cuadro visual en canvas SVG con resultados por enfrentamiento. Byes automáticos si faltan parejas para potencia de 2; **partidas bye no cuentan** en historial ni analíticas admin. Avance de ronda al confirmar resultado (incl. propagación bye y relleno parcial del cuadro); partido siguiente con `start_at = NOW()`. Torneo pasa a `finished` al cerrar la final. Organizador puede ser árbitro (sin jugar); registra resultado directo si todos los jugadores del partido son texto. **Un jugador registrado solo en una pareja** por torneo. Descubrir: filtro partidas/torneos; partidas del cuadro no listadas ni unibles manualmente. Detalle y tarjetas muestran organizador y `ciudad · lugar`. Lugar en formularios: nombre obligatorio o «Lugar por definir». Historial de perfil colorea victoria/derrota. Cache de torneos: refetch al foco + polling 30 s en detalle (multi-dispositivo). **Edición de parejas (may. 2026):** el organizador puede editar nombre opcional y plazas en texto, o eliminar parejas, solo en fase de inscripción y antes de generar el cuadro (RPCs `update_tournament_pair` / `remove_tournament_pair`, migración `055`). En la ficha de un partido del cuadro, enlace **🏆 Ir al torneo** al detalle del torneo.
- **Perfil ajeno (may. 2026):** pantalla de solo lectura `/(tabs)/profile/[userId]` con nombre, ciudad y teléfono (visible si el visitante comparte partida confirmada con ese usuario, o reglas equivalentes de `get_public_profile`). Historial de partidas del usuario mostrado limitado a las que el visitante puede leer; cada fila abre el detalle de la partida. Acceso desde el nombre/avatar de un participante registrado en la ficha de partida. RPCs `get_viewable_user_profile` y `list_user_viewable_matches` (migración `056`).
- **Marcador en vivo (may. 2026):** pantalla «Llevar la cuenta» en partidas `in_progress`; estado persistido **solo en el dispositivo** (AsyncStorage / `localStorage`). Incluye fases del mus, envites, órdago y ajuste de puntos. «Registrar resultado» abre el modal con juegos pre-rellenados desde el marcador. No hay sync multi-dispositivo ni persistencia en servidor hasta enviar el resultado oficial.
- **Plantilla y cron (may. 2026):** unirse solo en `planned`. Al llegar `start_at`, cron promueve a `in_progress` solo con roster completo (4 plazas); si no, `cancelled`. Partida con hora actual y plantilla llena queda `in_progress` al crear/unirse. Detalle de partida refetch al foco para coherencia con Mis partidas.
- **Audiencia**: híbrida — partidas públicas (cualquiera puede unirse) y partidas privadas por enlace (para peñas y amigos)
- **Alcance geográfico MVP**: España completa
- **Plataformas**: Android e iOS desde el primer lanzamiento
- **Idioma MVP**: Español. Preparado para i18n en fases posteriores.

---

## 2. Alcance y Fases de Desarrollo

El desarrollo se organiza en tres fases para que sea viable para un único desarrollador:

| Fase                    | Contenido                            | Descripción                                                         |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------------- |
| **Fase 1 - Core**       | Auth, Perfil, Partidas, Descubrir    | Lo mínimo para que la app sea funcional                             |
| **Fase 2 - Resultados** | Notificaciones, Resultados, Reportes | Ciclo de vida completo de una partida                               |
| **Fase 3 - Admin**      | Panel admin, Analíticas, Disputas    | Herramientas de gestión y moderación                                |
| **Fase 4 - Torneos**    | Cuadros, parejas, avance automático  | Organización de torneos eliminatorios                               |
| **Fase 5 - Marcador**   | Marcador en vivo local               | Conteo de puntos/juegos durante la partida (sin lógica en servidor) |

### Fuera del alcance total

- Ligas y clasificaciones
- Chat interno
- Geolocalización GPS
- Modo offline
- Reputación y valoraciones
- Integración con redes sociales
- Verificación de teléfono por SMS
- Compartir partida en redes sociales

---

## 3. Roles de Usuario

Solo dos roles en el MVP:

| Rol         | Capacidades                                                                                                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`user`**  | Crear, editar y cancelar sus partidas; unirse y abandonar partidas; ver teléfonos de participantes de sus partidas; editar su perfil; configurar notificaciones; eliminar su cuenta; recibir notificaciones |
| **`admin`** | Todo lo anterior + gestionar reportes, bloquear/desactivar usuarios, eliminar partidas y resultados                                                                                                         |

- **Sin invitados**: registro obligatorio para cualquier acción
- Los privilegios de creador de partida se gestionan por el campo `creator_id` (no es un rol separado)
- El admin opera via Supabase Studio en Fase 1 y 2. El panel visual admin se desarrolla en Fase 3.

---

## 4. Funcionalidades

### F1 - Autenticación (Fase 1)

- Login con Google
- Login con Apple ID (obligatorio por requisitos de App Store)
- Login con email y contraseña
- Registro con aceptación de términos y política de privacidad
- Recuperación de contraseña para usuarios de email
- Gestión de sesiones con JWT y refresh tokens (gestionado por Supabase Auth)
- Estado de sesión persistente entre cierres de la app
- Eliminación de cuenta (RGPD): borrado de identidad + anonimización del historial en partidas/resultados

### F2 - Perfil de usuario (Fase 1)

- Nombre a mostrar (obligatorio)
- Teléfono (obligatorio, validación formato E.164; en la app: selector de prefijo por país + validación genérica ITU-T, ej. `+34612345678` u otros países del listado)
- Localidad/pueblo (opcional, informativo)
- Foto de perfil (opcional, comprimida automáticamente a ≤ 500KB)
- Preferencias de notificación en pantalla de perfil:
  - **Canal:** email y/o push
  - **Por evento:** unión a partida, edición/cancelación, resultado, recordatorios (columnas `notify_on_*` en `profiles`, migración `022`)
- Enlaces a términos y política de privacidad desde el perfil
- **Perfil de otro usuario (solo lectura):** nombre, ciudad, teléfono según permisos del servidor e historial de partidas visibles; navegación desde participantes registrados en detalle de partida
- **El teléfono solo es visible para participantes de la misma partida confirmada** (también en perfil ajeno vía RPC)
- Opción de ocultar ubicación exacta a no participantes
- Eliminación de cuenta con confirmación modal (`DeleteAccountModal`)

### F3 - Ubicaciones (Fase 1)

- Lista de municipios de España (fuente: INE, JSON estático, filtrado local)
- No requiere GPS ni permisos de ubicación
- Opción "lugar por definir" en el campo de lugar de la partida
- Posibilidad de ocultar ubicación exacta a no participantes

### F4 - Partidas (Fase 1 + 2)

**Crear partida (Fase 1)**

- Modalidad fija: 2vs2 (4 jugadores total, equipos A y B)
- Campos: título, descripción, fecha/hora (UTC internamente), ciudad/pueblo, lugar (o "por definir"), duración en juegos (1-6, primer equipo que llegue a X), visibilidad (pública/con enlace), notas opcionales

**Gestión (Fase 1)**

- Solo el creador puede editar o cancelar una partida
- Cualquier usuario registrado puede unirse a una partida pública o con enlace si hay plaza
- Cualquier participante puede abandonar antes de que empiece
- Cambio de equipo permitido solo si la partida está en estado `planned` y hay hueco

**Estados de partida**

- `planned` → `in_progress` (automático al llegar `start_at`, Fase 2)
- `in_progress` → recordatorio a las 5h si sigue en curso (Fase 2)
- `in_progress` → `finished_no_result` a las 12h si no hay resultado registrado (Fase 2)
- `in_progress` → `finished` cuando hay `MatchResult` confirmado sin disputas (Fase 2)
- En Fase 1, los estados se actualizan manualmente o al registrar resultado

**Historial (Fase 1)**

- Cada usuario tiene acceso a su historial de partidas pasadas

### F5 - Descubrir y filtrar (Fase 1)

- Listado de partidas públicas ordenado por fecha
- Filtros: fecha, ciudad/pueblo, plazas libres, visibilidad, estado
- Búsqueda por texto en el campo título
- Paginación de 20 elementos por página
- Cache de respuestas con TanStack Query (5 minutos)
- Las partidas `visibility: link` no aparecen en el listado general

### F6 - Comunicación (Fase 1)

- Sin chat interno
- El teléfono del participante solo es visible para los demás participantes de la misma partida confirmada
- La coordinación se delega a medios externos (WhatsApp, llamada)

### F7 - Notificaciones y resultados

**Notificaciones básicas (Fase 2)**

- Push + email cuando alguien se une a tu partida
- Push + email cuando la partida es editada o cancelada
- Push + email al ser expulsado o cuando alguien abandona
- Preferencias granulares en cliente (canal + evento); **pendiente:** que triggers/cron respeten `notify_on_*` además de `notify_push`/`notify_email`

**Notificaciones automáticas (Fase 2)**

- Recordatorio 24h y 2h antes de la partida
- Aviso a las 5h si la partida sigue en curso (para registrar resultado)
- A las 12h sin resultado: estado → `finished_no_result` (con aviso)

**Resultados (Fase 2)**

- Cualquier participante puede introducir el resultado
- Al menos un integrante del equipo rival debe validarlo para confirmarlo
- Si hay disputa: estado `resultado en revisión` + reporte automático
- Cola de notificaciones robusta con reintentos (tabla `NotificationQueue`)

### F8 - Reportes y moderación

**Formulario de reporte (Fase 2)**

- Cualquier usuario registrado puede reportar: usuarios, partidas o resultados
- Motivo seleccionable de una lista + campo de comentario libre
- El reporte es anónimo para el usuario reportado

**Panel de gestión (Fase 3)**

- Interfaz de admin para ver y gestionar reportes abiertos
- Acciones: bloquear/desactivar usuario, eliminar partida/resultado
- Registro de auditoría de todas las acciones administrativas
- **Portada admin (may. 2026):** solo navegación a moderación de reportes y analíticas detalladas; las métricas viven en la pantalla de analíticas, no en el dashboard.

### F9 - Analítica y panel (Fase 1 + 3)

**Analytics de comportamiento (Fase 1)**

- PostHog integrado desde el inicio (sin panel custom)
- Captura eventos de usuario: registro, login, creación de partida, unirse, etc.

**Panel de métricas admin (Fase 3)**

- MAU (usuarios activos mensuales), partidas creadas, partidas con resultado
- % con disputa, tiempo medio hasta registrar resultado
- Gráficas: serie temporal semanal, barras por ciudad, distribución por estado
- Ranking de usuarios por número de partidas
- Acceso solo para administradores

---

## 5. Stack Tecnológico e Infraestructura

### Frontend

| Tecnología      | Versión | Propósito                                        |
| --------------- | ------- | ------------------------------------------------ |
| React Native    | 0.73+   | Framework base para apps móviles                 |
| Expo            | SDK 51+ | Abstracción de iOS/Android, builds y publicación |
| Expo Router     | v3+     | Navegación basada en sistema de archivos         |
| TypeScript      | 5+      | Tipado estático                                  |
| Zustand         | última  | Estado global local (usuario autenticado, UI)    |
| TanStack Query  | v5      | Cache y sincronización de datos del servidor     |
| React Hook Form | v7      | Gestión de formularios y validaciones            |

### Backend

| Tecnología              | Propósito                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| Supabase                | BaaS: base de datos, auth, storage, edge functions, realtime                                           |
| PostgreSQL              | Base de datos relacional (vía Supabase)                                                                |
| Supabase Auth           | Autenticación (Google, Apple, email) con JWT                                                           |
| Supabase Storage        | Fotos de perfil con transformaciones automáticas                                                       |
| Supabase Edge Functions | Lógica del servidor, cron jobs, disparador de notificaciones, eliminación de cuenta (`delete-account`) |
| `pg_cron`               | Jobs programados para transiciones automáticas de estado                                               |

### Servicios externos

| Servicio                | Propósito                                         | Tier gratuito |
| ----------------------- | ------------------------------------------------- | ------------- |
| Expo EAS Build          | Builds automatizados para iOS y Android           | Sí (limitado) |
| Expo EAS Submit         | Publicación automática en Google Play y App Store | Sí            |
| Expo Push Notifications | Servicio proxy para FCM (Android) y APNs (iOS)    | Sí            |
| Sentry                  | Crash reporting y performance monitoring          | Sí            |
| PostHog                 | Analytics de comportamiento de usuario            | Sí            |
| GitHub                  | Control de versiones + GitHub Actions para CI/CD  | Sí            |

### Lista de municipios

- Fuente: INE (Instituto Nacional de Estadística), España
- Formato: JSON estático incluido en el bundle de la app
- Filtrado: local, sin llamadas de red

---

## 6. Modelo de Datos

Todos los IDs son **UUID v4** (generados por Supabase).

### Fase 1 — Tablas activas

```sql
-- Extiende auth.users de Supabase (sincronizado via trigger)
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  phone_e164  TEXT NOT NULL,              -- Formato: +34612345678
  city        TEXT,
  photo_url   TEXT,
  notify_email BOOLEAN NOT NULL DEFAULT TRUE,
  notify_push  BOOLEAN NOT NULL DEFAULT TRUE,
  -- Migración 022 (may. 2026):
  notify_on_join BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_match_change BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_result BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_reminder BOOLEAN NOT NULL DEFAULT TRUE,
  push_token   TEXT,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE matches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  description           TEXT,
  start_at              TIMESTAMPTZ NOT NULL,
  city                  TEXT NOT NULL,
  place_text            TEXT,
  place_defined         BOOLEAN NOT NULL DEFAULT TRUE,
  location_privacy      TEXT NOT NULL DEFAULT 'public_city_only'
                          CHECK (location_privacy IN ('public_city_only', 'participants_only')),
  duration_target_games INT NOT NULL CHECK (duration_target_games BETWEEN 1 AND 6),
  visibility            TEXT NOT NULL DEFAULT 'public'
                          CHECK (visibility IN ('public', 'link')),
  creator_id            UUID NOT NULL REFERENCES profiles(id),
  status                TEXT NOT NULL DEFAULT 'planned'
                          CHECK (status IN ('planned', 'in_progress', 'finished', 'finished_no_result')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE match_participants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id),
  team       TEXT NOT NULL CHECK (team IN ('A', 'B')),
  state      TEXT NOT NULL DEFAULT 'confirmed' CHECK (state IN ('confirmed', 'left')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at    TIMESTAMPTZ,
  UNIQUE (match_id, user_id)  -- Un usuario solo puede estar una vez por partida
);

-- Constraint: máximo 2 confirmados por equipo (gestionado via trigger o check)
```

### Fase 2 — Tablas añadidas

```sql
CREATE TABLE match_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            UUID NOT NULL REFERENCES matches(id),
  team_a_games        INT NOT NULL,
  team_b_games        INT NOT NULL,
  submitted_by_team   TEXT NOT NULL CHECK (submitted_by_team IN ('A', 'B')),
  submitted_by_user_id UUID NOT NULL REFERENCES profiles(id),
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status              TEXT NOT NULL DEFAULT 'pending_validation'
                        CHECK (status IN ('pending_validation', 'confirmed', 'disputed', 'void'))
);

CREATE TABLE result_confirmations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_result_id  UUID NOT NULL REFERENCES match_results(id),
  user_id          UUID NOT NULL REFERENCES profiles(id),
  team             TEXT NOT NULL CHECK (team IN ('A', 'B')),
  decision         TEXT NOT NULL CHECK (decision IN ('approve', 'dispute')),
  comment          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type  TEXT NOT NULL CHECK (target_type IN ('user', 'match', 'result')),
  target_id    UUID NOT NULL,
  reason       TEXT NOT NULL,
  notes        TEXT,
  reporter_id  UUID NOT NULL REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  action_taken TEXT,
  resolved_at  TIMESTAMPTZ,
  resolved_by  UUID REFERENCES profiles(id)
);

CREATE TABLE notification_queue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id),
  type           TEXT NOT NULL,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  payload_json   JSONB,
  scheduled_for  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts       INT NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'sent', 'failed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at        TIMESTAMPTZ
);

CREATE TABLE match_state_transitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID NOT NULL REFERENCES matches(id),
  from_status   TEXT NOT NULL,
  to_status     TEXT NOT NULL,
  triggered_by  TEXT NOT NULL CHECK (triggered_by IN ('user', 'system')),
  user_id       UUID REFERENCES profiles(id),
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Fase 3 — Tablas añadidas

```sql
CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES profiles(id),
  action       TEXT NOT NULL,
  target_type  TEXT NOT NULL,
  target_id    UUID,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata_json JSONB
);
```

### Índices de rendimiento

```sql
-- Búsquedas principales de partidas
CREATE INDEX idx_matches_search ON matches (city, start_at, status);
CREATE INDEX idx_matches_user_history ON matches (creator_id, created_at DESC);

-- Participantes
CREATE INDEX idx_participants_match_team ON match_participants (match_id, team, state);
CREATE INDEX idx_participants_user ON match_participants (user_id, joined_at DESC);

-- Administración (Fase 3)
CREATE INDEX idx_reports_status ON reports (status, created_at DESC);
CREATE INDEX idx_audit_logs_search ON audit_logs (target_type, target_id, created_at DESC);

-- Notificaciones (Fase 2)
CREATE INDEX idx_notifications_pending ON notification_queue (status, scheduled_for)
  WHERE status = 'pending';
```

---

## 7. Arquitectura de la Aplicación

### Estructura de carpetas

```
src/
├── app/                    # Rutas con Expo Router (basado en sistema de archivos)
│   ├── (auth)/             # Pantallas sin autenticar
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/             # Navegación con tabs (requiere autenticación)
│   │   ├── matches/        # Listado, detalle y creación de partidas
│   │   │   ├── index.tsx   # Listado y filtros
│   │   │   ├── [id].tsx    # Detalle de partida
│   │   │   └── create.tsx  # Formulario de creación
│   │   └── profile/        # Perfil (notificaciones, legal, historial)
│   │       ├── index.tsx
│   │       └── edit.tsx
│   └── admin/              # Panel admin (Fase 3, acceso restringido)
├── components/             # Componentes UI reutilizables
│   ├── ui/                 # Primitivos: Button, Input, Card, Badge
│   └── matches/            # MatchCard, ParticipantList, TeamSlot
├── lib/                    # Configuración de servicios externos
│   ├── supabase.ts         # Cliente Supabase + tipos generados
│   └── sentry.ts           # Configuración Sentry
├── hooks/                  # Custom hooks
│   ├── useAuth.ts          # Estado de autenticación
│   ├── useMatches.ts       # Queries de partidas (TanStack Query)
│   ├── useProfile.ts       # Query y mutations de perfil
│   └── useNotifications.ts # Registro de push notifications
├── services/               # Lógica de negocio (llamadas a Supabase)
│   ├── matches.service.ts
│   ├── profiles.service.ts
│   └── results.service.ts  # Fase 2
├── types/                  # Tipos TypeScript
│   └── database.types.ts   # Generado por Supabase (preferente vía MCP)
├── utils/                  # Helpers
│   ├── formatters.ts       # Fechas, teléfonos
│   ├── validators.ts       # Validación E.164, etc.
│   └── municipalities.ts   # Lista de municipios del INE
├── constants/              # Enums y configuración
└── assets/                 # Imágenes, iconos, fuentes
```

### Gestión de estado

| Herramienta         | Para qué                                      | Ejemplo de uso                             |
| ------------------- | --------------------------------------------- | ------------------------------------------ |
| **Zustand**         | Estado global local (sesión, preferencias UI) | `useAuthStore()` — quién está logueado     |
| **TanStack Query**  | Cache y sincronización de datos del servidor  | `useMatches()` — listado con cache de 5min |
| **React Hook Form** | Estado y validación de formularios            | Formulario de creación de partida          |

### Flujo de datos

```
Pantalla (Expo Router)
    ↓ acción usuario
Custom Hook (useMatches, useAuth...)
    ↓ query / mutation
TanStack Query (cache, loading, error states)
    ↓ llamada al servidor
Service (matches.service.ts)
    ↓ SDK de Supabase
Supabase (PostgreSQL + Auth + Storage)
```

---

## 8. Requisitos No Funcionales

### Performance

- Arranque en frío < 2 segundos en dispositivo de gama media
- Scroll fluido a 60 fps en listados con virtualización
- Respuestas de API p95 < 500ms en operaciones principales
- Paginación de 20 elementos en todos los listados
- Cache del lado cliente con TanStack Query (5 minutos por defecto)

### Disponibilidad

- 99.5% uptime en MVP (ofrecido por Supabase en tier Pro)
- Backups automáticos diarios de base de datos (incluidos en Supabase)
- Migraciones versionadas con Supabase (preferente vía MCP; CLI opcional)

### Seguridad

- OAuth2/OIDC para Google y Apple; PKCE explícito en cliente (`flowType: 'pkce'`)
- Contraseñas con Argon2 (gestionado por Supabase Auth)
- TLS extremo a extremo
- JWT con expiración corta + refresh tokens
- Rate limiting por IP y usuario (Supabase + Edge Functions)
- Protección CSRF/XSS/SSRF, validación exhaustiva de inputs
- Row Level Security (RLS) de PostgreSQL para aislar datos por usuario
- **Hardening (may. 2026, migraciones 038–047):**
  - Trigger anti-escalada: usuarios no pueden auto-modificar `role` ni `status` en `profiles`
  - `match_results`: sin INSERT directo vía RLS; solo RPCs validadas (`submit_match_result`, etc.)
  - REVOKE de RPCs internas (`enqueue_notification`, `advance_tournament_round`, etc.)
  - PII: `phone_e164` y `push_token` ocultos en SELECT directo; RPCs `get_own_profile`, `get_public_profile`, `get_profile_with_phone`
  - Vista `profiles_public`; whitelist de `photo_url` al bucket `avatars`
  - `process-notifications`: autenticación por header `X-Cron-Secret` (no JWT público)
  - Cron: URL y secreto en `private.runtime_config` (047)
  - Explore: `list_public_matches` enmascara `place_text` si `location_privacy = participants_only`
  - Torneos: no asignar `player_*_user_id` de terceros en parejas
  - Join a partidas: solo `planned`, visibilidad `public`/`link`, máx. 4 confirmados
  - Sentry: `sendDefaultPii: false`, replay reducido, filtrado de headers sensibles
  - OAuth release: solo scheme `jugamus://` (Expo Go schemes solo en `__DEV__`)

### Privacidad (RGPD)

- Consentimiento explícito en el registro
- Derecho de supresión: borrado de cuenta (auth + perfil + avatar + reportes personales). El historial agregado de partidas **se anonimiza** (perfil sentinel «Usuario eliminado»), no se destruye, para no perjudicar a otros jugadores.
- Minimización de datos: teléfono visible solo para participantes de la misma partida
- Política de privacidad y términos visibles en la app (registro y perfil)
- DPA agreements con servicios externos (Supabase, PostHog, Sentry)

### Observabilidad

- Crash reporting: Sentry (errores automáticos + performance)
- Analytics: PostHog (comportamiento de usuario)
- Alertas: errores 5xx, latencia alta, caídas de servicio
- Health checks: Edge Functions críticas cada 5 minutos (Fase 2)

### Accesibilidad

- Dynamic Type (texto adaptable al tamaño del sistema)
- Labels accesibles para lectores de pantalla (VoiceOver / TalkBack)
- Contraste de color mínimo WCAG 2.1 AA

### Internacionalización

- Idioma MVP: Español
- Arquitectura preparada para i18n (cadenas externalizadas)

### Distribución

- Google Play y App Store desde el primer lanzamiento
- Gestión de builds con Expo EAS Build
- Publicación automática con Expo EAS Submit

---

## 9. Criterios de Aceptación

### Fase 1 — Core

**Autenticación**

- CA_AUTH1: Un usuario puede registrarse con email/contraseña y recibe email de confirmación
- CA_AUTH2: Un usuario puede autenticarse con Google
- CA_AUTH3: Un usuario puede autenticarse con Apple ID
- CA_AUTH4: Un usuario puede recuperar su contraseña por email
- CA_AUTH5: La sesión persiste entre cierres de la app (refresh token)
- CA_AUTH6: Un usuario con `status: suspended` no puede iniciar sesión
- CA_AUTH7: Un usuario puede eliminar su cuenta; se borra la identidad y se anonimiza su huella en partidas/resultados (perfil sentinel «Usuario eliminado»)

**Perfil**

- CA_PROF1: El teléfono se valida en formato E.164 antes de guardar
- CA_PROF2: La foto de perfil se redimensiona automáticamente a ≤ 500KB al subir
- CA_PROF3: El teléfono solo aparece visible para participantes de la misma partida confirmada
- CA_PROF4: Las preferencias de notificación (canal y por evento) se editan desde el perfil y persisten en `profiles`

**Partidas**

- CA_MATCH1: Solo el creador puede editar o cancelar una partida
- CA_MATCH2: No es posible superar 2 jugadores confirmados por equipo (A o B)
- CA_MATCH3: Una partida cancelada no admite nuevas inscripciones
- CA_MATCH4: Las partidas `visibility: link` no aparecen en el listado general
- CA_MATCH5: El historial muestra todas las partidas pasadas del usuario autenticado
- CA_MATCH6: El listado implementa paginación de 20 elementos

**Performance**

- CA_PERF1: Arranque en frío < 2 segundos en dispositivo de gama media
- CA_PERF2: Scroll en listados sin lags visibles (60 fps)
- CA_PERF3: Respuestas de API p95 < 500ms en operaciones principales
- CA_PERF4: TanStack Query cachea respuestas de API durante 5 minutos

### Fase 2 — Resultados y notificaciones

**Notificaciones**

- CA_NOTIF1: El creador recibe push cuando alguien se une a su partida
- CA_NOTIF2: Los participantes reciben push si la partida es editada o cancelada
- CA_NOTIF3: Recordatorio automático 24h y 2h antes de la partida
- CA_NOTIF4: El usuario puede desactivar notificaciones push y/o email desde el perfil
- CA_NOTIF5: El usuario puede desactivar tipos concretos de notificación por evento desde el perfil

**Resultados**

- CA_RES1: Cualquier participante puede introducir el resultado de su partida
- CA_RES2: Al menos un integrante del equipo rival debe validar el resultado para confirmarlo
- CA_RES3: Si hay disputa, el estado cambia a `resultado en revisión` y se genera reporte automático
- CA_RES4: Un resultado puede introducirse manualmente incluso si la partida está en `finished_no_result`

### Fase 3 — Admin y analíticas

**Moderación**

- CA_MOD1: Los errores se reportan automáticamente a Sentry
- CA_MOD2: El panel admin muestra reportes abiertos con filtros por tipo y estado
- CA_MOD3: El admin puede bloquear un usuario y todos sus accesos quedan revocados inmediatamente

**Monitorización**

- CA_MON1: Los health checks verifican servicios críticos cada 5 minutos
- CA_MON2: Las métricas de performance se capturan en cliente (Sentry) y servidor (Supabase logs)

### Fase 4 — Torneos (ampliación may. 2026)

**Parejas e inscripción**

- CA_TOUR1: El organizador puede editar una pareja (nombre opcional, jugadores en texto) mientras el torneo está en inscripción y no se ha generado el cuadro
- CA_TOUR2: El organizador puede eliminar una pareja en las mismas condiciones; las plazas con cuenta registrada no son editables en texto
- CA_TOUR3: Tras generar el cuadro o fuera de inscripción, no se ofrecen acciones de edición/eliminación de parejas

**Navegación**

- CA_TOUR4: En el detalle de un partido perteneciente a un torneo, un enlace **🏆 Ir al torneo** lleva al detalle de ese torneo

**Perfil ajeno**

- CA_PROF5: Un usuario autenticado puede abrir el perfil de otro jugador registrado desde la ficha de partida
- CA_PROF6: El perfil ajeno muestra historial de partidas filtrado por lo que el visitante puede leer; al pulsar una fila se abre el detalle de la partida
- CA_PROF7: Sin permiso de visibilidad, el perfil ajeno no expone datos (pantalla de error o vacía)

---

## 10. Funcionalidades Pospuestas

Las siguientes funcionalidades están **fuera del MVP** y serán evaluadas para versiones futuras:

| Funcionalidad                           | Motivo del aplazamiento                                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ligas y clasificaciones                 | Alta complejidad (calendario, brackets, puntuaciones)                                                                                                           |
| Chat interno                            | Requiere moderación constante; se delega en WhatsApp                                                                                                            |
| Geolocalización GPS exacta              | Sacrifica privacidad sin aportar valor suficiente en el MVP                                                                                                     |
| Autenticación con Apple ID              | ~~Pospuesta~~ **Movida al MVP** (obligatorio para App Store)                                                                                                    |
| Soporte multilenguaje completo (i18n)   | No prioritario hasta tener masa crítica de usuarios                                                                                                             |
| Notificaciones personalizadas avanzadas | ~~Fase 3~~ **Implementado (may. 2026):** toggles por canal y evento en perfil; pendiente cablear triggers/cron a `notify_on_*` si se desea filtrado en servidor |
| Sistema de reputación y valoraciones    | Necesita masa crítica de usuarios para ser útil                                                                                                                 |
| Integración con redes sociales          | No crítico para el MVP                                                                                                                                          |
| Modo offline/sincronización             | Alta complejidad de sincronización; conexión asumida                                                                                                            |
| Verificación de teléfono por SMS        | Añade coste (Twilio ~0.05€/SMS) y complejidad; valorar en v2                                                                                                    |
| Compartir partida en redes sociales     | Útil para crecimiento orgánico; valorar en Fase 2 o 3                                                                                                           |

---

## 11. Metodología de Desarrollo

### Herramientas

| Área                 | Herramienta                                            |
| -------------------- | ------------------------------------------------------ |
| Control de versiones | Git + GitHub                                           |
| Gestión de tareas    | `TASKS.md` en el repositorio (actualizado cada sesión) |
| CI/CD                | GitHub Actions + Expo EAS Build + EAS Submit           |
| Linting y formato    | ESLint + Prettier                                      |
| Commits              | Conventional Commits (`feat(scope): descripción`)      |
| Quality gates        | Husky (pre-commit: lint + type-check)                  |
| Testing              | Jest (solo lógica crítica: validaciones, servicios)    |
| Migraciones DB       | Supabase (preferente vía MCP; CLI opcional)            |

### GitFlow (estructura de ramas)

Se utilizará **GitFlow** como estrategia de branching:

- **Ramas permanentes**
  - **`main`**: rama de producción. Cada release se etiqueta (ej. `v0.1.0`).
  - **`develop`**: integración continua de lo que entrará en el próximo release.

- **Ramas temporales**
  - **`feature/<nombre>`**: nace desde `develop`, se mergea a `develop`.
  - **`release/<version>`**: nace desde `develop`, se mergea a `main` y luego se mergea de vuelta a `develop`.
  - **`hotfix/<version-o-bug>`**: nace desde `main`, se mergea a `main` y luego a `develop`.

Reglas operativas:

- No se desarrolla directamente sobre `main`.
- Todo desarrollo va a `feature/*` desde `develop`.
- El código en `main` siempre debe ser desplegable/publicable.

### Estrategia de testing

Cobertura mínima en lógica crítica:

- Validaciones de datos (teléfono E.164, campos de partida)
- Reglas de negocio (límite de participantes, cambios de estado)
- Servicios de Supabase (mocks)

No se escriben tests de componentes UI en las fases iniciales.

### Conventional Commits

Formato: `tipo(scope): descripción en imperativo`

Tipos: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `ci`

Ejemplos:

```
feat(matches): add join match functionality
fix(auth): handle Google token expiry on cold start
chore(deps): update Expo SDK to 52
docs(readme): add local setup instructions
```

### Flujo de trabajo por sesión

1. Revisar y actualizar `TASKS.md`
2. Seleccionar tarea del backlog de la fase actual
3. Implementar con commits atómicos (Conventional Commits)
4. Pasar quality gates (Husky)
5. Al finalizar la sesión: actualizar `TASKS.md` con progreso y reorganizar pendientes
