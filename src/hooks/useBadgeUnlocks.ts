import { useEffect, useRef, useState } from 'react'

import { useAuthStore } from '@/hooks/useAuth'
import { usePlayerStats } from '@/hooks/useStats'
import { BADGE_CATALOG, type PlayerBadge } from '@/services/stats.service'

const BADGE_EMOJIS = new Map(BADGE_CATALOG.map((b) => [b.key, b.emoji]))

export type UnlockedBadge = { key: string; emoji: string }

/**
 * Watches the current user's badges and exposes newly earned ones
 * (one at a time) so a celebration popup can be shown.
 */
export function useBadgeUnlocks() {
  const sessionUserId = useAuthStore((s) => s.session?.user.id)
  const { data: stats } = usePlayerStats(sessionUserId)
  const knownKeysRef = useRef<Set<string> | null>(null)
  const queueRef = useRef<UnlockedBadge[]>([])
  const [current, setCurrent] = useState<UnlockedBadge | null>(null)

  useEffect(() => {
    if (!stats) return
    const keys = stats.badges.map((b: PlayerBadge) => b.key)

    // First load: treat existing badges as known, don't celebrate them.
    if (knownKeysRef.current === null) {
      knownKeysRef.current = new Set(keys)
      return
    }

    const fresh = keys.filter((k) => !knownKeysRef.current!.has(k))
    if (fresh.length === 0) return

    fresh.forEach((key) => {
      knownKeysRef.current!.add(key)
      queueRef.current.push({ key, emoji: BADGE_EMOJIS.get(key) ?? '🏅' })
    })

    setCurrent((prev) => prev ?? queueRef.current.shift() ?? null)
  }, [stats])

  const dismiss = () => {
    setCurrent(queueRef.current.shift() ?? null)
  }

  return { unlockedBadge: current, dismiss }
}
