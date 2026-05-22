import { forwardRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export interface InputProps extends TextInputProps {
  label: string
  error?: string
  showPasswordToggle?: boolean
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, style, accessibilityLabel, secureTextEntry, showPasswordToggle = false, ...rest },
  ref
) {
  const [passwordVisible, setPasswordVisible] = useState(false)
  const inputId = rest.id ?? rest.nativeID
  const a11yLabel = accessibilityLabel ?? label
  const isSecure = showPasswordToggle ? !passwordVisible : secureTextEntry

  return (
    <View style={styles.wrap}>
      <Text
        accessibilityLabel={label}
        nativeID={inputId ? `${inputId}-label` : undefined}
        style={styles.label}>
        {label}
      </Text>
      <View style={styles.inputWrap}>
        <TextInput
          ref={ref}
          accessibilityLabel={a11yLabel}
          accessibilityHint={error}
          secureTextEntry={isSecure}
          style={[
            styles.input,
            showPasswordToggle ? styles.inputWithToggle : null,
            error ? styles.inputError : null,
            style,
          ]}
          placeholderTextColor={Colors.textSecondary}
          {...rest}
        />
        {showPasswordToggle ? (
          <Pressable
            style={styles.toggleBtn}
            onPress={() => setPasswordVisible((visible) => !visible)}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            accessibilityState={{ selected: passwordVisible }}>
            <Ionicons
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={Colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
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
    fontFamily: Fonts.medium,
    marginBottom: 6,
    color: Colors.textPrimary,
  },
  inputWrap: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: Fonts.regular,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
  },
  inputWithToggle: {
    paddingRight: 48,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  toggleBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  error: {
    color: Colors.danger,
    fontSize: 13,
    fontFamily: Fonts.regular,
    marginTop: 4,
  },
})
