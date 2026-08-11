import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { BADGE_CATALOG, BADGE_LABELS, type PlayerBadge } from '@/services/stats.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

const SLOT_COUNT = 3

export function BadgeShowcase({
  showcase,
  earnedBadges,
  canEdit,
  saving,
  onChange,
}: {
  showcase: string[]
  earnedBadges: PlayerBadge[]
  canEdit: boolean
  saving?: boolean
  onChange: (next: string[]) => Promise<void>
}) {
  const [pickerSlot, setPickerSlot] = useState<number | null>(null)
  const [pickerError, setPickerError] = useState<string | null>(null)

  const earnedKeys = useMemo(() => new Set(earnedBadges.map((b) => b.key)), [earnedBadges])

  const slots = useMemo(() => {
    const valid = showcase.filter((k) => earnedKeys.has(k))
    return Array.from({ length: SLOT_COUNT }, (_, i) => valid[i] ?? null)
  }, [showcase, earnedKeys])

  const selectable = useMemo(() => {
    const used = new Set(slots.filter(Boolean) as string[])
    return earnedBadges.filter((b) => !used.has(b.key))
  }, [earnedBadges, slots])

  const badgeMeta = (key: string) => BADGE_CATALOG.find((b) => b.key === key)

  const handlePick = async (key: string | null) => {
    if (pickerSlot === null) return
    const next = slots.map((s, i) => (i === pickerSlot ? key : s)).filter((k): k is string => !!k)
    setPickerError(null)
    try {
      await onChange(next)
      setPickerSlot(null)
    } catch (e) {
      setPickerError(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {slots.map((key, i) => {
          const meta = key ? badgeMeta(key) : null
          const label = key ? (BADGE_LABELS[key] ?? key) : null
          const content = (
            <View style={styles.slotColumn}>
              <View style={[styles.slot, key && styles.slotFilled, canEdit && styles.slotEditable]}>
                {meta ? (
                  <Text style={styles.slotEmoji}>{meta.emoji}</Text>
                ) : (
                  <Ionicons name="trophy-outline" size={22} color={Colors.textSecondary} />
                )}
              </View>
              <Text style={[styles.slotLabel, !label && styles.slotLabelEmpty]} numberOfLines={2}>
                {label ?? (canEdit ? 'Elegir' : '—')}
              </Text>
            </View>
          )

          return (
            <View key={i} style={styles.slotWrap}>
              {canEdit ? (
                <Pressable
                  onPress={() => setPickerSlot(i)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={
                    key ? `Cambiar logro ${label ?? i + 1}` : `Elegir logro ${i + 1}`
                  }
                  style={({ pressed }) => [pressed && styles.slotPressed]}>
                  {content}
                </Pressable>
              ) : (
                content
              )}
            </View>
          )
        })}
      </View>

      {canEdit ? (
        <Text style={styles.helper}>Toca un hueco para elegir hasta 3 logros.</Text>
      ) : null}

      <Modal
        visible={pickerSlot !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerSlot(null)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setPickerSlot(null)}>
          <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Elige un logro</Text>
            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {selectable.length === 0 && pickerSlot !== null && slots[pickerSlot] === null ? (
                <Text style={styles.pickerEmpty}>Aún no tienes más logros disponibles.</Text>
              ) : null}
              {selectable.map((badge) => {
                const meta = badgeMeta(badge.key)
                return (
                  <Pressable
                    key={badge.key}
                    onPress={() => void handlePick(badge.key)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.pickerItem,
                      pressed && styles.pickerItemPressed,
                    ]}>
                    <Text style={styles.pickerEmoji}>{meta?.emoji ?? '🏅'}</Text>
                    <View style={styles.pickerItemText}>
                      <Text style={styles.pickerItemTitle}>
                        {BADGE_LABELS[badge.key] ?? badge.key}
                      </Text>
                      <Text style={styles.pickerItemHint}>{meta?.hint}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </ScrollView>
            {pickerError ? <Text style={styles.pickerError}>{pickerError}</Text> : null}
            <View style={styles.pickerActions}>
              {pickerSlot !== null && slots[pickerSlot] !== null ? (
                <Pressable
                  onPress={() => void handlePick(null)}
                  disabled={saving}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}>
                  <Text style={styles.removeBtnText}>Quitar</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setPickerSlot(null)}
                disabled={saving}
                accessibilityRole="button"
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
                <Text style={styles.closeBtnText}>Cerrar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  slotWrap: {
    flex: 1,
    alignItems: 'center',
  },
  slotColumn: {
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  slot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFilled: {
    borderStyle: 'solid',
    borderColor: Colors.primary,
    backgroundColor: Colors.wonBackground,
  },
  slotEditable: {
    borderColor: Colors.primary,
  },
  slotPressed: {
    opacity: 0.75,
  },
  slotEmoji: {
    fontSize: 26,
  },
  slotLabel: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 14,
    minHeight: 28,
  },
  slotLabelEmpty: {
    color: Colors.textSecondary,
  },
  pressed: {
    opacity: 0.8,
  },
  helper: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '70%',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  pickerTitle: {
    fontFamily: Fonts.bold,
    fontSize: 17,
    color: Colors.textPrimary,
  },
  pickerList: {
    flexGrow: 0,
  },
  pickerEmpty: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
    paddingVertical: 12,
    textAlign: 'center',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  pickerItemPressed: {
    backgroundColor: Colors.wonBackground,
  },
  pickerEmoji: {
    fontSize: 24,
  },
  pickerItemText: {
    flex: 1,
    gap: 2,
  },
  pickerItemTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  pickerItemHint: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  pickerError: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.danger,
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  removeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  removeBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.danger,
  },
  closeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
})
