<div align="center">

<img src="icon-512.png" alt="Icono de jugaMUS" width="128" height="128" />

# 🃏 jugaMUS

### Encuentra contrincantes. Organiza partidas. Vive el mus.

_Aplicación móvil multiplataforma para la comunidad de jugadores de mus en España_

---

[![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=flat-square&logo=react&logoColor=white)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo_SDK-54-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)

<br />

**Disponible en las principales tiendas**

[![App Store](https://img.shields.io/badge/App_Store-Descargar-0D96F6?style=for-the-badge&logo=app-store&logoColor=white)](https://apps.apple.com/es/app/jugamus/id6775626292)
[![Google Play](https://img.shields.io/badge/Google_Play-Descargar-414141?style=for-the-badge&logo=google-play&logoColor=white)](https://play.google.com/store/apps/details?id=com.javiwacho.musapp)

</div>

---

## 📋 Visión del proyecto

**jugaMUS** conecta a jugadores de mus que desean encontrar contrincantes y coordinar partidas puntuales — día, hora y lugar — sin incorporar la lógica del juego en la aplicación. El producto abarca desde la organización informal entre amigos hasta torneos eliminatorios con cuadros visuales, con un enfoque en privacidad, cumplimiento normativo y experiencia de usuario cuidada.

La aplicación está **publicada y disponible** en las principales tiendas de aplicaciones — [App Store](https://apps.apple.com/es/app/jugamus/id6775626292) y [Google Play](https://play.google.com/store/apps/details?id=com.javiwacho.musapp) —, con soporte web complementario.

---

## 🧭 Metodología: Spec-Driven Development

El desarrollo de **jugaMUS** se ha llevado a cabo bajo la filosofía de **Spec-Driven Development** (_desarrollo guiado por especificaciones_): un enfoque en el que los requisitos y las especificaciones constituyen la fuente de verdad del proyecto y toda decisión de implementación deriva de documentos formales acordados previamente.

### ¿Qué implica en la práctica?

Antes de escribir una sola línea de producto, se definieron de forma explícita:

| Documento                        | Propósito                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------- |
| 📄 **Requisitos funcionales**    | Visión, alcance, roles, criterios de aceptación y decisiones de producto         |
| ✅ **Criterios de aceptación**   | Condiciones verificables por cada funcionalidad antes de considerarla completada |
| 📌 **Backlog por fases**         | Desglose de tareas agrupadas por dominio y prioridad evolutiva                   |
| 🔒 **Requisitos no funcionales** | Seguridad, rendimiento, privacidad, observabilidad y distribución                |

Este marco permitió mantener coherencia entre lo planificado y lo entregado, facilitar la priorización como desarrollador único y documentar el historial de decisiones a lo largo de más de un año de evolución del producto.

### Fases de desarrollo

El alcance se estructuró en **cinco fases incrementales**, cada una con objetivos acotados y entregables verificables:

```
Fase 1 ──► Core          Autenticación · Perfil · Partidas · Descubrir
Fase 2 ──► Resultados    Notificaciones · Validación de marcadores · Reportes
Fase 3 ──► Administración Panel de moderación · Analíticas · Auditoría
Fase 4 ──► Torneos       Cuadros eliminatorios · Parejas · Sincronización en tiempo real
Fase 5 ──► Marcador      Conteo en vivo local · Acceso sin registro
```

---

## 🤖 Entorno de desarrollo agentico: Cursor

Para acelerar el ciclo de desarrollo sin comprometer la calidad, se utilizó **Cursor** como entorno de desarrollo integrado con capacidades agenticas.

### Flujo de trabajo adoptado

1. **Modo Plan** — Antes de abordar cada funcionalidad o grupo de tareas, se empleó el modo de planificación para descomponer el trabajo, identificar dependencias y acotar el alcance de la sesión.
2. **Implementación guiada** — Con el plan validado, se ejecutaron las tareas de forma incremental, manteniendo revisiones continuas frente a las especificaciones vigentes.
3. **Control de calidad** — En todo momento se respetaron estándares de linting, tipado estático, pruebas automatizadas en lógica crítica y análisis de seguridad en el pipeline de integración continua.

Este enfoque combinó la velocidad de un asistente de inteligencia artificial con la disciplina de un proceso formal: las especificaciones marcaron el rumbo; Cursor optimizó la ejecución.

---

## 🏗️ Arquitectura

La aplicación sigue una **arquitectura cliente-servidor** con separación clara de responsabilidades:

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENTE (React Native + Expo)            │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Pantallas │→ │ Estado local │→ │ Sincronización datos │  │
│  │ (rutas)   │  │ y formularios│  │ con servidor         │  │
│  └──────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │ API segura (JWT + RLS)
┌────────────────────────────▼────────────────────────────────┐
│                    BACKEND (Supabase)                        │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Auth     │  │ PostgreSQL   │  │ Edge Functions       │  │
│  │ OAuth2   │  │ + RLS        │  │ Cron · Notificaciones│  │
│  └──────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│              SERVICIOS EXTERNOS E INFRAESTRUCTURA            │
│  Sentry · PostHog · Expo EAS · GitHub Actions · Push (FCM/APNs) │
└─────────────────────────────────────────────────────────────┘
```

### Principios arquitectónicos

- **Navegación declarativa** basada en el sistema de archivos, con rutas protegidas por autenticación.
- **Estado en capas**: gestión local de sesión y preferencias de interfaz; caché y sincronización de datos remotos con invalidación inteligente.
- **Seguridad en profundidad**: políticas de acceso a nivel de fila en base de datos, funciones remotas con privilegios restringidos y protección de datos personales.
- **Tiempo real**: actualización instantánea de listas y fichas mediante suscripciones a cambios en el servidor.
- **Observabilidad desde el primer día**: monitorización de errores, analítica de comportamiento y comprobaciones de salud automatizadas.

---

## ⚙️ Stack tecnológico

### Frontend móvil

| Tecnología             | Rol                                                  |
| ---------------------- | ---------------------------------------------------- |
| ⚛️ **React Native**    | Framework multiplataforma (Android, iOS, Web)        |
| 📱 **Expo**            | Builds, publicación y abstracción nativa             |
| 🧭 **Expo Router**     | Navegación y enrutamiento                            |
| 🔷 **TypeScript**      | Tipado estático y seguridad en tiempo de compilación |
| 🗃️ **Zustand**         | Estado global de sesión e interfaz                   |
| 🔄 **TanStack Query**  | Caché, sincronización y gestión de datos remotos     |
| 📝 **React Hook Form** | Formularios y validaciones                           |

### Backend e infraestructura

| Tecnología                     | Rol                                                                 |
| ------------------------------ | ------------------------------------------------------------------- |
| 🟢 **Supabase**                | Autenticación, base de datos, almacenamiento y funciones serverless |
| 🐘 **PostgreSQL**              | Modelo relacional con políticas de seguridad a nivel de fila        |
| ⏰ **pg_cron**                 | Transiciones automáticas de estado y recordatorios programados      |
| ☁️ **Supabase Edge Functions** | Lógica de servidor, notificaciones y cumplimiento RGPD              |

### DevOps, calidad y servicios

| Tecnología                     | Rol                                                              |
| ------------------------------ | ---------------------------------------------------------------- |
| 🔧 **GitHub Actions**          | Integración continua: lint, tipado, pruebas, escaneo de secretos |
| 📦 **Expo EAS**                | Builds automatizados y publicación en Google Play y App Store    |
| 🛡️ **Sentry**                  | Monitorización de errores y rendimiento                          |
| 📊 **PostHog**                 | Analítica de producto                                            |
| 🔔 **Expo Push Notifications** | Notificaciones en Android (FCM) e iOS (APNs)                     |
| 🌿 **GitFlow**                 | Estrategia de ramas: `main`, `develop`, `feature/*`, `release/*` |

---

## 🎯 Funcionalidades

### 🔐 Autenticación y cuenta

- Inicio de sesión con **Google**, **Apple ID** y **correo electrónico**
- Registro con aceptación de términos legales y política de privacidad
- Recuperación de contraseña y persistencia de sesión entre reinicios
- **Eliminación de cuenta** conforme al RGPD, con anonimización del historial compartido
- Cierre de sesión con confirmación explícita

### 👤 Perfil de usuario

- Datos personales: nombre, teléfono con validación internacional, localidad y foto de perfil
- Preferencias granulares de **notificaciones push** por tipo de evento
- Historial personal de partidas con indicadores de victoria y derrota
- **Perfil ajeno** de solo lectura, con visibilidad condicionada por permisos del servidor
- Envío de **feedback** in-app y valoración periódica en la tienda de aplicaciones

### 🎲 Partidas

- Creación y edición de partidas 2 contra 2 con fecha, lugar, duración y visibilidad
- Plantillas mixtas: jugadores registrados y por nombre de texto
- Estados del ciclo de vida: planificada, en curso, finalizada o sin resultado
- Unión, abandono y cambio de equipo con reglas de negocio estrictas
- Visibilidad **pública**, **por enlace** o **privada con contraseña**
- Invitación mediante deep link y copia al portapapeles
- Promoción automática a «en curso» y cancelación por plantilla incompleta

### 🔍 Descubrir

- Listado de partidas y torneos públicos con ordenación por proximidad temporal
- Filtros por ciudad, fecha, plazas libres, visibilidad y estado
- Búsqueda por texto y paginación eficiente
- Actualización en tiempo real sin recarga manual

### 🏆 Torneos

- Organización de torneos por eliminación directa con parejas mixtas
- Cuadro visual interactivo con resultados por enfrentamiento
- Inscripción, edición de parejas y generación automática de byes
- Avance de ronda al confirmar resultados, con opción de partido por el 3.º y 4.º puesto
- Rol de **árbitro** para el organizador sin necesidad de participar como jugador
- Sincronización multi-dispositivo en cuadro y fichas de torneo

### 📣 Notificaciones y resultados

- Notificaciones push ante uniones, cambios, cancelaciones y recordatorios programados
- Introducción de resultados con **validación cruzada** entre equipos rivales
- Flujo de disputa con reporte automático a moderación
- Cola de notificaciones con reintentos y limpieza de tokens inválidos

### 🃏 Marcador en vivo

- Conteo de puntos y juegos durante la partida, con fases del mus, envites y órdago
- Persistencia local en el dispositivo, sin dependencia de red
- Enlace directo al registro oficial de resultado al finalizar
- **Modo invitado**: marcador accesible sin cuenta ni partida en servidor

### 🛡️ Administración y moderación

- Panel exclusivo para administradores: reportes, feedback de usuarios y analíticas
- Acciones de moderación: bloqueo de usuarios, eliminación de contenido y resolución de disputas
- Métricas de producto: usuarios activos, partidas creadas, tasas de disputa y ranking por actividad
- Registro de auditoría de todas las acciones administrativas

### 🔒 Seguridad y cumplimiento

- Autenticación OAuth2 con flujo PKCE y tokens de corta duración
- Políticas de acceso a datos por usuario y por rol en base de datos
- Protección de datos personales: teléfono visible solo entre participantes de la misma partida
- Cumplimiento RGPD: consentimiento, minimización de datos y derecho de supresión
- Escaneo de secretos, auditoría de dependencias y umbrales de cobertura en CI

---

## 🎨 Identidad visual

El diseño sigue una estética **Ultra Limpio**: fondo claro, verde de marca inspirado en la tradición del mus (`#1A5F4A`), tipografía DM Sans y componentes con jerarquía visual clara.

---

## 📦 Distribución

**jugaMUS** se encuentra publicada en las principales tiendas de aplicaciones móviles:

| Plataforma         | Enlace                                                                                     | Estado                              |
| ------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------- |
| 🍎 **App Store**   | [Descargar en iOS](https://apps.apple.com/es/app/jugamus/id6775626292)                     | ✅ Publicada                        |
| 🤖 **Google Play** | [Descargar en Android](https://play.google.com/store/apps/details?id=com.javiwacho.musapp) | ✅ Publicada                        |
| 🌐 **Web**         | —                                                                                          | Soporte complementario vía Expo Web |

El despliegue de nuevas versiones se automatiza mediante **GitHub Actions** y **Expo EAS**: cada release en la rama principal dispara control de calidad, etiquetado de versión, compilación multiplataforma y envío a las tiendas.

---

## 📚 Documentación del proyecto

| Recurso           | Descripción                                                            |
| ----------------- | ---------------------------------------------------------------------- |
| `REQUIREMENTS.md` | Especificaciones funcionales y no funcionales                          |
| `TASKS.md`        | Backlog vivo por fases y estado de avance                              |
| `docs/`           | Páginas legales públicas (privacidad, términos, eliminación de cuenta) |

---

<div align="center">

**jugaMUS** · Desarrollado con rigor especificativo y asistencia agentica

_React Native · Expo · Supabase · TypeScript · Cursor_

</div>
