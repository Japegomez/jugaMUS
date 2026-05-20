import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg'

import { MATCH_STATUS } from '@/constants'
import type { BracketNodeRow } from '@/services/tournaments.service'
import { buildBracketLayout, isPlaceholderNode, truncateName } from '@/utils/bracketLayout'

type BracketCanvasProps = {
  nodes: BracketNodeRow[]
  bracketGenerated: boolean
}

function slotLabel(node: BracketNodeRow, slot: 'a' | 'b'): string {
  const pairId = slot === 'a' ? node.pair_a_id : node.pair_b_id
  const name = slot === 'a' ? node.pair_a_name : node.pair_b_name
  if (pairId || (name && !PLACEHOLDER_NAMES.has(name.trim().toLowerCase()))) {
    return truncateName(name)
  }
  if (node.pair_a_id || node.pair_b_id) return 'Por determinar'
  return truncateName(name)
}

const PLACEHOLDER_NAMES = new Set(['por determinar', 'tbd', '—', '-'])

function nodeColors(node: BracketNodeRow) {
  if (isPlaceholderNode(node)) {
    return { fill: '#fafafa', stroke: '#ddd', strokeDash: '4 4' }
  }
  if (node.is_bye) {
    return { fill: '#f0f0f0', stroke: '#bbb', strokeDash: '4 4' }
  }
  if (node.match_status === MATCH_STATUS.IN_PROGRESS) {
    return { fill: '#fff8e6', stroke: '#c07000', strokeDash: undefined }
  }
  if (node.match_status === MATCH_STATUS.FINISHED || node.winner_pair_id) {
    return { fill: '#eef7f3', stroke: '#1a5f4a', strokeDash: undefined }
  }
  return { fill: '#fff', stroke: '#ccc', strokeDash: undefined }
}

function scoreLabel(node: BracketNodeRow): string {
  if (isPlaceholderNode(node)) return '—'
  if (node.is_bye) return 'Bye'
  if (node.team_a_games != null && node.team_b_games != null) {
    return `${node.team_a_games} – ${node.team_b_games}`
  }
  return '–'
}

export function BracketCanvas({ nodes, bracketGenerated }: BracketCanvasProps) {
  const router = useRouter()

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

  const layout = buildBracketLayout(nodes)
  const canvasHeight = Math.max(layout.height, 280)

  return (
    <View style={[styles.canvasWrap, { minHeight: canvasHeight }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
        <View style={{ width: layout.width, height: canvasHeight, position: 'relative' }}>
          <Svg width={layout.width} height={canvasHeight}>
            {layout.roundLabels.map((rl) => (
              <SvgText
                key={rl.roundSize}
                x={rl.x}
                y={20}
                fontSize={13}
                fontWeight="700"
                fill="#1a5f4a"
                textAnchor="middle">
                {rl.label}
              </SvgText>
            ))}

            {layout.connectors.map((c, i) => (
              <Line
                key={`conn-${i}`}
                x1={c.x1}
                y1={c.y1}
                x2={c.x2}
                y2={c.y2}
                stroke="#bbb"
                strokeWidth={1.5}
              />
            ))}
            {layout.connectors.map((c, i) => (
              <Line
                key={`conn2-${i}`}
                x1={c.x2}
                y1={c.y2}
                x2={c.x3}
                y2={c.y3}
                stroke="#bbb"
                strokeWidth={1.5}
              />
            ))}

            {layout.nodes.map((node) => {
              const colors = nodeColors(node)
              const aWinner = Boolean(node.winner_pair_id && node.winner_pair_id === node.pair_a_id)
              const bWinner = Boolean(node.winner_pair_id && node.winner_pair_id === node.pair_b_id)
              const placeholder = isPlaceholderNode(node)

              return (
                <G key={`${node.round_size}-${node.bracket_position}`}>
                  <Rect
                    x={node.x + 1}
                    y={node.y + 1}
                    width={node.width - 2}
                    height={node.height - 2}
                    rx={8}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={1.5}
                    strokeDasharray={colors.strokeDash}
                  />
                  <SvgText
                    x={node.x + 8}
                    y={node.y + 22}
                    fontSize={12}
                    fontWeight={aWinner ? '700' : '500'}
                    fill={placeholder ? '#999' : aWinner ? '#1a5f4a' : '#333'}>
                    {slotLabel(node, 'a')}
                  </SvgText>
                  <SvgText
                    x={node.x + node.width / 2}
                    y={node.y + 38}
                    fontSize={11}
                    fill="#666"
                    textAnchor="middle">
                    {scoreLabel(node)}
                  </SvgText>
                  {!node.is_bye ? (
                    <SvgText
                      x={node.x + 8}
                      y={node.y + 58}
                      fontSize={12}
                      fontWeight={bWinner ? '700' : '500'}
                      fill={placeholder ? '#999' : bWinner ? '#1a5f4a' : '#333'}>
                      {slotLabel(node, 'b')}
                    </SvgText>
                  ) : null}
                </G>
              )
            })}
          </Svg>

          {layout.nodes.map((node) =>
            node.is_bye ||
            isPlaceholderNode(node) ||
            node.match_id.startsWith('placeholder-') ? null : (
              <Pressable
                key={`tap-${node.match_id}`}
                style={[
                  styles.nodePress,
                  { left: node.x, top: node.y, width: node.width, height: node.height },
                ]}
                onPress={() => router.push(`/(tabs)/matches/${node.match_id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Partido: ${node.pair_a_name} vs ${node.pair_b_name}`}
              />
            )
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  canvasWrap: {
    marginVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    overflow: 'hidden',
  },
  nodePress: { position: 'absolute' },
  emptyWrap: { padding: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#666', lineHeight: 20 },
})
