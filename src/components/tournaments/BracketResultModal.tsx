import { useState } from 'react'
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export type BracketResultModalProps = {
  visible: boolean
  winnerName: string
  loserName: string
  durationTargetGames: number
  submitting: boolean
  /** True when the rival pair has at least one registered player (pending validation path). */
  rivalHasRegisteredPlayer: boolean
  onClose: () => void
  /** loserGames = games scored by the losing pair. */
  onConfirm: (loserGames: number) => void
}

export function BracketResultModal({
  visible,
  winnerName,
  loserName,
  durationTargetGames,
  submitting,
  rivalHasRegisteredPlayer,
  onClose,
  onConfirm,
}: BracketResultModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {visible ? (
        <BracketResultModalBody
          key={winnerName}
          winnerName={winnerName}
          loserName={loserName}
          durationTargetGames={durationTargetGames}
          submitting={submitting}
          rivalHasRegisteredPlayer={rivalHasRegisteredPlayer}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      ) : null}
    </Modal>
  )
}

type BracketResultModalBodyProps = Omit<BracketResultModalProps, 'visible'>

function BracketResultModalBody({
  winnerName,
  loserName,
  durationTargetGames,
  submitting,
  rivalHasRegisteredPlayer,
  onClose,
  onConfirm,
}: BracketResultModalBodyProps) {
  const [loserGames, setLoserGames] = useState(0)
  const maxLoserGames = Math.max(0, durationTargetGames - 1)

  return (
    <View style={s.overlay}>
      <View style={s.card}>
        <Text style={s.title}>Registrar resultado</Text>

        <View style={s.matchRow}>
          <View style={s.pairBox}>
            <Text style={s.winnerLabel}>Ganador</Text>
            <Text style={s.winnerName} numberOfLines={2}>
              {winnerName}
            </Text>
            <Text style={s.games}>{durationTargetGames} juegos</Text>
          </View>

          <Text style={s.vs}>vs</Text>

          <View style={s.pairBox}>
            <Text style={s.loserLabel}>Perdedor</Text>
            <Text style={s.loserName} numberOfLines={2}>
              {loserName}
            </Text>
            <Text style={s.games}>{loserGames} juegos</Text>
          </View>
        </View>

        <View style={s.stepperSection}>
          <Text style={s.stepperLabel}>Juegos del perdedor</Text>
          <View style={s.stepper}>
            <Pressable
              style={[s.stepBtn, loserGames <= 0 && s.stepBtnDisabled]}
              onPress={() => setLoserGames((v) => Math.max(0, v - 1))}
              disabled={loserGames <= 0}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Restar un juego">
              <Text style={s.stepBtnText}>−</Text>
            </Pressable>
            <Text style={s.stepValue}>{loserGames}</Text>
            <Pressable
              style={[s.stepBtn, loserGames >= maxLoserGames && s.stepBtnDisabled]}
              onPress={() => setLoserGames((v) => Math.min(maxLoserGames, v + 1))}
              disabled={loserGames >= maxLoserGames}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Sumar un juego">
              <Text style={s.stepBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        {rivalHasRegisteredPlayer ? (
          <Text style={s.hint}>
            El resultado quedará pendiente de validación por el equipo rival.
          </Text>
        ) : (
          <Text style={s.hint}>El resultado se confirmará automáticamente.</Text>
        )}

        <View style={s.btnRow}>
          <Pressable
            style={[s.btn, s.cancelBtn]}
            onPress={onClose}
            disabled={submitting}
            accessibilityRole="button">
            <Text style={s.cancelText}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={[s.btn, s.confirmBtn, submitting && s.btnDisabled]}
            onPress={() => onConfirm(loserGames)}
            disabled={submitting}
            accessibilityRole="button">
            {submitting ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={s.confirmText}>Confirmar</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  pairBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  winnerLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  winnerName: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    textAlign: 'center',
  },
  loserLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loserName: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  games: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
  vs: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
  },
  stepperSection: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  stepperLabel: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.35 },
  stepBtnText: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    lineHeight: 26,
  },
  stepValue: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    minWidth: 36,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 17,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
  },
  btnDisabled: { opacity: 0.55 },
  cancelText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
  },
  confirmText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.white,
  },
})
