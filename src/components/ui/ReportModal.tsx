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
import { useSubmitReport } from '@/hooks/useReports'
import { REPORT_REASONS, type ReportTargetType } from '@/services/reports.service'

export interface ReportModalProps {
  visible: boolean
  onClose: () => void
  targetType: ReportTargetType
  targetId: string
  /** Contexto opcional (ej. nombre de usuario o título de partida). */
  targetLabel?: string
}

function titleForTarget(targetType: ReportTargetType) {
  switch (targetType) {
    case 'match':
      return 'Reportar partida'
    case 'user':
      return 'Reportar usuario'
    case 'result':
      return 'Reportar resultado'
    default:
      return 'Reportar'
  }
}

export function ReportModal({
  visible,
  onClose,
  targetType,
  targetId,
  targetLabel,
}: ReportModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const submitReportMutation = useSubmitReport()

  const reasons = REPORT_REASONS[targetType]

  const handleClose = () => {
    if (submitReportMutation.isPending) return
    onClose()
  }

  const handleSubmit = async () => {
    if (!selectedReason) return
    try {
      await submitReportMutation.mutateAsync({
        targetType,
        targetId,
        reason: selectedReason,
        notes: notes.trim() ? notes.trim() : null,
      })
      Alert.alert(
        'Reporte enviado',
        'Gracias. Revisaremos tu reporte. El usuario reportado no verá tu identidad.'
      )
      onClose()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo enviar el reporte')
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <SafeAreaView style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>{titleForTarget(targetType)}</Text>
          <Pressable
            onPress={handleClose}
            disabled={submitReportMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Cerrar">
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        {targetLabel ? (
          <Text style={styles.context} numberOfLines={2}>
            {targetLabel}
          </Text>
        ) : null}

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled">
          {step === 1 ? (
            <>
              <Text style={styles.subtitle}>Elige un motivo</Text>
              {reasons.map((reason) => (
                <Pressable
                  key={reason}
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                  onPress={() => {
                    setSelectedReason(reason)
                    setStep(2)
                  }}
                  accessibilityRole="button">
                  <Text style={styles.optionLabel}>{reason}</Text>
                </Pressable>
              ))}
            </>
          ) : (
            <>
              <Text style={styles.selectedReasonLabel}>Motivo</Text>
              <Text style={styles.selectedReason}>{selectedReason}</Text>

              <Text style={[styles.subtitle, { marginTop: 16 }]}>Comentario (opcional)</Text>
              <TextInput
                style={styles.notes}
                multiline
                numberOfLines={4}
                placeholder="Añade detalles que ayuden a moderar…"
                placeholderTextColor="#888"
                value={notes}
                onChangeText={setNotes}
                textAlignVertical="top"
                accessibilityLabel="Comentario opcional del reporte"
              />

              <View style={styles.actions}>
                <Button
                  title="Atrás"
                  variant="secondary"
                  onPress={() => {
                    setStep(1)
                    setSelectedReason(null)
                  }}
                  disabled={submitReportMutation.isPending}
                  style={styles.actionBtn}
                />
                <Button
                  title="Enviar reporte"
                  onPress={handleSubmit}
                  loading={submitReportMutation.isPending}
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
  wrap: { flex: 1, backgroundColor: '#f6f7f4' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', flex: 1, paddingRight: 8 },
  close: { fontSize: 18, color: '#555', padding: 4 },
  context: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    fontSize: 14,
    color: '#555',
  },
  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 32 },
  subtitle: { fontSize: 15, color: '#555', marginBottom: 14 },
  option: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#1a5f4a',
  },
  optionPressed: { opacity: 0.85 },
  optionLabel: { fontSize: 16, fontWeight: '600', color: '#1a5f4a' },
  selectedReasonLabel: { fontSize: 13, fontWeight: '600', color: '#888' },
  selectedReason: { fontSize: 16, color: '#1a1a1a', marginTop: 4 },
  notes: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#1a1a1a',
    minHeight: 100,
  },
  actions: { marginTop: 20, gap: 10 },
  actionBtn: {},
})
