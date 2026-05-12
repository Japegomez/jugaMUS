import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate()
}

function toISO(d: { day: number; month: number; year: number; hour: number; minute: number }) {
  const dateStr = `${d.year}-${pad(d.month)}-${pad(d.day)}`
  const timeStr = `${pad(d.hour)}:${pad(d.minute)}:00`
  return `${dateStr}T${timeStr}`
}

function fromISO(iso: string): {
  day: number
  month: number
  year: number
  hour: number
  minute: number
} {
  const d = new Date(iso)
  if (isNaN(d.getTime())) {
    const now = new Date()
    return {
      day: now.getDate(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      hour: now.getHours(),
      minute: now.getMinutes(),
    }
  }
  return {
    day: d.getDate(),
    month: d.getMonth() + 1,
    year: d.getFullYear(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  }
}

function formatDisplay(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Column Picker ────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 44

interface ColumnPickerProps {
  items: { label: string; value: number }[]
  selectedValue: number
  onSelect: (value: number) => void
}

function ColumnPicker({ items, selectedValue, onSelect }: ColumnPickerProps) {
  const flatListRef = useRef<FlatList>(null)
  const selectedIndex = items.findIndex((i) => i.value === selectedValue)

  useEffect(() => {
    if (flatListRef.current && selectedIndex >= 0) {
      flatListRef.current.scrollToIndex({
        index: selectedIndex,
        animated: false,
        viewPosition: 0.5,
      })
    }
  }, [selectedIndex])

  return (
    <View style={col.wrap}>
      <View style={col.highlight} pointerEvents="none" />
      <FlatList
        ref={flatListRef}
        data={items}
        keyExtractor={(item) => String(item.value)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT)
          const clamped = Math.max(0, Math.min(index, items.length - 1))
          onSelect(items[clamped].value)
        }}
        renderItem={({ item }) => (
          <Pressable
            style={col.item}
            onPress={() => onSelect(item.value)}
            accessibilityRole="button"
            accessibilityLabel={item.label}>
            <Text style={[col.itemText, item.value === selectedValue && col.itemTextSelected]}>
              {item.label}
            </Text>
          </Pressable>
        )}
      />
    </View>
  )
}

const col = StyleSheet.create({
  wrap: {
    flex: 1,
    height: ITEM_HEIGHT * 5,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    zIndex: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 18,
    color: '#aaa',
  },
  itemTextSelected: {
    color: '#1a1a1a',
    fontWeight: '700',
  },
})

// ─── Public component ─────────────────────────────────────────────────────────

export interface DateTimePickerProps {
  label?: string
  value: string // ISO 8601 local datetime string e.g. "2026-06-15T18:00:00"
  onChange: (iso: string) => void
  error?: string
  minDate?: Date
}

export function DateTimePicker({
  label = 'Fecha y hora',
  value,
  onChange,
  error,
  minDate,
}: DateTimePickerProps) {
  const [visible, setVisible] = useState(false)
  const [draft, setDraft] = useState(() => fromISO(value))

  const handleOpen = () => {
    setDraft(fromISO(value))
    setVisible(true)
  }

  const handleConfirm = () => {
    onChange(toISO(draft))
    setVisible(false)
  }

  const handleCancel = () => setVisible(false)

  const setField = useCallback((field: keyof typeof draft, val: number) => {
    setDraft((prev) => {
      const next = { ...prev, [field]: val }
      // Clamp day if month/year changed and day exceeds new max
      const maxDay = daysInMonth(next.month, next.year)
      if (next.day > maxDay) next.day = maxDay
      return next
    })
  }, [])

  const baseYear = minDate ? minDate.getFullYear() : new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => {
    const y = baseYear + i
    return { label: String(y), value: y }
  })
  const months = [
    { label: 'Ene', value: 1 },
    { label: 'Feb', value: 2 },
    { label: 'Mar', value: 3 },
    { label: 'Abr', value: 4 },
    { label: 'May', value: 5 },
    { label: 'Jun', value: 6 },
    { label: 'Jul', value: 7 },
    { label: 'Ago', value: 8 },
    { label: 'Sep', value: 9 },
    { label: 'Oct', value: 10 },
    { label: 'Nov', value: 11 },
    { label: 'Dic', value: 12 },
  ]
  const maxDay = daysInMonth(draft.month, draft.year)
  const days = Array.from({ length: maxDay }, (_, i) => ({
    label: pad(i + 1),
    value: i + 1,
  }))
  const hours = Array.from({ length: 24 }, (_, i) => ({
    label: pad(i),
    value: i,
  }))
  const minutes = Array.from({ length: 12 }, (_, i) => ({
    label: pad(i * 5),
    value: i * 5,
  }))

  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}

      <Pressable
        style={[s.field, error ? s.fieldError : null]}
        onPress={handleOpen}
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
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancel}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Pressable
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancelar">
              <Text style={s.modalCancel}>Cancelar</Text>
            </Pressable>
            <Text style={s.modalTitle}>Fecha y hora</Text>
            <Pressable
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel="Confirmar">
              <Text style={s.modalConfirm}>Confirmar</Text>
            </Pressable>
          </View>

          <View style={s.pickerRow}>
            <View style={s.sectionLabel}>
              <Text style={s.sectionText}>FECHA</Text>
            </View>
            <View style={s.columns}>
              <ColumnPicker
                items={days}
                selectedValue={draft.day}
                onSelect={(v) => setField('day', v)}
              />
              <ColumnPicker
                items={months}
                selectedValue={draft.month}
                onSelect={(v) => setField('month', v)}
              />
              <ColumnPicker
                items={years}
                selectedValue={draft.year}
                onSelect={(v) => setField('year', v)}
              />
            </View>
          </View>

          <View style={s.divider} />

          <View style={s.pickerRow}>
            <View style={s.sectionLabel}>
              <Text style={s.sectionText}>HORA</Text>
            </View>
            <View style={s.columns}>
              <ColumnPicker
                items={hours}
                selectedValue={draft.hour}
                onSelect={(v) => setField('hour', v)}
              />
              <View style={s.timeSeparator}>
                <Text style={s.timeSeparatorText}>:</Text>
              </View>
              <ColumnPicker
                items={minutes}
                selectedValue={draft.minute}
                onSelect={(v) => setField('minute', v)}
              />
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
  modal: { flex: 1, backgroundColor: '#f6f7f4' },
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
  pickerRow: { paddingHorizontal: 16, paddingTop: 12 },
  sectionLabel: { marginBottom: 4 },
  sectionText: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 1 },
  columns: { flexDirection: 'row', alignItems: 'center' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ddd',
    marginHorizontal: 16,
    marginTop: 8,
  },
  timeSeparator: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSeparatorText: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
})
