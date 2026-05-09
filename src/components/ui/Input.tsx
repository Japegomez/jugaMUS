import { forwardRef } from 'react'
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'

export interface InputProps extends TextInputProps {
  label: string
  error?: string
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, style, accessibilityLabel, ...rest },
  ref
) {
  const inputId = rest.id ?? rest.nativeID
  const a11yLabel = accessibilityLabel ?? label

  return (
    <View style={styles.wrap}>
      <Text
        accessibilityLabel={label}
        nativeID={inputId ? `${inputId}-label` : undefined}
        style={styles.label}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={a11yLabel}
        accessibilityHint={error}
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor="#888"
        {...rest}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  )
})

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
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#1a1a1a',
  },
  inputError: {
    borderColor: '#b00020',
  },
  error: {
    color: '#b00020',
    fontSize: 13,
    marginTop: 4,
  },
})
