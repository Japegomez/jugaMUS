import { Platform } from 'react-native'
import * as ScreenOrientation from 'expo-screen-orientation'

const owners = new Map<string, ScreenOrientation.OrientationLock>()

let pendingApply: ReturnType<typeof setTimeout> | null = null
let applied: ScreenOrientation.OrientationLock | null = null

function isLandscapeLock(lock: ScreenOrientation.OrientationLock): boolean {
  return (
    lock === ScreenOrientation.OrientationLock.LANDSCAPE ||
    lock === ScreenOrientation.OrientationLock.LANDSCAPE_LEFT ||
    lock === ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT
  )
}

/** Landscape wins while any owner requests it; otherwise the remaining lock (usually portrait). */
export function resolveOrientationLock(
  requests: Iterable<ScreenOrientation.OrientationLock>
): ScreenOrientation.OrientationLock {
  let fallback: ScreenOrientation.OrientationLock | null = null
  for (const lock of requests) {
    if (isLandscapeLock(lock)) return ScreenOrientation.OrientationLock.LANDSCAPE
    if (fallback == null) fallback = lock
  }
  return fallback ?? ScreenOrientation.OrientationLock.PORTRAIT_UP
}

function cancelPendingApply() {
  if (pendingApply) {
    clearTimeout(pendingApply)
    pendingApply = null
  }
}

function applyNow() {
  if (Platform.OS === 'web') return

  const desired = resolveOrientationLock(owners.values())
  if (desired === applied) return

  applied = desired
  void ScreenOrientation.lockAsync(desired).catch(() => {
    /* algunos dispositivos no permiten el bloqueo */
  })
}

function scheduleApply(delayMs: number) {
  cancelPendingApply()
  pendingApply = setTimeout(() => {
    pendingApply = null
    applyNow()
  }, delayMs)
}

/**
 * Registra un propietario de bloqueo de orientación.
 * Varios owners pueden coexistir (p. ej. root=portrait + scoreboard=landscape);
 * landscape tiene prioridad. El release se aplica con delay para tolerar
 * remounts de StrictMode / transiciones sin parpadeo.
 */
export function acquireOrientationLock(
  ownerId: string,
  lock: ScreenOrientation.OrientationLock
): () => void {
  cancelPendingApply()
  owners.delete('prefetch')
  owners.set(ownerId, lock)
  applyNow()

  return () => {
    owners.delete(ownerId)
    scheduleApply(300)
  }
}

/**
 * Anticipa el bloqueo (p. ej. al pulsar «Marcador») para un único giro
 * durante la navegación. Lo sustituye el owner real al montar la pantalla.
 */
export function prefetchOrientationLock(lock: ScreenOrientation.OrientationLock) {
  cancelPendingApply()
  owners.set('prefetch', lock)
  applyNow()
}

/** @internal test helper */
export function __resetOrientationLockForTests() {
  cancelPendingApply()
  owners.clear()
  applied = null
}
