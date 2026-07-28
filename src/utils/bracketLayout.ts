import type { BracketNodeRow } from '@/services/tournaments.service'
import { BRACKET_ROUND_LABELS } from '@/constants'

export type LayoutNode = BracketNodeRow & {
  x: number
  y: number
  width: number
  height: number
}

export type BracketConnector = {
  x1: number
  y1: number
  x2: number
  y2: number
  x3: number
  y3: number
}

export type BracketLayout = {
  nodes: LayoutNode[]
  connectors: BracketConnector[]
  width: number
  height: number
  roundLabels: { roundSize: number; label: string; x: number }[]
}

const NODE_WIDTH = 160
const NODE_HEIGHT = 72
const COLUMN_GAP = 80
const ROUND_HEADER = 28
const PADDING = 24

export function roundLabel(roundSize: number): string {
  return BRACKET_ROUND_LABELS[roundSize] ?? `Ronda ${roundSize}`
}

const PLACEHOLDER_NAMES = new Set(['por determinar', 'tbd', '—', '-'])

export function isPlaceholderNode(node: BracketNodeRow): boolean {
  if (node.is_placeholder) return true
  if (node.is_bye) return false
  if (node.pair_a_id || node.pair_b_id) return false
  if (node.match_status === 'planned' && !node.pair_a_id && !node.pair_b_id) return true
  const a = node.pair_a_name?.trim().toLowerCase() ?? ''
  const b = node.pair_b_name?.trim().toLowerCase() ?? ''
  return PLACEHOLDER_NAMES.has(a) && PLACEHOLDER_NAMES.has(b)
}

/** Ensures every round slot exists for bracket rendering (legacy tournaments without DB placeholders). */
export function expandBracketNodes(nodes: BracketNodeRow[]): BracketNodeRow[] {
  if (nodes.length === 0) return []

  const maxRoundSize = Math.max(...nodes.map((n) => n.round_size))
  const nodeMap = new Map<string, BracketNodeRow>()
  for (const node of nodes) {
    nodeMap.set(`${node.round_size}:${node.bracket_position}`, node)
  }

  const expanded: BracketNodeRow[] = []
  let roundSize = maxRoundSize

  while (roundSize >= 2) {
    const numMatches = roundSize / 2
    for (let pos = 0; pos < numMatches; pos += 1) {
      const key = `${roundSize}:${pos}`
      const existing = nodeMap.get(key)
      if (existing) {
        expanded.push(existing)
      } else {
        expanded.push({
          match_id: `placeholder-${roundSize}-${pos}`,
          round_size: roundSize,
          bracket_position: pos,
          pair_a_id: null,
          pair_a_name: 'Por determinar',
          pair_b_id: null,
          pair_b_name: 'Por determinar',
          winner_pair_id: null,
          match_status: 'planned',
          is_bye: false,
          is_placeholder: true,
          team_a_games: null,
          team_b_games: null,
          start_at: new Date().toISOString(),
        })
      }
    }
    roundSize /= 2
  }

  return expanded
}

export function buildBracketLayout(
  nodes: BracketNodeRow[],
  options?: { scale?: number }
): BracketLayout {
  const scale = Math.min(1, Math.max(0.7, options?.scale ?? 1))
  const nodeWidth = Math.round(NODE_WIDTH * scale)
  const nodeHeight = Math.round(NODE_HEIGHT * scale)
  const columnGap = Math.round(COLUMN_GAP * scale)
  const roundHeader = Math.round(ROUND_HEADER * scale)
  const padding = Math.round(PADDING * scale)

  const expanded = expandBracketNodes(nodes)
  if (expanded.length === 0) {
    return { nodes: [], connectors: [], width: 0, height: 0, roundLabels: [] }
  }

  const maxRoundSize = Math.max(...expanded.map((n) => n.round_size))
  const roundSizes = [...new Set(expanded.map((n) => n.round_size))].sort((a, b) => b - a)
  const numColumns = roundSizes.length

  const slotsInFirstRound = maxRoundSize / 2
  const totalHeight = padding * 2 + roundHeader + slotsInFirstRound * nodeHeight * 2

  const layoutNodes: LayoutNode[] = expanded.map((node) => {
    const colIndex = roundSizes.indexOf(node.round_size)
    const x = padding + colIndex * (nodeWidth + columnGap)
    const slotsInRound = node.round_size / 2
    const slotHeight = totalHeight / slotsInRound
    const y =
      padding + roundHeader + node.bracket_position * slotHeight + slotHeight / 2 - nodeHeight / 2

    return { ...node, x, y, width: nodeWidth, height: nodeHeight }
  })

  const nodeByKey = new Map<string, LayoutNode>()
  for (const n of layoutNodes) {
    nodeByKey.set(`${n.round_size}:${n.bracket_position}`, n)
  }

  const connectors: BracketConnector[] = []

  for (const node of layoutNodes) {
    if (node.round_size <= 2) continue
    const nextRoundSize = node.round_size / 2
    const nextPos = Math.floor(node.bracket_position / 2)
    const next = nodeByKey.get(`${nextRoundSize}:${nextPos}`)
    if (!next) continue

    const x1 = node.x + node.width
    const y1 = node.y + node.height / 2
    const x2 = next.x
    const y2 = next.y + next.height / 2
    const midX = x1 + columnGap / 2

    connectors.push({ x1, y1, x2: midX, y2: y1, x3: midX, y3: y2 })
    connectors.push({ x1: midX, y1: y2, x2, y2, x3: x2, y3: y2 })
  }

  const roundLabels = roundSizes.map((roundSize, colIndex) => ({
    roundSize,
    label: roundLabel(roundSize),
    x: padding + colIndex * (nodeWidth + columnGap) + nodeWidth / 2,
  }))

  const width = padding * 2 + numColumns * nodeWidth + (numColumns - 1) * columnGap

  return {
    nodes: layoutNodes,
    connectors,
    width,
    height: totalHeight,
    roundLabels,
  }
}

