import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export type ScoreboardTutorialHighlight =
  'none' | 'roundCenters' | 'arrowsAndPairPoints' | 'pairPoints' | 'undo'

type TooltipPlacement = 'start' | 'bottom' | 'center'

type TutorialStep = {
  message: string
  highlight: ScoreboardTutorialHighlight
  placement: TooltipPlacement
}

export const SCOREBOARD_TUTORIAL_STEPS: TutorialStep[] = [
  {
    message:
      'Puedes tocar sobre cada una de las casillas de puntos centrales para apuntar los envites directamente.',
    highlight: 'roundCenters',
    placement: 'start',
  },
  {
    message:
      'Al pulsar sobre cada una de las flechas se suman los puntos apostados de cada ronda a la pareja señalada.',
    highlight: 'arrowsAndPairPoints',
    placement: 'bottom',
  },
  {
    message:
      'Puedes pulsar sobre los contadores de cada pareja para sumar las negadas directamente.',
    highlight: 'pairPoints',
    placement: 'center',
  },
  {
    message: 'Si te equivocas, pulsa el botón de deshacer para revertir el último cambio.',
    highlight: 'undo',
    placement: 'center',
  },
  {
    message: '¡Mucha suerte y que gane la mejor pareja!',
    highlight: 'none',
    placement: 'center',
  },
]

type ScoreboardTutorialProps = {
  stepIndex: number
  onBack: () => void
  onNext: () => void
  onSkip: () => void
}

export function ScoreboardTutorial({ stepIndex, onBack, onNext, onSkip }: ScoreboardTutorialProps) {
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height
  const step = SCOREBOARD_TUTORIAL_STEPS[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === SCOREBOARD_TUTORIAL_STEPS.length - 1
  const effectivePlacement: TooltipPlacement =
    step.highlight === 'undo' && stepIndex > 0
      ? (SCOREBOARD_TUTORIAL_STEPS[stepIndex - 1]?.placement ?? step.placement)
      : step.placement

  const sidePad = Math.max(insets.left, insets.right, 12)
  const topPad = Math.max(insets.top, 12)
  const bottomPad = Math.max(insets.bottom, 12)
  // El alto disponible para la tarjeta: deja margen para el contenido del marcador.
  const cardMaxHeight = Math.round(height * 0.55)

  const cardMaxWidth = (() => {
    if (step.highlight === 'pairPoints') {
      // Este paso apunta a los contadores: un card más estrecho evita ocupar
      // demasiado ancho respecto al centro del marcador.
      return Math.min(isLandscape ? width * 0.32 : width * 0.7, 300)
    }
    if (effectivePlacement === 'bottom') {
      return Math.min(isLandscape ? width * 0.72 : width * 0.9, 420)
    }
    if (effectivePlacement === 'start') {
      // Más estrecho y a un lado para no tapar las casillas centrales de ronda.
      return Math.min(isLandscape ? width * 0.28 : width * 0.88, 260)
    }
    return Math.min(isLandscape ? width * 0.42 : width * 0.88, 360)
  })()

  const availableWidth = Math.max(width - sidePad * 2, 120)
  const cardWidth = Math.min(cardMaxWidth, availableWidth)
  const centeredLeft = (width - cardWidth) / 2

  // Solo el card captura toques; el resto del marcador sigue siendo usable.
  const cardPositionStyle = (() => {
    switch (effectivePlacement) {
      case 'start':
        if (isLandscape) {
          return {
            left: sidePad,
            top: topPad + 8,
            width: cardWidth,
          }
        }
        return {
          left: centeredLeft,
          top: topPad + 8,
          width: cardWidth,
        }
      case 'bottom':
        return {
          left: centeredLeft,
          bottom: bottomPad + 12,
          width: cardWidth,
        }
      case 'center':
      default:
        return {
          left: centeredLeft,
          top: height / 2 - 80,
          width: cardWidth,
        }
    }
  })()

  return (
    <View style={s.root} pointerEvents="box-none">
      <View style={[s.card, cardPositionStyle, { maxHeight: cardMaxHeight }]}>
        <ScrollView
          style={s.messageScroll}
          contentContainerStyle={s.messageScrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <Text style={[s.message, width < 360 && s.messageCompact]}>{step.message}</Text>
        </ScrollView>

        <View style={s.footer}>
          <Pressable
            onPress={onSkip}
            hitSlop={8}
            style={({ pressed }) => [s.skipBtn, pressed && s.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Omitir tutorial">
            <Text style={s.skipText}>Omitir</Text>
          </Pressable>

          <View style={s.navRow}>
            <Pressable
              onPress={onBack}
              disabled={isFirst}
              hitSlop={10}
              style={({ pressed }) => [
                s.navBtn,
                pressed && !isFirst && s.pressed,
                isFirst && s.navBtnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Paso anterior"
              accessibilityState={{ disabled: isFirst }}>
              <Ionicons
                name="chevron-back"
                size={22}
                color={isFirst ? 'rgba(26,95,74,0.35)' : Colors.primary}
              />
            </Pressable>

            <Text style={s.stepIndicator}>
              {stepIndex + 1}/{SCOREBOARD_TUTORIAL_STEPS.length}
            </Text>

            <Pressable
              onPress={onNext}
              hitSlop={10}
              style={({ pressed }) => [s.navBtn, pressed && s.pressed]}
              accessibilityRole="button"
              accessibilityLabel={isLast ? 'Cerrar tutorial' : 'Siguiente paso'}>
              <Ionicons
                name={isLast ? 'close' : 'chevron-forward'}
                size={22}
                color={Colors.primary}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
  },
  card: {
    position: 'absolute',
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 12,
  },
  messageScroll: {
    flexShrink: 1,
  },
  messageScrollContent: {
    paddingBottom: 4,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Fonts.medium,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  messageCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  navBtnDisabled: {
    opacity: 0.55,
  },
  stepIndicator: {
    minWidth: 36,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
  },
  pressed: { opacity: 0.7 },
})
