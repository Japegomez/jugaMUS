import { useState } from 'react'
import { Modal, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'
import RNDateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'

import {
  dateToLocalIsoString,
  formatDisplay,
  parseIsoToDate,
} from '@/components/ui/dateTimePickerUtils'

import type { DateTimePickerProps } from '@/components/ui/DateTimePicker.types'

export type { DateTimePickerProps }

export function DateTimePicker({
  label = 'Fecha y hora',
  value,
  onChange,
  error,
  minDate,
}: DateTimePickerProps) {
  if (Platform.OS === 'ios') {
    return (
      <IOSPicker label={label} value={value} onChange={onChange} error={error} minDate={minDate} />
    )
  }

  return (
    <AndroidPicker
      label={label}
      value={value}
      onChange={onChange}
      error={error}
      minDate={minDate}
    />
  )
}

// ─── iOS: modal + spinner datetime ────────────────────────────────────────────

function IOSPicker({ label, value, onChange, error, minDate }: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => parseIsoToDate(value))

  const openModal = () => {
    setDraft(parseIsoToDate(value))
    setOpen(true)
  }

  const confirm = () => {
    onChange(dateToLocalIsoString(draft))
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

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={cancel}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Pressable onPress={cancel} accessibilityRole="button" accessibilityLabel="Cancelar">
              <Text style={s.modalCancel}>Cancelar</Text>
            </Pressable>
            <Text style={s.modalTitle}>Fecha y hora</Text>
            <Pressable onPress={confirm} accessibilityRole="button" accessibilityLabel="Confirmar">
              <Text style={s.modalConfirm}>Listo</Text>
            </Pressable>
          </View>
          {/* Fondo y colores explícitos: sin esto, ruedas blancas sobre sheet claro en iOS */}
          <View style={s.iosPickerWrap}>
            <RNDateTimePicker
              value={draft}
              mode="datetime"
              display="spinner"
              minimumDate={minDate}
              locale="es_ES"
              themeVariant="light"
              textColor="#1a1a1a"
              accentColor="#1a5f4a"
              onChange={(_, d) => {
                if (d) setDraft(d)
              }}
              style={s.iosSpinner}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  )
}

// ─── Android: sequential date → time dialogs ─────────────────────────────────

type AndroidStep = 'idle' | 'date' | 'time'

function AndroidPicker({ label, value, onChange, error, minDate }: DateTimePickerProps) {
  const [step, setStep] = useState<AndroidStep>('idle')
  const [pending, setPending] = useState(() => parseIsoToDate(value))

  const openFlow = () => {
    setPending(parseIsoToDate(value))
    setStep('date')
  }

  const onAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed') {
      setStep('idle')
      return
    }
    if (!selected) {
      setStep('idle')
      return
    }

    if (step === 'date') {
      const next = new Date(selected)
      next.setHours(pending.getHours(), pending.getMinutes(), 0, 0)
      if (minDate && next < minDate) {
        setPending(new Date(minDate))
      } else {
        setPending(next)
      }
      setStep('time')
      return
    }

    if (step === 'time') {
      const final = new Date(pending)
      final.setHours(selected.getHours(), selected.getMinutes(), 0, 0)
      let out = final
      if (minDate && out < minDate) out = new Date(minDate)
      onChange(dateToLocalIsoString(out))
      setStep('idle')
    }
  }

  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}

      <Pressable
        style={[s.field, error ? s.fieldError : null]}
        onPress={openFlow}
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

      {step === 'date' ? (
        <RNDateTimePicker
          key="android-date"
          value={pending}
          mode="date"
          display="default"
          minimumDate={minDate}
          onChange={onAndroidChange}
        />
      ) : null}

      {step === 'time' ? (
        <RNDateTimePicker
          key="android-time"
          value={pending}
          mode="time"
          display="default"
          is24Hour
          onChange={onAndroidChange}
        />
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { marginBottom: 4 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#1a1a1a',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  fieldError: { borderColor: '#b00020' },
  fieldText: { flex: 1, fontSize: 16, color: '#1a1a1a' },
  fieldPlaceholder: { color: '#888' },
  chevron: { fontSize: 12, color: '#666', paddingLeft: 8 },
  error: { color: '#b00020', fontSize: 13, marginTop: 4 },
  modal: { flex: 1, backgroundColor: '#d5dad5' },
  iosPickerWrap: {
    flex: 1,
    backgroundColor: '#c9cfc9',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  modalCancel: { fontSize: 16, color: '#666' },
  modalConfirm: { fontSize: 16, color: '#1a5f4a', fontWeight: '700' },
  iosSpinner: { alignSelf: 'stretch', backgroundColor: 'transparent' },
})
