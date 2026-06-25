import { zodResolver } from '@hookform/resolvers/zod'
import { useFocusEffect } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import { useCallback } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Alert, StyleSheet, Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView'
import { dateToLocalIsoString } from '@/components/ui/dateTimePickerUtils'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { Input } from '@/components/ui/Input'
import { MunicipalityPicker } from '@/components/ui/MunicipalityPicker'
import { useCreateMatch } from '@/hooks/useMatches'
import { MATCH_VISIBILITY } from '@/constants'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'
import { showAlert } from '@/utils/alert'
import {
  PAST_DATE_INCOMPLETE_ROSTER_ALERT,
  requiresFutureStartAtForIncompleteRoster,
} from '@/utils/matchCreateForm'
import { showFormFieldsMissingAlert } from '@/utils/formValidation'
import { placeFormFields, refinePlaceRequired, placePayload } from '@/utils/placeForm'

// ─── Schema ───────────────────────────────────────────────────────────────────

const createMatchSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'El título debe tener al menos 3 caracteres')
      .max(80, 'El título es demasiado largo'),
    description: z
      .string()
      .trim()
      .max(300, 'Descripción demasiado larga')
      .optional()
      .or(z.literal('')),
    start_at: z.string().min(1, 'Selecciona fecha y hora'),
    city: z.string().trim().min(1, 'Selecciona una ciudad o pueblo'),
    ...placeFormFields,
    duration_target_games: z.number().int().min(1).max(6),
    visibility: z.enum([MATCH_VISIBILITY.PUBLIC, MATCH_VISIBILITY.LINK, MATCH_VISIBILITY.PRIVATE]),
    password: z.string().max(100, 'Contraseña demasiado larga').optional().or(z.literal('')),
    notes: z.string().trim().max(300, 'Notas demasiado largas').optional().or(z.literal('')),
    team_a_name: z.string().trim().max(40, 'Nombre demasiado largo').optional().or(z.literal('')),
    team_b_name: z.string().trim().max(40, 'Nombre demasiado largo').optional().or(z.literal('')),
    team_a_player_2: z
      .string()
      .trim()
      .max(80, 'Nombre demasiado largo')
      .optional()
      .or(z.literal('')),
    team_b_player_1: z
      .string()
      .trim()
      .max(80, 'Nombre demasiado largo')
      .optional()
      .or(z.literal('')),
    team_b_player_2: z
      .string()
      .trim()
      .max(80, 'Nombre demasiado largo')
      .optional()
      .or(z.literal('')),
  })
  .superRefine(refinePlaceRequired)
  .superRefine((data, ctx) => {
    if (data.visibility === MATCH_VISIBILITY.PRIVATE && !data.password?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Introduce una contraseña para la partida privada',
        path: ['password'],
      })
    }
  })

type CreateMatchValues = z.infer<typeof createMatchSchema>

function defaultStartAt() {
  return dateToLocalIsoString(new Date())
}

