import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  Pressable,
} from 'react-native'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { Input } from '@/components/ui/Input'
import { MunicipalityPicker } from '@/components/ui/MunicipalityPicker'
import { useMatch, useUpdateMatch } from '@/hooks/useMatches'
import { MATCH_VISIBILITY } from '@/constants'

// ─── Schema (same as create) ──────────────────────────────────────────────────

const editMatchSchema = z.object({
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
})

type EditMatchValues = z.infer<typeof editMatchSchema>

// ─── Chip ─────────────────────────────────────────────────────────────────────

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
  selected: { borderColor: '#1a5f4a', backgroundColor: '#eef7f3' },
  label: { fontSize: 15, fontWeight: '600', color: '#666' },
  labelSelected: { color: '#1a5f4a' },
  sublabel: { fontSize: 11, color: '#999', marginTop: 2, textAlign: 'center' },
  sublabelSelected: { color: '#2a8f6f' },
})

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const { data: match, isLoading } = useMatch(id)
  const updateMatch = useUpdateMatch()

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<EditMatchValues>({
    resolver: zodResolver(editMatchSchema),
    defaultValues: {
      title: '',
      description: '',
      start_at: '',
      city: '',
      place_defined: true,
      place_text: '',
      duration_target_games: 3,
      visibility: MATCH_VISIBILITY.PUBLIC,
    },
  })

  // Pre-populate form with existing match data
  useEffect(() => {
    if (match) {
      reset({
        title: match.title,
        description: match.description ?? '',
        start_at: match.start_at,
        city: match.city,
        place_defined: match.place_defined,
        place_text: match.place_text ?? '',
        duration_target_games: match.duration_target_games,
        visibility: match.visibility as
          | typeof MATCH_VISIBILITY.PUBLIC
          | typeof MATCH_VISIBILITY.LINK,
      })
    }
  }, [match, reset])

  const placeDefined = watch('place_defined')
  const durationValue = watch('duration_target_games')
  const visibilityValue = watch('visibility')

  const onSubmit = async (values: EditMatchValues) => {
    try {
      await updateMatch.mutateAsync({
        id,
        data: {
          title: values.title,
          description: values.description || null,
          start_at: values.start_at,
          city: values.city,
          place_defined: values.place_defined,
          place_text: values.place_defined ? values.place_text || null : null,
          duration_target_games: values.duration_target_games,
          visibility: values.visibility,
        },
      })
      router.back()
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar la partida')
    }
  }

  if (isLoading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.container}
      keyboardShouldPersistTaps="handled">
      <Text style={s.heading}>Editar partida</Text>

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
              setValue('visibility', MATCH_VISIBILITY.PUBLIC, {
                shouldValidate: true,
              })
            }
          />
          <Chip
            label="Con enlace"
            sublabel="Solo accesible con el link"
            selected={visibilityValue === MATCH_VISIBILITY.LINK}
            onPress={() =>
              setValue('visibility', MATCH_VISIBILITY.LINK, {
                shouldValidate: true,
              })
            }
          />
        </View>
        {errors.visibility ? <Text style={s.error}>{errors.visibility.message}</Text> : null}
      </View>

      <Button
        title="Guardar cambios"
        onPress={handleSubmit(onSubmit)}
        loading={updateMatch.isPending}
        disabled={!isDirty}
        style={s.submitBtn}
      />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, backgroundColor: '#f6f7f4' },
  container: { padding: 20, paddingBottom: 40 },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  fieldWrap: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#1a1a1a' },
  durationRow: { flexDirection: 'row', marginHorizontal: -4 },
  visRow: { flexDirection: 'row', marginHorizontal: -4 },
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
  error: { color: '#b00020', fontSize: 13, marginTop: 4 },
  submitBtn: { marginTop: 8 },
})
