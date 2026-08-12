import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { useAuthStore } from '@/hooks/useAuth'
import { invalidateFriendsQueries } from '@/hooks/useFriends'
import { invalidateMatchInvitationQueries } from '@/hooks/useMatchInvitations'
import {
  idsFromRealtimeRow,
  invalidateAllExploreListQueries,
  type RealtimeListTable,
} from '@/lib/invalidateExploreCaches'
import { supabase } from '@/lib/supabase'

const DEBOUNCE_MS = 300

const REALTIME_TABLES: readonly RealtimeListTable[] = [
  'matches',
  'match_participants',
  'match_results',
  'tournaments',
  'tournament_pairs',
  'friendships',
  'match_invitations',
]

function readRecord(payload: {
  new?: Record<string, unknown>
  old?: Record<string, unknown>
}): Record<string, unknown> | undefined {
  return payload.new ?? payload.old
}

/**
 * Subscribes to Postgres changes and invalidates React Query caches for
 * Descubrir, Mis partidas, profile history, tournament/match detail screens,
 * friends, and match invitations.
 */
export function useExploreListsRealtimeSync(): void {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.session?.user.id)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<{
    matchId?: string
    tournamentId?: string
    friendships?: boolean
    matchInvitations?: boolean
  }>({})

  useEffect(() => {
    if (!userId) return

    const flush = () => {
      debounceRef.current = null
      const pending = pendingRef.current
      pendingRef.current = {}

      if (pending.friendships) {
        invalidateFriendsQueries(queryClient, userId)
      }

      if (pending.matchInvitations) {
        invalidateMatchInvitationQueries(queryClient, {
          userId,
          matchId: pending.matchId,
        })
      }

      // Match/tournament list+detail sync (also when an invite changes roster/status).
      if (pending.matchId || pending.tournamentId || pending.matchInvitations) {
        invalidateAllExploreListQueries(queryClient, {
          userId,
          matchId: pending.matchId,
          tournamentId: pending.tournamentId,
        })
      }
    }

    const scheduleInvalidate = (
      table: RealtimeListTable,
      payload: {
        new?: Record<string, unknown>
        old?: Record<string, unknown>
      }
    ) => {
      if (table === 'friendships') {
        pendingRef.current.friendships = true
      } else if (table === 'match_invitations') {
        pendingRef.current.matchInvitations = true
        const ids = idsFromRealtimeRow(table, readRecord(payload))
        if (ids.matchId) pendingRef.current.matchId = ids.matchId
      } else {
        const ids = idsFromRealtimeRow(table, readRecord(payload))
        if (ids.matchId) pendingRef.current.matchId = ids.matchId
        if (ids.tournamentId) pendingRef.current.tournamentId = ids.tournamentId
        // Match cancel cancels pending invites via trigger; refresh invite lists promptly.
        if (table === 'matches') {
          const row = readRecord(payload)
          if (row?.status === 'cancelled') {
            pendingRef.current.matchInvitations = true
          }
        }
      }

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(flush, DEBOUNCE_MS)
    }

    const channel = supabase.channel(`explore-lists-sync:${userId}`)

    for (const table of REALTIME_TABLES) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
        },
        (payload) => {
          scheduleInvalidate(table, payload)
        }
      )
    }

    channel.subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      void supabase.removeChannel(channel)
    }
  }, [queryClient, userId])
}
