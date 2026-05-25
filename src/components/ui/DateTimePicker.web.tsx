import { createElement, useState } from 'react'
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import {
  dateToLocalIsoString,
  formatDisplay,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '@/components/ui/dateTimePickerUtils'
import type { DateTimePickerProps } from '@/components/ui/DateTimePicker.types'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export type { DateTimePickerProps }

/** Web: native `datetime-local` input inside a modal (community picker is not supported on web). */
export function DateTimePicker({
  label = 'Fecha y hora',
  value,
  onChange,
  error,
  minDate,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => toDatetimeLocalValue(value))

  const openModal = () => {
    setDraft(toDatetimeLocalValue(value))
    setOpen(true)
  }

  const minAttr = minDate ? toDatetimeLocalValue(dateToLocalIsoString(minDate)) : undefined

  const confirm = () => {
    onChange(fromDatetimeLocalValue(draft))
    setOpen(false)
  }

  const cancel = () => setOpen(false)

  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}

      <Pressable
        style={[s.field, error ? s.fieldError : null]}
        onPress={openModal}
        accessibilityRole="button"
        accessibilityLabel={value ? `Fecha: ${formatDisplay(value)}` : 'Seleccionar fecha y hora'}>
        <Text style={[s.fieldText, !value && s.fieldPlaceholder]}>
          {value ? formatDisplay(value) : 'Seleccionar fecha y hora'}
        </Text>
        <Text style={s.chevron}>▾</Text>
      </Pressable>

      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={cancel}>
        <SafeAreaView style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Fecha y hora</Text>

            {createElement('input', {
              type: 'datetime-local',
              value: draft,
              min: minAttr,
              onChange: (e: { currentTarget: { value: string } }) =>
                setDraft(e.currentTarget.value),
              style: s.webInput as object,
            })}

            <View style={s.modalActions}>
              <Pressable onPress={cancel} style={s.modalBtnSecondary} accessibilityRole="button">
                <Text style={s.modalBtnSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={confirm} style={s.modalBtnPrimary} accessibilityRole="button">
                <Text style={s.modalBtnPrimaryText}>Listo</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { marginBottom: 4 },
  label: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    marginBottom: 6,
    color: Colors.textPrimary,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  fieldError: { borderColor: Colors.danger },
  fieldText: { flex: 1, fontSize: 16, color: Colors.textPrimary },
  fieldPlaceholder: { color: Colors.textSecondary },
  chevron: { fontSize: 12, color: Colors.textSecondary, paddingLeft: 8 },
  error: { color: Colors.danger, fontSize: 13, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 20,
    gap: 16,
  },
  modalTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.textPrimary },
  webInput: {
    width: '100%',
    fontSize: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    boxSizing: 'border-box',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtnSecondary: { paddingVertical: 10, paddingHorizontal: 14 },
  modalBtnSecondaryText: { fontSize: 16, color: Colors.textSecondary },
  modalBtnPrimary: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  modalBtnPrimaryText: { fontSize: 16, fontFamily: Fonts.semiBold, color: Colors.white },
})
