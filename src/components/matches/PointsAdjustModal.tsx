import { useState } from 'react'
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'
import Slider from '@react-native-community/slider'

import { Button } from '@/components/ui/Button'
import { MUS_POINTS_SLIDER_MAX } from '@/constants'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export type PointsAdjustMode = 'add' | 'subtract'

type PointsAdjustModalProps = {
  visible: boolean
  mode: PointsAdjustMode
  teamName: string
  onClose: () => void
  onConfirm: (amount: number) => void
}

export function PointsAdjustModal({
  visible,
  mode,
  teamName,
  onClose,
  onConfirm,
}: PointsAdjustModalProps) {
  const [amount, setAmount] = useState(1)

  const handleClose = () => {
    setAmount(1)
    onClose()
  }

  const handleConfirm = () => {
    onConfirm(amount)
    setAmount(1)
  }

  const title = mode === 'add' ? 'Sumar puntos' : 'Restar puntos'
  const actionLabel = mode === 'add' ? 'Sumar' : 'Restar'

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <SafeAreaView style={s.wrap}>
        <View style={s.header}>
          <Text style={s.title}>{title}</Text>
          <Pressable onPress={handleClose} accessibilityRole="button" accessibilityLabel="Cerrar">
            <Text style={s.close}>✕</Text>
          </Pressable>
        </View>
        <View style={s.body}>
          <Text style={s.subtitle}>
            {actionLabel} puntos a <Text style={s.teamName}>{teamName}</Text>
          </Text>

          <Text style={s.amount}>{amount}</Text>

          <Slider
            style={s.slider}
            minimumValue={1}
            maximumValue={MUS_POINTS_SLIDER_MAX}
            step={1}
            value={amount}
            onValueChange={setAmount}
            minimumTrackTintColor={Colors.primary}
            maximumTrackTintColor={Colors.border}
            thumbTintColor={Colors.primary}
          />

          <View style={s.rangeRow}>
            <Text style={s.rangeLabel}>1</Text>
            <Text style={s.rangeLabel}>{MUS_POINTS_SLIDER_MAX}</Text>
          </View>

          <Button
            title={`${actionLabel} ${amount} punto${amount > 1 ? 's' : ''}`}
            onPress={handleConfirm}
          />
          <Button
            title="Cancelar"
            variant="outline"
            onPress={handleClose}
            style={{ marginTop: 8 }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.textPrimary },
  close: { fontSize: 18, color: Colors.textSecondary, padding: 4 },
  body: { padding: 20 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: 24, lineHeight: 22 },
  teamName: { fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  amount: {
    fontSize: 48,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  slider: { width: '100%', height: 40 },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  rangeLabel: { fontSize: 13, color: Colors.textSecondary },
})