function createDefaultFormValues(): CreateMatchValues {
  return {
    title: '',
    description: '',
    start_at: defaultStartAt(),
    city: '',
    place_defined: true,
    place_text: '',
    duration_target_games: 3,
    visibility: MATCH_VISIBILITY.PUBLIC,
    password: '',
    notes: '',
    team_a_name: '',
    team_b_name: '',
    team_a_player_2: '',
    team_b_player_1: '',
    team_b_player_2: '',
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function textPlayerOrNull(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreateMatchScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const createMatch = useCreateMatch()

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateMatchValues>({
    resolver: zodResolver(createMatchSchema),
    defaultValues: createDefaultFormValues(),
  })

  useFocusEffect(
    useCallback(() => {
      reset(createDefaultFormValues())
    }, [reset])
  )

  const placeDefined = watch('place_defined')
  const durationValue = watch('duration_target_games')
  const visibilityValue = watch('visibility')

  const onSubmit = async (values: CreateMatchValues) => {
    if (
      requiresFutureStartAtForIncompleteRoster(values.start_at, {
        team_a_player_2: values.team_a_player_2,
        team_b_player_1: values.team_b_player_1,
        team_b_player_2: values.team_b_player_2,
      })
    ) {
      showAlert(PAST_DATE_INCOMPLETE_ROSTER_ALERT.title, PAST_DATE_INCOMPLETE_ROSTER_ALERT.message)
      return
    }
    try {
      const match = await createMatch.mutateAsync({
        data: {
          title: values.title,
          description: values.description || null,
          start_at: values.start_at,
          city: values.city,
          ...placePayload(values),
          duration_target_games: values.duration_target_games,
          visibility: values.visibility,
          location_privacy: 'participants_only',
          team_a_name: (values.team_a_name ?? '').trim(),
          team_b_name: (values.team_b_name ?? '').trim(),
          team_a_player_1: null,
          team_a_player_2: textPlayerOrNull(values.team_a_player_2),
          team_b_player_1: textPlayerOrNull(values.team_b_player_1),
          team_b_player_2: textPlayerOrNull(values.team_b_player_2),
        },
        password: values.visibility === MATCH_VISIBILITY.PRIVATE ? values.password : undefined,
      })
      router.replace(`/(tabs)/matches/${match.id}`)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo crear la partida')
    }
  }

  return (
    <KeyboardAwareScrollView
      style={s.scroll}
      contentContainerStyle={[s.container, { paddingTop: screenTopPadding(insets.top, 20) }]}>
      <Text style={s.heading}>Nueva partida</Text>

      {/* Título */}
      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <Input
            label="Título *"
            placeholder="Ej. Partida de los martes"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.title?.message}
            autoCapitalize="sentences"
          />
        )}
      />

      {/* Descripción */}
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <Input
            label="Descripción"
            placeholder="Detalles adicionales..."
            value={field.value ?? ''}
            onChangeText={field.onChange}
            error={errors.description?.message}
            multiline
            numberOfLines={3}
            autoCapitalize="sentences"
          />
        )}
      />

      {/* Fecha y hora */}
      <Controller
        control={control}
        name="start_at"
        render={({ field }) => (
          <DateTimePicker
            label="Fecha y hora *"
            value={field.value}
            onChange={field.onChange}
            error={errors.start_at?.message}
          />
        )}
      />

      {/* Ciudad */}
      <Controller
        control={control}
        name="city"
        render={({ field }) => (
          <MunicipalityPicker
            label="Ciudad o pueblo *"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.city?.message}
          />
        )}
      />

      {/* Lugar (texto) */}
      {placeDefined ? (
        <Controller
          control={control}
          name="place_text"
          render={({ field }) => (
            <Input
              label="Lugar *"
              placeholder="Ej. Bar El Rincón, Mesa del fondo"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              error={errors.place_text?.message}
              autoCapitalize="sentences"
            />
          )}
        />
      ) : null}

      {/* Lugar por definir */}
      <View style={s.row}>
        <View style={s.rowText}>
          <Text style={s.rowLabel}>Lugar por definir</Text>
          <Text style={s.rowHint}>Activa si aún no sabes dónde será</Text>
        </View>
        <Controller
          control={control}
          name="place_defined"
          render={({ field }) => (
            <Switch
              value={!field.value}
              onValueChange={(v) => {
                field.onChange(!v)
                if (v) setValue('place_text', '', { shouldValidate: true })
              }}
              trackColor={{ true: Colors.primary, false: Colors.border }}
              thumbColor={Colors.white}
            />
          )}
        />
      </View>

      {/* Duración */}
      <View style={s.fieldWrap}>
        <Text style={s.label}>Duración (juegos) *</Text>
        <View style={s.durationRow}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Chip
              key={n}
              label={String(n)}
              selected={durationValue === n}
              onPress={() => setValue('duration_target_games', n, { shouldValidate: true })}
            />
          ))}
        </View>
        {errors.duration_target_games ? (
          <Text style={s.error}>{errors.duration_target_games.message}</Text>
        ) : null}
      </View>

      {/* Visibilidad */}
      <View style={s.fieldWrap}>
        <Text style={s.label}>Visibilidad *</Text>
        <View style={s.visRow}>
          <Chip
            label="Pública"
            sublabel="En el listado"
            selected={visibilityValue === MATCH_VISIBILITY.PUBLIC}
            onPress={() =>
              setValue('visibility', MATCH_VISIBILITY.PUBLIC, { shouldValidate: true })
            }
          />
          <Chip
            label="Privada"
            sublabel="Con contraseña"
            selected={visibilityValue === MATCH_VISIBILITY.PRIVATE}
            onPress={() =>
              setValue('visibility', MATCH_VISIBILITY.PRIVATE, { shouldValidate: true })
            }
          />
        </View>
        {errors.visibility ? <Text style={s.error}>{errors.visibility.message}</Text> : null}
      </View>

      {/* Contraseña (solo visible cuando es privada) */}
      {visibilityValue === MATCH_VISIBILITY.PRIVATE ? (
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <Input
              label="Contraseña *"
              placeholder="Elige una contraseña para acceder"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              error={errors.password?.message}
              secureTextEntry
              showPasswordToggle
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
        />
      ) : null}

      {/* Equipos y jugadores */}
      <View style={s.fieldWrap}>
        <Text style={s.label}>Equipos y jugadores (opcional)</Text>
        <Text style={s.hint}>
          Te unirás automáticamente como jugador 1 del primer equipo. El resto puede ser por nombre
          (sin cuenta en la app).
        </Text>
        <Controller
          control={control}
          name="team_a_name"
          render={({ field }) => (
            <Input
              label="Nombre equipo A (opcional)"
              placeholder="Jugador1 - Jugador2"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.team_a_name?.message}
              autoCapitalize="words"
            />
          )}
        />
        <Controller
          control={control}
          name="team_a_player_2"
          render={({ field }) => (
            <Input
              label="Compañero (jugador 2, opcional)"
              placeholder="Nombre"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              error={errors.team_a_player_2?.message}
              autoCapitalize="words"
            />
          )}
        />
        <Controller
          control={control}
          name="team_b_name"
          render={({ field }) => (
            <Input
              label="Nombre equipo B (opcional)"
              placeholder="Jugador1 - Jugador2"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.team_b_name?.message}
              autoCapitalize="words"
            />
          )}
        />
        <Controller
          control={control}
          name="team_b_player_1"
          render={({ field }) => (
            <Input
              label="Jugador 1"
              placeholder="Nombre"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              error={errors.team_b_player_1?.message}
              autoCapitalize="words"
            />
          )}
        />
        <Controller
          control={control}
          name="team_b_player_2"
          render={({ field }) => (
            <Input
              label="Jugador 2"
              placeholder="Nombre"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              error={errors.team_b_player_2?.message}
              autoCapitalize="words"
            />
          )}
        />
      </View>

      {/* Notas */}
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <Input
            label="Notas opcionales"
            placeholder="Información para los participantes..."
            value={field.value ?? ''}
            onChangeText={field.onChange}
            error={errors.notes?.message}
            multiline
            numberOfLines={3}
            autoCapitalize="sentences"
          />
        )}
      />

      <Button
        title="Crear partida"
        onPress={handleSubmit(onSubmit, showFormFieldsMissingAlert)}
        loading={createMatch.isPending}
        style={s.submitBtn}
      />
    </KeyboardAwareScrollView>
  )
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

