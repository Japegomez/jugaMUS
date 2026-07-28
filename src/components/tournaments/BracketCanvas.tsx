import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import Svg, { Line, Text as SvgText } from 'react-native-svg'

import { MATCH_STATUS } from '@/constants'
import { useAuthStore } from '@/hooks/useAuth'
import { tournamentBracketQueryKey } from '@/hooks/useTournaments'
import { useRecordTournamentMatchAsReferee } from '@/hooks/useTournaments'
import { useSubmitResult } from '@/hooks/useResults'
import type { TournamentPairRow } from '@/services/tournaments.service'
import type { BracketNodeRow } from '@/services/tournaments.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { useResponsiveLayout } from '@/theme/responsive'
import { buildBracketLayoutV2, isPlaceholderNode, truncateName } from '@/utils/bracketLayout'
import { BracketResultModal } from './BracketResultModal'

export type BracketCanvasProps = {
  nodes: BracketNodeRow[]
  bracketGenerated: boolean
  pairs: TournamentPairRow[]
  tournamentId: string
  durationTargetGames: number
  isOrganizer: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findPair(
  pairs: TournamentPairRow[],
  pairId: string | null | undefined
): TournamentPairRow | undefined {
  if (!pairId) return undefined
  return pairs.find((p) => p.id === pairId)
}

function pairHasRegisteredPlayer(pair: TournamentPairRow | undefined): boolean {
  if (!pair) return false
  return Boolean(pair.player_a_user_id || pair.player_b_user_id)
}

function userIsInPair(
  pair: TournamentPairRow | undefined,
  userId: string | null | undefined
): boolean {
  if (!pair || !userId) return false
  return pair.player_a_user_id === userId || pair.player_b_user_id === userId
}

/** True when this match can have a quick result recorded from the bracket. */
function matchIsRecordable(node: BracketNodeRow): boolean {
  if (isPlaceholderNode(node) || node.is_bye) return false
  if (!node.pair_a_id || !node.pair_b_id) return false
  if (node.winner_pair_id) return false
  return (
    node.match_status === MATCH_STATUS.PLANNED || node.match_status === MATCH_STATUS.IN_PROGRESS
  )
}

type PairState = 'normal' | 'winner' | 'pending' | 'placeholder' | 'bye'

function getPairState(node: BracketNodeRow, slot: 'a' | 'b'): PairState {
  if (node.is_placeholder) return 'placeholder'
  if (node.is_bye) return 'bye'
  if (node.winner_pair_id) {
    const pairId = slot === 'a' ? node.pair_a_id : node.pair_b_id
    return pairId === node.winner_pair_id ? 'winner' : 'normal'
  }
  if (node.match_status === MATCH_STATUS.IN_PROGRESS) return 'pending'
  return 'normal'
}

function getPairName(node: BracketNodeRow, slot: 'a' | 'b'): string {
  if (node.is_bye && slot === 'b') return 'Sin pareja'
  const raw = slot === 'a' ? node.pair_a_name : node.pair_b_name
  if (!raw) return 'Por determinar'
  const lower = raw.trim().toLowerCase()
  if (lower === 'por determinar' || lower === 'tbd' || lower === '—' || lower === '-') {
    return 'Por determinar'
  }
  return truncateName(raw, 20)
}

function getPairGames(node: BracketNodeRow, slot: 'a' | 'b'): number | null {
  if (!node.winner_pair_id) return null
  return slot === 'a' ? node.team_a_games : node.team_b_games
}

// ─── Card style maps ──────────────────────────────────────────────────────────

const CARD_BG: Record<PairState, string> = {
  normal: Colors.background,
  winner: Colors.wonBackground,
  pending: Colors.background,
  placeholder: Colors.surface,
  bye: Colors.surface,
}

const CARD_BORDER: Record<PairState, string> = {
  normal: Colors.border,
  winner: Colors.primary,
  pending: Colors.warning,
  placeholder: Colors.border,
  bye: Colors.border,
}

const CARD_BORDER_WIDTH: Record<PairState, number> = {
  normal: 1,
  winner: 2,
  pending: 1.5,
  placeholder: 1,
  bye: 1,
}

const NAME_COLOR: Record<PairState, string> = {
  normal: Colors.textPrimary,
  winner: Colors.primary,
  pending: Colors.textPrimary,
  placeholder: Colors.textSecondary,
  bye: Colors.textSecondary,
}

const NAME_FONT: Record<PairState, string> = {
  normal: Fonts.medium,
  winner: Fonts.bold,
  pending: Fonts.medium,
  placeholder: Fonts.regular,
  bye: Fonts.regular,
}

// ─── Selected result state ────────────────────────────────────────────────────

type SelectedResult = {
  node: BracketNodeRow
  winnerSlot: 'a' | 'b'
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BracketCanvas({
  nodes,
  bracketGenerated,
  pairs,
  tournamentId,
  durationTargetGames,
  isOrganizer,
}: BracketCanvasProps) {
  const router = useRouter()
  const { isNarrow, scale, contentHeight } = useResponsiveLayout()
  const currentUserId = useAuthStore((s) => s.session?.user.id)
  const queryClient = useQueryClient()
  const recordReferee = useRecordTournamentMatchAsReferee()
  const submitResult = useSubmitResult()

  const [selectedResult, setSelectedResult] = useState<SelectedResult | null>(null)

  if (!bracketGenerated) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Cuadro pendiente de generar</Text>
        <Text style={styles.emptyHint}>
          El organizador debe pulsar «Organizar cuadro» cuando haya al menos 2 parejas inscritas.
        </Text>
      </View>
    )
  }

  if (nodes.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyHint}>No hay datos del cuadro todavía.</Text>
      </View>
    )
  }

  const layoutScale = isNarrow ? Math.min(0.88, scale) : Math.min(1, scale)
  const layout = buildBracketLayoutV2(nodes, layoutScale)
  const canvasHeight = Math.max(layout.height, Math.min(280, Math.round(contentHeight * 0.45)))
  const labelFs = Math.max(10, Math.round(12 * layoutScale))
  const nameFs = Math.max(9, Math.round(11 * layoutScale))

  function canUserRecord(node: BracketNodeRow): boolean {
    if (!matchIsRecordable(node)) return false
    if (isOrganizer) return true
    const pairA = findPair(pairs, node.pair_a_id)
    const pairB = findPair(pairs, node.pair_b_id)
    return userIsInPair(pairA, currentUserId) || userIsInPair(pairB, currentUserId)
  }

  function handlePairTap(node: BracketNodeRow, slot: 'a' | 'b') {
    // Finished match: always navigate to detail
    if (node.winner_pair_id && !node.match_id.startsWith('placeholder-')) {
      router.push(`/(tabs)/matches/${node.match_id}`)
      return
    }
    // Active match: open result modal if allowed, otherwise navigate
    if (!matchIsRecordable(node) || node.match_id.startsWith('placeholder-')) {
      if (!node.match_id.startsWith('placeholder-')) {
        router.push(`/(tabs)/matches/${node.match_id}`)
      }
      return
    }
    if (canUserRecord(node)) {
      setSelectedResult({ node, winnerSlot: slot })
    } else {
      router.push(`/(tabs)/matches/${node.match_id}`)
    }
  }

  async function handleConfirmResult(loserGames: number) {
    if (!selectedResult) return
    const { node, winnerSlot } = selectedResult
    const teamAGames = winnerSlot === 'a' ? durationTargetGames : loserGames
    const teamBGames = winnerSlot === 'a' ? loserGames : durationTargetGames

    const winnerPairId = winnerSlot === 'a' ? node.pair_a_id : node.pair_b_id
    const winnerPair = findPair(pairs, winnerPairId)
    const useSubmitPath = userIsInPair(winnerPair, currentUserId)

    try {
      if (useSubmitPath && currentUserId) {
        await submitResult.mutateAsync({
          matchId: node.match_id,
          submittedByUserId: currentUserId,
          submittedByTeam: winnerSlot.toUpperCase(),
          teamAGames,
          teamBGames,
        })
      } else {
        await recordReferee.mutateAsync({
          matchId: node.match_id,
          tournamentId,
          teamAGames,
          teamBGames,
        })
      }
      queryClient.invalidateQueries({ queryKey: tournamentBracketQueryKey(tournamentId) })
      setSelectedResult(null)
    } catch (err) {
      // Error surfaced via mutation state; keep modal open so user can retry or cancel
      console.warn('[BracketCanvas] record result error:', err)
    }
  }

  const isSubmitting = recordReferee.isPending || submitResult.isPending

  // Build modal info from selected result
  const modalWinnerName =
    selectedResult != null ? getPairName(selectedResult.node, selectedResult.winnerSlot) : ''
  const modalLoserSlot = selectedResult?.winnerSlot === 'a' ? ('b' as const) : ('a' as const)
  const modalLoserName =
    selectedResult != null ? getPairName(selectedResult.node, modalLoserSlot) : ''
  const modalRivalHasRegistered =
    selectedResult != null
      ? pairHasRegisteredPlayer(
          findPair(
            pairs,
            selectedResult.winnerSlot === 'a'
              ? selectedResult.node.pair_b_id
              : selectedResult.node.pair_a_id
          )
        )
      : false

  return (
    <View style={[styles.canvasWrap, { minHeight: canvasHeight }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        nestedScrollEnabled
        style={{ height: canvasHeight }}>
        <View style={{ width: layout.width, height: layout.height, position: 'relative' }}>
          {/* ── SVG layer: connectors + round labels ─────────────────────── */}
          <Svg
            width={layout.width}
            height={layout.height}
            style={StyleSheet.absoluteFill}
            pointerEvents="none">
            {layout.roundLabels.map((rl) => (
              <SvgText
                key={rl.roundSize}
                x={rl.x}
                y={Math.round(20 * layoutScale)}
                fontSize={labelFs}
                fontWeight="700"
                fill={Colors.primary}
                textAnchor="middle">
                {rl.label}
              </SvgText>
            ))}
            {layout.connectors.map((c, i) => (
              <Line
                key={i}
                x1={c.x1}
                y1={c.y1}
                x2={c.x2}
                y2={c.y2}
                stroke={Colors.border}
                strokeWidth={1.5}
              />
            ))}
          </Svg>

          {/* ── Pair card Views ───────────────────────────────────────────── */}
          {layout.matches.map((m) => {
            const { node, pairA, pairB } = m
            const isFinalNode = node.match_id.startsWith('placeholder-')
            const stateA = getPairState(node, 'a')
            const stateB = getPairState(node, 'b')
            const nameA = getPairName(node, 'a')
            const nameB = getPairName(node, 'b')
            const gamesA = getPairGames(node, 'a')
            const gamesB = getPairGames(node, 'b')
            const recordable = matchIsRecordable(node)
            const canRecord = canUserRecord(node)

            function renderCard(
              slot: 'a' | 'b',
              box: typeof pairA,
              state: PairState,
              name: string,
              games: number | null
            ) {
              const pressable =
                !isFinalNode &&
                (state === 'winner' || (recordable && (state === 'normal' || state === 'pending')))

              return (
                <Pressable
                  key={`${node.match_id}-${slot}`}
                  style={[
                    styles.pairCard,
                    {
                      position: 'absolute',
                      left: box.x,
                      top: box.y,
                      width: box.width,
                      height: box.height,
                      backgroundColor: CARD_BG[state],
                      borderColor: CARD_BORDER[state],
                      borderWidth: CARD_BORDER_WIDTH[state],
                    },
                  ]}
                  onPress={pressable ? () => handlePairTap(node, slot) : undefined}
                  accessibilityRole={pressable ? 'button' : 'none'}
                  accessibilityLabel={
                    recordable && canRecord && !node.winner_pair_id
                      ? `Declarar ganador: ${name}`
                      : name
                  }>
                  <Text
                    style={[
                      styles.pairName,
                      {
                        fontSize: nameFs,
                        fontFamily: NAME_FONT[state],
                        color: NAME_COLOR[state],
                      },
                    ]}
                    numberOfLines={1}>
                    {name}
                  </Text>
                  {games != null ? (
                    <Text
                      style={[
                        styles.gamesTag,
                        {
                          color: state === 'winner' ? Colors.primary : Colors.textSecondary,
                        },
                      ]}
                      numberOfLines={1}>
                      {games}
                    </Text>
                  ) : null}
                </Pressable>
              )
            }

            return (
              <React.Fragment key={node.match_id}>
                {renderCard('a', pairA, stateA, nameA, gamesA)}
                {renderCard('b', pairB, stateB, nameB, gamesB)}
              </React.Fragment>
            )
          })}
        </View>
      </ScrollView>

      <BracketResultModal
        visible={selectedResult !== null}
        winnerName={modalWinnerName}
        loserName={modalLoserName}
        durationTargetGames={durationTargetGames}
        submitting={isSubmitting}
        rivalHasRegisteredPlayer={modalRivalHasRegistered}
        onClose={() => !isSubmitting && setSelectedResult(null)}
        onConfirm={(loserGames) => void handleConfirmResult(loserGames)}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  canvasWrap: {
    marginVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  emptyWrap: { padding: 16 },
  emptyTitle: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyHint: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  pairCard: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  pairName: {
    flex: 1,
    lineHeight: 18,
  },
  gamesTag: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    marginLeft: 6,
  },
})
