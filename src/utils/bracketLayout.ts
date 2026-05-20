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

export function buildBracketLayout(nodes: BracketNodeRow[]): BracketLayout {
  const expanded = expandBracketNodes(nodes)
  if (expanded.length === 0) {
    return { nodes: [], connectors: [], width: 0, height: 0, roundLabels: [] }
  }

  const maxRoundSize = Math.max(...expanded.map((n) => n.round_size))
  const roundSizes = [...new Set(expanded.map((n) => n.round_size))].sort((a, b) => b - a)
  const numColumns = roundSizes.length

  const slotsInFirstRound = maxRoundSize / 2
  const totalHeight = PADDING * 2 + ROUND_HEADER + slotsInFirstRound * NODE_HEIGHT * 2

  const layoutNodes: LayoutNode[] = expanded.map((node) => {
    const colIndex = roundSizes.indexOf(node.round_size)
    const x = PADDING + colIndex * (NODE_WIDTH + COLUMN_GAP)
    const slotsInRound = node.round_size / 2
    const slotHeight = totalHeight / slotsInRound
    const y =
      PADDING + ROUND_HEADER + node.bracket_position * slotHeight + slotHeight / 2 - NODE_HEIGHT / 2

    return { ...node, x, y, width: NODE_WIDTH, height: NODE_HEIGHT }
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

    const x1 = node.x + NODE_WIDTH
    const y1 = node.y + NODE_HEIGHT / 2
    const x2 = next.x
    const y2 = next.y + NODE_HEIGHT / 2
    const midX = x1 + COLUMN_GAP / 2

    connectors.push({ x1, y1, x2: midX, y2: y1, x3: midX, y3: y2 })
    connectors.push({ x1: midX, y1: y2, x2, y2, x3: x2, y3: y2 })
  }

  const roundLabels = roundSizes.map((roundSize, colIndex) => ({
    roundSize,
    label: roundLabel(roundSize),
    x: PADDING + colIndex * (NODE_WIDTH + COLUMN_GAP) + NODE_WIDTH / 2,
  }))

  const width = PADDING * 2 + numColumns * NODE_WIDTH + (numColumns - 1) * COLUMN_GAP

  return {
    nodes: layoutNodes,
    connectors,
    width,
    height: totalHeight,
    roundLabels,
  }
}

export function truncateName(name: string | null | undefined, max = 18): string {
  if (!name) return '—'
  const trimmed = name.trim()
  if (PLACEHOLDER_NAMES.has(trimmed.toLowerCase())) return 'Por determinar'
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
}
