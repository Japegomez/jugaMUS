import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { useAuthStore } from '@/hooks/useAuth'
import { invalidateFriendsQueries } from '@/hooks/useFriends'
import { invalidateMatchInvitationQueries } from '@/lib/matchQueryKeys'
import { collectPendingMatchIds } from '@/lib/realtimePending'
import {
  idsFromRealtimeRow,
  invalidateAllExploreListQueries,
  type RealtimeListTable,
} from '@/lib/invalidateExploreCaches'
import { supabase } from '@/lib/supabase'

const DEBOUNCE_MS = 300

function readRecord(payload: {
  new?: Record<string, unknown>
  old?: Record<string, unknown>
}): Record<string, unknown> | undefined {
  return payload.new ?? payload.old
}

type PendingRealtime = {
  matchIds: Set<string>
  tournamentIds: Set<string>
  friendships: boolean
  matchInvitations: boolean
}

function emptyPending(): PendingRealtime {
  return {
    matchIds: new Set(),
    tournamentIds: new Set(),
    friendships: false,
    matchInvitations: false,
  }
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
  const pendingRef = useRef<PendingRealtime>(emptyPending())

  useEffect(() => {
    if (!userId) return

    const flush = () => {
      debounceRef.current = null
      const pending = pendingRef.current
      pendingRef.current = emptyPending()

      if (pending.friendships) {
        invalidateFriendsQueries(queryClient, userId)
      }

      const matchIds = [...pending.matchIds]
      if (pending.matchInvitations) {
        invalidateMatchInvitationQueries(queryClient, {
          userId,
          matchIds,
        })
      }

      // Match/tournament list+detail sync (also when an invite changes roster/status).
      if (matchIds.length > 0 || pending.tournamentIds.size > 0 || pending.matchInvitations) {
        if (matchIds.length === 0 && pending.tournamentIds.size === 0) {
          invalidateAllExploreListQueries(queryClient, { userId })
        } else {
          for (const matchId of matchIds) {
            invalidateAllExploreListQueries(queryClient, { userId, matchId })
          }
          for (const tournamentId of pending.tournamentIds) {
            invalidateAllExploreListQueries(queryClient, { userId, tournamentId })
          }
        }
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
        pendingRef.current.matchIds = new Set(
          collectPendingMatchIds(pendingRef.current.matchIds, ids.matchId)
        )
      } else {
        const ids = idsFromRealtimeRow(table, readRecord(payload))
        if (ids.matchId) pendingRef.current.matchIds.add(ids.matchId)
        if (ids.tournamentId) pendingRef.current.tournamentIds.add(ids.tournamentId)
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

    const channel = supabase
      .channel(`explore-lists-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) =>
        scheduleInvalidate('matches', payload)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_participants' },
        (payload) => scheduleInvalidate('match_participants', payload)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_results' }, (payload) =>
        scheduleInvalidate('match_results', payload)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, (payload) =>
        scheduleInvalidate('tournaments', payload)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_pairs' },
        (payload) => scheduleInvalidate('tournament_pairs', payload)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, (payload) =>
        scheduleInvalidate('friendships', payload)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_invitations' },
        (payload) => scheduleInvalidate('match_invitations', payload)
      )
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      void supabase.removeChannel(channel)
    }
  }, [queryClient, userId])
}
