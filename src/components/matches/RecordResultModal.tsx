import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const gamesField = z
  .string()
  .trim()
  .regex(/^\d+$/, 'Introduce un número entero')
  .refine((s) => {
    const n = Number(s)
    return n >= 0 && n <= 6
  }, 'Debe estar entre 0 y 6')
  .transform((s) => Number(s))

const schema = z.object({
  team_a_games: gamesField,
  team_b_games: gamesField,
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

export interface RecordResultModalProps {
  visible: boolean
  onClose: () => void
  loading: boolean
  onSubmit: (values: { teamAGames: number; teamBGames: number }) => void
}

export function RecordResultModal({ visible, onClose, loading, onSubmit }: RecordResultModalProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { team_a_games: '3', team_b_games: '3' },
  })

  const close = () => {
    if (loading) return
    reset({ team_a_games: '3', team_b_games: '3' })
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}>
      <SafeAreaView style={s.wrap}>
        <View style={s.header}>
          <Text style={s.title}>Registrar marcador</Text>
          <Pressable
            onPress={close}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Cerrar">
            <Text style={s.close}>✕</Text>
          </Pressable>
        </View>
        <View style={s.body}>
          <Text style={s.sub}>
            Partida personal: el marcador queda confirmado al guardar (sin validación del rival).
          </Text>

          <Controller
            control={control}
            name="team_a_games"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Juegos equipo A"
                keyboardType="number-pad"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.team_a_games?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="team_b_games"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Juegos equipo B"
                keyboardType="number-pad"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.team_b_games?.message}
              />
            )}
          />

          <Button
            title="Confirmar marcador"
            onPress={handleSubmit((v) =>
              onSubmit({
                teamAGames: v.team_a_games,
                teamBGames: v.team_b_games,
              })
            )}
            loading={loading}
            style={{ marginTop: 12 }}
          />
          <Button
            title="Cancelar"
            variant="outline"
            onPress={close}
            disabled={loading}
            style={{ marginTop: 8 }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const s = StyleSheet.create({
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
  title: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  close: { fontSize: 18, color: '#555', padding: 4 },
  body: { padding: 20 },
  sub: { fontSize: 14, color: '#666', marginBottom: 16, lineHeight: 20 },
})
