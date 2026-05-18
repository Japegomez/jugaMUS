import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { dateToLocalIsoString } from '@/components/ui/dateTimePickerUtils'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { Input } from '@/components/ui/Input'
import { MunicipalityPicker } from '@/components/ui/MunicipalityPicker'
import { useCreateMatch } from '@/hooks/useMatches'
import { DEFAULT_TEAM_A_NAME, DEFAULT_TEAM_B_NAME, MATCH_VISIBILITY } from '@/constants'

// ─── Schema ───────────────────────────────────────────────────────────────────

const createMatchSchema = z.object({
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
  place_defined: z.boolean(),
  place_text: z
    .string()
    .trim()
    .max(150, 'Texto de lugar demasiado largo')
    .optional()
    .or(z.literal('')),
  duration_target_games: z.number().int().min(1).max(6),
  visibility: z.enum([MATCH_VISIBILITY.PUBLIC, MATCH_VISIBILITY.LINK]),
  notes: z.string().trim().max(300, 'Notas demasiado largas').optional().or(z.literal('')),
  team_a_name: z
    .string()
    .trim()
    .min(1, 'Nombre del equipo requerido')
    .max(40, 'Nombre demasiado largo'),
  team_b_name: z
    .string()
    .trim()
    .min(1, 'Nombre del equipo requerido')
    .max(40, 'Nombre demasiado largo'),
  team_a_player_2: z.string().trim().max(80, 'Nombre demasiado largo').optional().or(z.literal('')),
  team_b_player_1: z.string().trim().max(80, 'Nombre demasiado largo').optional().or(z.literal('')),
  team_b_player_2: z.string().trim().max(80, 'Nombre demasiado largo').optional().or(z.literal('')),
})

type CreateMatchValues = z.infer<typeof createMatchSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultStartAt() {
  const d = new Date()
  d.setHours(d.getHours() + 2, 0, 0, 0)
  return dateToLocalIsoString(d)
}

function textPlayerOrNull(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreateMatchScreen() {
  const router = useRouter()
  const createMatch = useCreateMatch()

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateMatchValues>({
    resolver: zodResolver(createMatchSchema),
    defaultValues: {
      title: '',
      description: '',
      start_at: defaultStartAt(),
      city: '',
      place_defined: true,
      place_text: '',
      duration_target_games: 3,
      visibility: MATCH_VISIBILITY.PUBLIC,
      notes: '',
      team_a_name: DEFAULT_TEAM_A_NAME,
      team_b_name: DEFAULT_TEAM_B_NAME,
      team_a_player_2: '',
      team_b_player_1: '',
      team_b_player_2: '',
    },
  })

  const placeDefined = watch('place_defined')
  const durationValue = watch('duration_target_games')
  const visibilityValue = watch('visibility')

  const onSubmit = async (values: CreateMatchValues) => {
    try {
      const match = await createMatch.mutateAsync({
        title: values.title,
        description: values.description || null,
        start_at: values.start_at,
        city: values.city,
        place_defined: values.place_defined,
        place_text: values.place_defined ? values.place_text || null : null,
        duration_target_games: values.duration_target_games,
        visibility: values.visibility,
        location_privacy: 'participants_only',
        team_a_name: values.team_a_name.trim(),
        team_b_name: values.team_b_name.trim(),
        team_a_player_1: null,
        team_a_player_2: textPlayerOrNull(values.team_a_player_2),
        team_b_player_1: textPlayerOrNull(values.team_b_player_1),
        team_b_player_2: textPlayerOrNull(values.team_b_player_2),
      })
      router.replace(`/(tabs)/matches/${match.id}`)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo crear la partida')
    }
  }

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.container}
      keyboardShouldPersistTaps="handled">
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
            minDate={new Date()}
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
              onValueChange={(v) => field.onChange(!v)}
              trackColor={{ true: '#1a5f4a', false: '#ccc' }}
              thumbColor="#fff"
            />
          )}
        />
      </View>

      {/* Lugar (texto) */}
      {placeDefined ? (
        <Controller
          control={control}
          name="place_text"
          render={({ field }) => (
            <Input
              label="Lugar"
              placeholder="Ej. Bar El Rincón, Mesa del fondo"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              error={errors.place_text?.message}
              autoCapitalize="sentences"
            />
          )}
        />
      ) : null}

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
            sublabel="Aparece en el listado"
            selected={visibilityValue === MATCH_VISIBILITY.PUBLIC}
            onPress={() =>
              setValue('visibility', MATCH_VISIBILITY.PUBLIC, { shouldValidate: true })
            }
          />
          <Chip
            label="Con enlace"
            sublabel="Solo accesible con el link"
            selected={visibilityValue === MATCH_VISIBILITY.LINK}
            onPress={() => setValue('visibility', MATCH_VISIBILITY.LINK, { shouldValidate: true })}
          />
        </View>
        {errors.visibility ? <Text style={s.error}>{errors.visibility.message}</Text> : null}
      </View>

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
              label="Nombre equipo A"
              placeholder={DEFAULT_TEAM_A_NAME}
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
              label="Nombre equipo B"
              placeholder={DEFAULT_TEAM_B_NAME}
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
        onPress={handleSubmit(onSubmit)}
        loading={createMatch.isPending}
        style={s.submitBtn}
      />
    </ScrollView>
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
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  selected: {
    borderColor: '#1a5f4a',
    backgroundColor: '#eef7f3',
  },
  label: { fontSize: 15, fontWeight: '600', color: '#666' },
  labelSelected: { color: '#1a5f4a' },
  sublabel: { fontSize: 11, color: '#999', marginTop: 2, textAlign: 'center' },
  sublabelSelected: { color: '#2a8f6f' },
})

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f6f7f4' },
  container: { padding: 20, paddingBottom: 40 },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  fieldWrap: { marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1a1a1a',
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
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  rowText: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 16, color: '#1a1a1a', fontWeight: '500' },
  rowHint: { fontSize: 12, color: '#888', marginTop: 2 },
  hint: { fontSize: 13, color: '#666', marginBottom: 12, lineHeight: 18 },
  teamLabel: { fontSize: 14, fontWeight: '700', color: '#1a5f4a', marginBottom: 8, marginTop: 4 },
  error: { color: '#b00020', fontSize: 13, marginTop: 4 },
  submitBtn: { marginTop: 8 },
})
