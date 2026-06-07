import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter, type Href } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { GUEST_SCOREBOARD_STORAGE_ID } from '@/constants/guestScoreboard'
import { clearScoreboardState } from '@/lib/scoreboardStorage'
import { Colors } from '@/theme/colors'
import { Layout } from '@/theme/layout'
import { Fonts } from '@/theme/typography'

const setupSchema = z.object({
  teamAName: z
    .string()
    .trim()
    .min(1, 'Indica el nombre de la pareja A')
    .max(40, 'Nombre demasiado largo'),
  teamBName: z
    .string()
    .trim()
    .min(1, 'Indica el nombre de la pareja B')
    .max(40, 'Nombre demasiado largo'),
  durationTargetGames: z.number().int().min(1).max(6),
})

type SetupValues = z.infer<typeof setupSchema>

function DurationChip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  )
}

export default function GuestScoreboardSetupScreen() {
  const router = useRouter()

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      teamAName: '',
      teamBName: '',
      durationTargetGames: 3,
    },
  })

  const durationValue = watch('durationTargetGames')

  const onSubmit = handleSubmit(async (values) => {
    await clearScoreboardState(GUEST_SCOREBOARD_STORAGE_ID)
    const qs = new URLSearchParams({
      teamA: values.teamAName,
      teamB: values.teamBName,
      games: String(values.durationTargetGames),
    })
    router.push(`/(auth)/guest-scoreboard/play?${qs.toString()}` as Href)
  })

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Llevar la cuenta</Text>
        <Text style={styles.sub}>
          Indica los nombres de las parejas y a cuántos juegos se juega la partida.
        </Text>

        <Controller
          control={control}
          name="teamAName"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Pareja A"
              placeholder="Ej. Los del bar"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.teamAName?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="teamBName"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Pareja B"
              placeholder="Ej. Los de la peña"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.teamBName?.message}
            />
          )}
        />

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Juegos a ganar *</Text>
          <View style={styles.durationRow}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <DurationChip
                key={n}
                label={String(n)}
                selected={durationValue === n}
                onPress={() => setValue('durationTargetGames', n, { shouldValidate: true })}
              />
            ))}
          </View>
          {errors.durationTargetGames ? (
            <Text style={styles.error}>{errors.durationTargetGames.message}</Text>
          ) : null}
        </View>

        <Button
          title="Empezar partida"
          onPress={onSubmit}
          loading={isSubmitting}
          style={styles.btn}
        />
        <Button
          title="Volver al inicio"
          variant="outline"
          onPress={() => router.replace('/(auth)/login')}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Layout.authScreenTopPadding + 8,
    paddingBottom: 32,
  },
  heading: {
    fontSize: 26,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  fieldWrap: { marginBottom: 20 },
  label: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minWidth: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  chipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  chipLabel: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
  },
  chipLabelSelected: {
    color: Colors.white,
  },
  error: {
    marginTop: 6,
    fontSize: 13,
    color: Colors.danger,
  },
  btn: { marginTop: 8, marginBottom: 12 },
})
