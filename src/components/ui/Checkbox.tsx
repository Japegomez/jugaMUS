import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

type CheckboxProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function Checkbox({ label, checked, onChange, disabled = false }: CheckboxProps) {
  return (
    <Pressable
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Ionicons name="checkmark" size={16} color={Colors.white} /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  rowDisabled: { opacity: 0.5 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  label: { flex: 1, fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
})