// ─── V2 layout: one card per pair ────────────────────────────────────────────

const V2_CARD_W = 132
const V2_CARD_H = 46
const V2_PAIR_GAP = 4 // gap between pair-A and pair-B cards inside a match
const V2_MATCH_GAP = 28 // gap between consecutive matches in the same round
const V2_COL_GAP = 60 // horizontal gap between round columns (space for connectors)
const V2_LABEL_H = 34 // height reserved for the round label at the top
const V2_PAD_H = 12 // left/right canvas padding
const V2_PAD_V = 12 // top/bottom canvas padding

export type PairCardBox = { x: number; y: number; width: number; height: number }

export type MatchLayoutV2 = {
  node: BracketNodeRow
  pairA: PairCardBox
  pairB: PairCardBox
  matchCenterY: number
}

export type ConnectorSegment = { x1: number; y1: number; x2: number; y2: number }

export type BracketLayoutV2 = {
  matches: MatchLayoutV2[]
  connectors: ConnectorSegment[]
  roundLabels: { roundSize: number; label: string; x: number }[]
  width: number
  height: number
}

export function buildBracketLayoutV2(nodes: BracketNodeRow[], scale = 1): BracketLayoutV2 {
  const cw = Math.round(V2_CARD_W * scale)
  const ch = Math.round(V2_CARD_H * scale)
  const pg = Math.round(V2_PAIR_GAP * scale)
  const mg = Math.round(V2_MATCH_GAP * scale)
  const cg = Math.round(V2_COL_GAP * scale)
  const lh = Math.round(V2_LABEL_H * scale)
  const ph = Math.round(V2_PAD_H * scale)
  const pv = Math.round(V2_PAD_V * scale)

  const expanded = expandBracketNodes(nodes)
  if (!expanded.length) return { matches: [], connectors: [], roundLabels: [], width: 0, height: 0 }

  const maxRoundSize = Math.max(...expanded.map((n) => n.round_size))
  const roundSizes = [...new Set(expanded.map((n) => n.round_size))].sort((a, b) => b - a)

  const matchH = ch * 2 + pg
  const firstRoundCount = maxRoundSize / 2
  const totalHeight =
    pv + lh + firstRoundCount * matchH + Math.max(0, firstRoundCount - 1) * mg + pv

  function calcMatchCenterY(roundSize: number, pos: number): number {
    if (roundSize === maxRoundSize) {
      return pv + lh + pos * (matchH + mg) + Math.round(matchH / 2)
    }
    const cA = calcMatchCenterY(roundSize * 2, pos * 2)
    const cB = calcMatchCenterY(roundSize * 2, pos * 2 + 1)
    return Math.round((cA + cB) / 2)
  }

  const colIndexOf = new Map<number, number>()
  roundSizes.forEach((rs, i) => colIndexOf.set(rs, i))

  const matches: MatchLayoutV2[] = expanded.map((node) => {
    const col = colIndexOf.get(node.round_size) ?? 0
    const x = ph + col * (cw + cg)
    const cy = calcMatchCenterY(node.round_size, node.bracket_position)
    return {
      node,
      pairA: { x, y: cy - ch - Math.ceil(pg / 2), width: cw, height: ch },
      pairB: { x, y: cy + Math.floor(pg / 2), width: cw, height: ch },
      matchCenterY: cy,
    }
  })

  const matchByKey = new Map<string, MatchLayoutV2>()
  for (const m of matches) {
    matchByKey.set(`${m.node.round_size}:${m.node.bracket_position}`, m)
  }

  const connectors: ConnectorSegment[] = []

  for (const m of matches) {
    const { node, pairA, pairB, matchCenterY: mcy } = m
    if (node.round_size <= 2) continue

    const parent = matchByKey.get(`${node.round_size / 2}:${Math.floor(node.bracket_position / 2)}`)
    if (!parent) continue

    const feedsIntoA = node.bracket_position % 2 === 0
    const parentCard = feedsIntoA ? parent.pairA : parent.pairB
    const parentMidY = parentCard.y + Math.floor(parentCard.height / 2)
    const jx = pairA.x + cw + Math.round(cg / 2)
    const aMidY = pairA.y + Math.floor(ch / 2)
    const bMidY = pairB.y + Math.floor(ch / 2)

    connectors.push({ x1: pairA.x + cw, y1: aMidY, x2: jx, y2: aMidY })
    connectors.push({ x1: pairB.x + cw, y1: bMidY, x2: jx, y2: bMidY })
    connectors.push({ x1: jx, y1: aMidY, x2: jx, y2: bMidY })
    connectors.push({ x1: jx, y1: mcy, x2: parentCard.x, y2: mcy })
    if (mcy !== parentMidY) {
      connectors.push({ x1: parentCard.x, y1: mcy, x2: parentCard.x, y2: parentMidY })
    }
  }

  const numCols = roundSizes.length
  const totalWidth = ph * 2 + numCols * cw + (numCols - 1) * cg

  return {
    matches,
    connectors,
    roundLabels: roundSizes.map((rs, i) => ({
      roundSize: rs,
      label: roundLabel(rs),
      x: ph + i * (cw + cg) + Math.floor(cw / 2),
    })),
    width: totalWidth,
    height: totalHeight,
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function truncateName(name: string | null | undefined, max = 18): string {
  if (!name) return '—'
  const trimmed = name.trim()
  if (PLACEHOLDER_NAMES.has(trimmed.toLowerCase())) return 'Por determinar'
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
}
