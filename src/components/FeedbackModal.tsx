import { useState } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { Button } from '@/components/ui/Button'
import { useSubmitFeedback } from '@/hooks/useFeedback'
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from '@/services/feedback.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export interface FeedbackModalProps {
  visible: boolean
  onClose: () => void
}

export function FeedbackModal({ visible, onClose }: FeedbackModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [category, setCategory] = useState<FeedbackCategory | null>(null)
  const [message, setMessage] = useState('')
  const submitFeedback = useSubmitFeedback()

  const resetForm = () => {
    setStep(1)
    setCategory(null)
    setMessage('')
  }

  const handleClose = () => {
    if (submitFeedback.isPending) return
    resetForm()
    onClose()
  }

  const handleSubmit = async () => {
    if (!category) return
    try {
      await submitFeedback.mutateAsync({ category, message })
      Alert.alert(
        'Feedback enviado',
        'Gracias por tu mensaje. Lo revisaremos para mejorar jugaMUS.'
      )
      handleClose()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo enviar el feedback')
    }
  }

  const categoryLabel = FEEDBACK_CATEGORIES.find((c) => c.value === category)?.label

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={resetForm}
      onRequestClose={handleClose}>
      <SafeAreaView style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>Enviar feedback</Text>
          <Pressable
            onPress={handleClose}
            disabled={submitFeedback.isPending}
            accessibilityRole="button"
            accessibilityLabel="Cerrar">
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled">
          {step === 1 ? (
            <>
              <Text style={styles.subtitle}>¿Qué quieres contarnos?</Text>
              {FEEDBACK_CATEGORIES.map((item) => (
                <Pressable
                  key={item.value}
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                  onPress={() => {
                    setCategory(item.value)
                    setStep(2)
                  }}
                  accessibilityRole="button">
                  <Text style={styles.optionLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </>
          ) : (
            <>
              <Text style={styles.selectedLabel}>Tipo</Text>
              <Text style={styles.selectedValue}>{categoryLabel}</Text>

              <Text style={[styles.subtitle, { marginTop: 16 }]}>Tu mensaje</Text>
              <TextInput
                style={styles.messageInput}
                multiline
                numberOfLines={5}
                placeholder="Describe el problema o tu idea con el mayor detalle posible…"
                placeholderTextColor={Colors.textSecondary}
                value={message}
                onChangeText={setMessage}
                textAlignVertical="top"
                accessibilityLabel="Mensaje de feedback"
              />
              <Text style={styles.hint}>Mínimo 10 caracteres</Text>

              <View style={styles.actions}>
                <Button
                  title="Atrás"
                  variant="secondary"
                  onPress={() => {
                    setStep(1)
                    setCategory(null)
                  }}
                  disabled={submitFeedback.isPending}
                  style={styles.actionBtn}
                />
                <Button
                  title="Enviar"
                  onPress={() => void handleSubmit()}
                  loading={submitFeedback.isPending}
                  disabled={message.trim().length < 10}
                  style={styles.actionBtn}
                />
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
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
  title: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    flex: 1,
    paddingRight: 8,
  },
  close: { fontSize: 18, color: Colors.textSecondary, padding: 4 },
  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 32 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: 14 },
  option: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  optionPressed: { opacity: 0.85 },
  optionLabel: { fontSize: 16, fontFamily: Fonts.semiBold, color: Colors.primary },
  selectedLabel: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  selectedValue: { fontSize: 16, color: Colors.textPrimary, marginTop: 4 },
  messageInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    minHeight: 120,
  },
  hint: { fontSize: 12, color: Colors.textSecondary, marginTop: 6 },
  actions: { marginTop: 20, gap: 10 },
  actionBtn: {},
})
