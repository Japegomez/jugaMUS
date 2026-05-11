import { useRef, useState } from 'react'
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native'

export interface CountryCode {
  code: string
  dialCode: string
  flag: string
  name: string
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: 'ES', dialCode: '+34', flag: '🇪🇸', name: 'España' },
  { code: 'PT', dialCode: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: 'FR', dialCode: '+33', flag: '🇫🇷', name: 'Francia' },
  { code: 'DE', dialCode: '+49', flag: '🇩🇪', name: 'Alemania' },
  { code: 'IT', dialCode: '+39', flag: '🇮🇹', name: 'Italia' },
  { code: 'GB', dialCode: '+44', flag: '🇬🇧', name: 'Reino Unido' },
  { code: 'BE', dialCode: '+32', flag: '🇧🇪', name: 'Bélgica' },
  { code: 'NL', dialCode: '+31', flag: '🇳🇱', name: 'Países Bajos' },
  { code: 'CH', dialCode: '+41', flag: '🇨🇭', name: 'Suiza' },
  { code: 'AT', dialCode: '+43', flag: '🇦🇹', name: 'Austria' },
  { code: 'PL', dialCode: '+48', flag: '🇵🇱', name: 'Polonia' },
  { code: 'SE', dialCode: '+46', flag: '🇸🇪', name: 'Suecia' },
  { code: 'NO', dialCode: '+47', flag: '🇳🇴', name: 'Noruega' },
  { code: 'DK', dialCode: '+45', flag: '🇩🇰', name: 'Dinamarca' },
  { code: 'AR', dialCode: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: 'MX', dialCode: '+52', flag: '🇲🇽', name: 'México' },
  { code: 'CO', dialCode: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: 'CL', dialCode: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: 'US', dialCode: '+1', flag: '🇺🇸', name: 'EE. UU.' },
]

/**
 * Parse a full E.164 number into {dialCode, localNumber}.
 * Tries longest prefix match against the COUNTRY_CODES list.
 */
export function parseE164(e164: string): { country: CountryCode; localNumber: string } {
  const defaultCountry = COUNTRY_CODES[0]
  if (!e164.startsWith('+')) return { country: defaultCountry, localNumber: e164 }

  // Try longest match first (e.g. +351 before +1)
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length)
  for (const c of sorted) {
    if (e164.startsWith(c.dialCode)) {
      return { country: c, localNumber: e164.slice(c.dialCode.length) }
    }
  }
  return { country: defaultCountry, localNumber: e164.slice(3) }
}

export interface PhoneInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  label?: string
  value: string
  onChangeText: (e164: string) => void
  error?: string
}

export function PhoneInput({
  label = 'Teléfono',
  value,
  onChangeText,
  error,
  ...rest
}: PhoneInputProps) {
  const { country: parsedCountry, localNumber: parsedLocal } = parseE164(value)
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(parsedCountry)
  const [localNumber, setLocalNumber] = useState(parsedLocal)
  const [modalVisible, setModalVisible] = useState(false)
  const inputRef = useRef<TextInput>(null)

  const handleLocalChange = (text: string) => {
    // Strip any non-digit chars the user might paste
    const digits = text.replace(/\D/g, '')
    setLocalNumber(digits)
    onChangeText(`${selectedCountry.dialCode}${digits}`)
  }

  const handleCountrySelect = (country: CountryCode) => {
    setSelectedCountry(country)
    setModalVisible(false)
    onChangeText(`${country.dialCode}${localNumber}`)
    // Re-focus the number input
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.row, error ? styles.rowError : null]}>
        {/* Country code button */}
        <Pressable
          style={styles.dialCodeButton}
          onPress={() => setModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Código de país: ${selectedCountry.name} ${selectedCountry.dialCode}`}>
          <Text style={styles.flag}>{selectedCountry.flag}</Text>
          <Text style={styles.dialCode}>{selectedCountry.dialCode}</Text>
          <Text style={styles.chevron}>▾</Text>
        </Pressable>

        <View style={styles.divider} />

        {/* Local number input */}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={localNumber}
          onChangeText={handleLocalChange}
          keyboardType="phone-pad"
          placeholderTextColor="#888"
          placeholder="612 345 678"
          accessibilityLabel="Número de teléfono"
          {...rest}
        />
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {/* Country picker modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Selecciona el país</Text>
            <Pressable
              onPress={() => setModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar">
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>

          <FlatList
            data={COUNTRY_CODES}
            keyExtractor={(item) => item.code}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.countryItem,
                  pressed && styles.countryItemPressed,
                  item.code === selectedCountry.code && styles.countryItemSelected,
                ]}
                onPress={() => handleCountrySelect(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.name} ${item.dialCode}`}>
                <Text style={styles.countryFlag}>{item.flag}</Text>
                <Text style={styles.countryName}>{item.name}</Text>
                <Text style={styles.countryDial}>{item.dialCode}</Text>
                {item.code === selectedCountry.code ? (
                  <Text style={styles.checkmark}>✓</Text>
                ) : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#1a1a1a',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  rowError: {
    borderColor: '#b00020',
  },
  dialCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  flag: {
    fontSize: 20,
  },
  dialCode: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  chevron: {
    fontSize: 11,
    color: '#666',
    marginLeft: 2,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a1a',
  },
  error: {
    color: '#b00020',
    fontSize: 13,
    marginTop: 4,
  },
  // Modal
  modal: {
    flex: 1,
    backgroundColor: '#f6f7f4',
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
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalClose: {
    fontSize: 18,
    color: '#555',
    padding: 4,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    gap: 12,
  },
  countryItemPressed: {
    backgroundColor: '#f0f0f0',
  },
  countryItemSelected: {
    backgroundColor: '#eef7f3',
  },
  countryFlag: {
    fontSize: 24,
    width: 32,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  countryDial: {
    fontSize: 15,
    color: '#555',
    fontVariant: ['tabular-nums'],
  },
  checkmark: {
    fontSize: 16,
    color: '#1a5f4a',
    fontWeight: '700',
    marginLeft: 8,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#eee',
    marginLeft: 68,
  },
})
