# Tareas - Mus Sin Fronteras

> Actualizado: 07/05/2026
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

- [ ] Crear proyecto en Supabase (vía MCP)
- [ ] Crear tabla `profiles` con migración versionada
- [ ] Crear tabla `matches` con migración versionada
- [ ] Crear tabla `match_participants` con migración versionada
- [ ] Configurar Row Level Security (RLS) en las tres tablas
- [ ] Crear trigger para sincronizar `auth.users` → `profiles`
- [ ] Crear índices de rendimiento (idx*matches_search, idx_matches_user_history, idx_participants*\*)
- [ ] Generar tipos TypeScript (vía MCP)

### F1 - Autenticación

- [ ] Instalar y configurar SDK de Supabase en la app
- [ ] Pantalla de login con email/contraseña
- [ ] Pantalla de registro con aceptación de términos y política de privacidad
- [ ] Pantalla de recuperación de contraseña
- [ ] Login con Google (OAuth via Supabase)
- [ ] Login con Apple ID (OAuth via Supabase)
- [ ] Persistencia de sesión entre cierres de la app
- [ ] Redirección automática: usuarios autenticados → pantalla principal, no autenticados → login
- [ ] Hook `useAuth.ts` con Zustand para estado global de sesión

### F2 - Perfil de usuario

- [ ] Pantalla de perfil (vista propia)
- [ ] Pantalla de edición de perfil
- [ ] Campo de teléfono con validación E.164 (formato `+34XXXXXXXXX`)
- [ ] Subida de foto de perfil a Supabase Storage (con compresión a ≤ 500KB)
- [ ] Preferencias de notificación (email y push)
- [ ] Lógica de visibilidad del teléfono: solo visible para participantes de la misma partida

### F3 - Ubicaciones

- [ ] Integrar JSON estático de municipios del INE
- [ ] Componente de selector de municipio con búsqueda local
- [ ] Campo "lugar por definir" en formulario de partida

### F4 - Partidas (Core)

- [ ] Pantalla de creación de partida (formulario completo)
  - [ ] Título, descripción
  - [ ] Fecha y hora (selector nativo)
  - [ ] Selector de ciudad/pueblo (municipios INE)
  - [ ] Lugar (texto libre o "por definir")
  - [ ] Duración en juegos (1-6, selector)
  - [ ] Visibilidad (pública / con enlace)
  - [ ] Notas opcionales
- [ ] Pantalla de detalle de partida
  - [ ] Información completa de la partida
  - [ ] Lista de participantes por equipo (A y B)
  - [ ] Botón "Unirse" (si hay plaza y no eres participante)
  - [ ] Botón "Abandonar" (si eres participante y partida en estado `planned`)
  - [ ] Botones "Editar" y "Cancelar" (solo para el creador)
  - [ ] Teléfonos visibles solo si eres participante confirmado
- [ ] Pantalla de edición de partida (mismo formulario que creación)
- [ ] Lógica de unirse a partida con selección de equipo
- [ ] Constraint: máximo 2 confirmados por equipo
- [ ] Historial de partidas del usuario (pestaña en perfil o pantalla separada)

### F5 - Descubrir y filtrar

- [ ] Pantalla principal con listado de partidas públicas
- [ ] Ordenación por fecha (próximas primero)
- [ ] Filtros: ciudad/pueblo, fecha, plazas libres, estado
- [ ] Búsqueda por texto (campo título)
- [ ] Paginación de 20 elementos (infinite scroll o botón "cargar más")
- [ ] Cache con TanStack Query (5 minutos)
- [ ] Estado vacío (sin partidas que coincidan con filtros)

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

---

## Completadas

- [x] Inicializar proyecto Expo con TypeScript
- [x] Configurar Expo Router
  - Nota: corregido root a `src/app` y añadida ruta `/` (redirect a login) para evitar "Unmatched Route" en web.
- [x] Configurar ESLint + Prettier
- [x] Configurar Husky + pre-commit hooks (lint + type-check)
- [x] Configurar GitHub Actions básico (lint + type-check en cada PR)

---

> **Instrucciones de actualización:** Al final de cada sesión de trabajo, mover las tareas completadas a la sección "Completadas", actualizar el estado del proyecto y reorganizar las tareas en progreso si es necesario.
