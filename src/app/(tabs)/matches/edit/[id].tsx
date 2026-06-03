import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View, Pressable } from 'react-native'
import { z } from 'zod'

import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/ui/Button'
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { Input } from '@/components/ui/Input'
import { MunicipalityPicker } from '@/components/ui/MunicipalityPicker'
import { useMatch, useUpdateMatch } from '@/hooks/useMatches'
import { MATCH_VISIBILITY, TEAM } from '@/constants'
import {
  editableTextSlotsForTeam,
  freeTeamSlots,
  isUnspecifiedTeamName,
  validateTextRosterCapacity,
} from '@/services/matches.service'
import { placeFormFields, refinePlaceRequired, placePayload } from '@/utils/placeForm'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'

// ─── Schema (same as create) ──────────────────────────────────────────────────

const editMatchSchema = z
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
    visibility: z.enum([MATCH_VISIBILITY.PUBLIC, MATCH_VISIBILITY.LINK]),
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

function textPlayerOrNull(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function textPlayerForUpdate(
  key: 'team_a_player_2' | 'team_b_player_1' | 'team_b_player_2',
  editable: readonly ('team_a_player_2' | 'team_b_player_1' | 'team_b_player_2')[],
  formValue: string | undefined,
  existing: string | null | undefined
): string | null {
  if (!editable.includes(key)) {
    return existing ?? null
  }
  return textPlayerOrNull(formValue)
}

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
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  selected: { borderColor: Colors.primary, backgroundColor: Colors.wonBackground },
  label: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  labelSelected: { color: Colors.primary },
  sublabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  sublabelSelected: { color: Colors.primary },
})

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()

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
      team_a_name: '',
      team_b_name: '',
      team_a_player_2: '',
      team_b_player_1: '',
      team_b_player_2: '',
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
        team_a_name: isUnspecifiedTeamName(match.team_a_name, TEAM.A) ? '' : match.team_a_name,
        team_b_name: isUnspecifiedTeamName(match.team_b_name, TEAM.B) ? '' : match.team_b_name,
        team_a_player_2: match.team_a_player_2 ?? '',
        team_b_player_1: match.team_b_player_1 ?? '',
        team_b_player_2: match.team_b_player_2 ?? '',
      })
    }
  }, [match, reset])

  const placeDefined = watch('place_defined')
  const durationValue = watch('duration_target_games')
  const visibilityValue = watch('visibility')
  const teamAPlayer2 = watch('team_a_player_2')
  const teamBPlayer1 = watch('team_b_player_1')
  const teamBPlayer2 = watch('team_b_player_2')

  const rosterTextDraft = useMemo(
    () => ({
      team_a_player_1: match?.team_a_player_1 ?? null,
      team_a_player_2: teamAPlayer2 || null,
      team_b_player_1: teamBPlayer1 || null,
      team_b_player_2: teamBPlayer2 || null,
    }),
    [match?.team_a_player_1, teamAPlayer2, teamBPlayer1, teamBPlayer2]
  )

  const editableA = match
    ? editableTextSlotsForTeam(match.participants, TEAM.A, rosterTextDraft)
    : []
  const editableB = match
    ? editableTextSlotsForTeam(match.participants, TEAM.B, rosterTextDraft)
    : []

  const teamAFull = match ? freeTeamSlots(rosterTextDraft, match.participants, TEAM.A) === 0 : false
  const teamBFull = match ? freeTeamSlots(rosterTextDraft, match.participants, TEAM.B) === 0 : false

  const onSubmit = async (values: EditMatchValues) => {
    if (!match) return

    const textFields = {
      team_a_player_1: match.team_a_player_1,
      team_a_player_2: textPlayerOrNull(values.team_a_player_2),
      team_b_player_1: textPlayerOrNull(values.team_b_player_1),
      team_b_player_2: textPlayerOrNull(values.team_b_player_2),
    }
    const rosterError = validateTextRosterCapacity(match.participants, textFields, match)
    if (rosterError) {
      Alert.alert('Plantilla completa', rosterError)
      return
    }

    try {
      await updateMatch.mutateAsync({
        id,
        data: {
          title: values.title,
          description: values.description || null,
          start_at: values.start_at,
          city: values.city,
          ...placePayload(values),
          duration_target_games: values.duration_target_games,
          visibility: values.visibility,
          team_a_name: (values.team_a_name ?? '').trim(),
          team_b_name: (values.team_b_name ?? '').trim(),
          team_a_player_1: null,
          team_a_player_2: textPlayerForUpdate(
            'team_a_player_2',
            editableA,
            values.team_a_player_2,
            match.team_a_player_2
          ),
          team_b_player_1: textPlayerForUpdate(
            'team_b_player_1',
            editableB,
            values.team_b_player_1,
            match.team_b_player_1
          ),
          team_b_player_2: textPlayerForUpdate(
            'team_b_player_2',
            editableB,
            values.team_b_player_2,
            match.team_b_player_2
          ),
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
    <KeyboardAwareScrollView style={s.scroll} contentContainerStyle={s.container}>
      <View style={[s.closeBar, { paddingTop: screenTopPadding(insets.top, 8) }]}>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar">
          <Text style={s.closeX}>✕</Text>
        </Pressable>
      </View>

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

      <View style={s.fieldWrap}>
        <Text style={s.label}>Equipos y jugadores (opcional)</Text>
        <Text style={s.hint}>
          Si dejas el nombre del equipo vacío, se usará «Jugador1 - Jugador2» con los nombres de la
          plantilla.
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
        {teamAFull && !editableA.includes('team_a_player_2') ? (
          <Text style={s.rosterNote}>Compañero: cubierto por jugadores con cuenta en la app.</Text>
        ) : editableA.includes('team_a_player_2') ? (
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
        ) : null}
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
        {teamBFull && editableB.length === 0 ? (
          <Text style={s.rosterNote}>
            Rivales: plantilla completa (cuenta en la app y/o nombres).
          </Text>
        ) : null}
        {editableB.includes('team_b_player_1') ? (
          <Controller
            control={control}
            name="team_b_player_1"
            render={({ field }) => (
              <Input
                label="Jugador 1 (nombre)"
                placeholder="Nombre"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                error={errors.team_b_player_1?.message}
                autoCapitalize="words"
              />
            )}
          />
        ) : null}
        {editableB.includes('team_b_player_2') ? (
          <Controller
            control={control}
            name="team_b_player_2"
            render={({ field }) => (
              <Input
                label="Jugador 2 (nombre)"
                placeholder="Nombre"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                error={errors.team_b_player_2?.message}
                autoCapitalize="words"
              />
            )}
          />
        ) : null}
      </View>

      <Button
        title="Guardar cambios"
        onPress={handleSubmit(onSubmit)}
        loading={updateMatch.isPending}
        disabled={!isDirty}
        style={s.submitBtn}
      />
    </KeyboardAwareScrollView>
  )
}

const s = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 20, paddingBottom: 40 },
  closeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginHorizontal: -4,
  },
  closeX: { fontSize: 22, color: Colors.textSecondary, padding: 8 },
  heading: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  fieldWrap: { marginBottom: 20 },
  label: { fontSize: 14, fontFamily: Fonts.semiBold, marginBottom: 8, color: Colors.textPrimary },
  durationRow: { flexDirection: 'row', marginHorizontal: -4 },
  visRow: { flexDirection: 'row', marginHorizontal: -4 },
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
  rosterNote: { fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic', marginBottom: 12 },
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
