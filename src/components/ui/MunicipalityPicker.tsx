import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { searchMunicipalities, type Municipality } from '@/utils/municipalities'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export interface MunicipalityPickerProps {
  label?: string
  value: string
  onChangeText: (value: string) => void
  error?: string
  placeholder?: string
}

export function MunicipalityPicker({
  label = 'Ciudad o pueblo',
  value,
  onChangeText,
  error,
  placeholder = 'Buscar municipio...',
}: MunicipalityPickerProps) {
  const [modalVisible, setModalVisible] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Municipality[]>([])
  const searchRef = useRef<TextInput>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [])

  const handleOpen = () => {
    setQuery('')
    setResults([])
    setModalVisible(true)
    setTimeout(() => searchRef.current?.focus(), 200)
  }

  const handleSearch = useCallback((text: string) => {
    setQuery(text)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    if (!text.trim()) {
      setResults([])
      return
    }
    searchDebounceRef.current = setTimeout(() => {
      setResults(searchMunicipalities(text))
      searchDebounceRef.current = null
    }, 120)
  }, [])

  const handleSelect = (municipality: Municipality) => {
    onChangeText(municipality.name)
    setModalVisible(false)
  }

  const handleClear = () => {
    onChangeText('')
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {/* Display field (read-only, opens modal on press) */}
      <Pressable
        style={[styles.field, error ? styles.fieldError : null]}
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={value ? `Municipio: ${value}` : placeholder}>
        <Text style={[styles.fieldText, !value && styles.fieldPlaceholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        {value ? (
          <Pressable
            onPress={handleClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Borrar municipio">
            <Text style={styles.clearBtn}>✕</Text>
          </Pressable>
        ) : (
          <Text style={styles.chevron}>▾</Text>
        )}
      </Pressable>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {/* Search modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modal}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Municipio</Text>
            <Pressable
              onPress={() => setModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar">
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>

          {/* Search input */}
          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              ref={searchRef}
              style={styles.searchInput}
              value={query}
              onChangeText={handleSearch}
              placeholder="Escribe el nombre del municipio"
              placeholderTextColor={Colors.textSecondary}
              autoCorrect={false}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>

          {/* Results */}
          {query.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Escribe para buscar un municipio</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Sin resultados para «{query}»</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.resultItem,
                    pressed && styles.resultItemPressed,
                    item.name === value && styles.resultItemSelected,
                  ]}
                  onPress={() => handleSelect(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  {item.name === value ? <Text style={styles.checkmark}>✓</Text> : null}
                </Pressable>
              )}
            />
          )}
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
  fieldError: {
    borderColor: Colors.danger,
  },
  fieldText: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  fieldPlaceholder: {
    color: Colors.textSecondary,
  },
  clearBtn: {
    fontSize: 14,
    color: Colors.textSecondary,
    paddingLeft: 8,
  },
  chevron: {
    fontSize: 12,
    color: Colors.textSecondary,
    paddingLeft: 8,
  },
  error: {
    color: Colors.danger,
    fontSize: 13,
    marginTop: 4,
  },
  // Modal
  modal: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  modalClose: {
    fontSize: 18,
    color: Colors.textSecondary,
    padding: 4,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
  },
  resultItemPressed: {
    backgroundColor: Colors.surface,
  },
  resultItemSelected: {
    backgroundColor: Colors.wonBackground,
  },
  resultName: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  checkmark: {
    fontSize: 16,
    color: Colors.primary,
    fontFamily: Fonts.bold,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 20,
  },
})