import { Pressable } from 'react-native'

interface ChipProps {
  label: string
  sublabel?: string
  selected: boolean
  onPress: () => void
}

function Chip({ label, sublabel, selected, onPress }: ChipProps) {
  return (
    <Pressable
      style={[chip.base, selected && chip.selected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <Text style={[chip.label, selected && chip.labelSelected]}>{label}</Text>
      {sublabel ? (
        <Text style={[chip.sublabel, selected && chip.sublabelSelected]}>{sublabel}</Text>
      ) : null}
    </Pressable>
  )
}

const chip = StyleSheet.create({
  base: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  selected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.wonBackground,
  },
  label: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  labelSelected: { color: Colors.primary },
  sublabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  sublabelSelected: { color: Colors.primary },
})

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 20, paddingBottom: 40 },
  heading: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  fieldWrap: { marginBottom: 20 },
  label: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    marginBottom: 8,
    color: Colors.textPrimary,
  },
  durationRow: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  visRow: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  rowText: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 16, color: Colors.textPrimary, fontFamily: Fonts.medium },
  rowHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  hint: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12, lineHeight: 18 },
  teamLabel: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    marginBottom: 8,
    marginTop: 4,
  },
  error: { color: Colors.danger, fontSize: 13, marginTop: 4 },
  submitBtn: { marginTop: 8 },
})
