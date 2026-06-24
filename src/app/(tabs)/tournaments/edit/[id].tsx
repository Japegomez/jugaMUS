import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { Input } from '@/components/ui/Input'
import { MunicipalityPicker } from '@/components/ui/MunicipalityPicker'
import { MATCH_VISIBILITY, TOURNAMENT_STATUS } from '@/constants'
import { useTournament, useUpdateTournament } from '@/hooks/useTournaments'
import { placeFormFields, refinePlaceRequired, placePayload } from '@/utils/placeForm'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'

const schema = z
  .object({
    title: z.string().trim().min(3).max(80),
    description: z.string().trim().max(300).optional().or(z.literal('')),
    start_at: z.string().min(1),
    city: z.string().trim().min(1),
    ...placeFormFields,
    duration_target_games: z.number().int().min(1).max(6),
    visibility: z.enum([MATCH_VISIBILITY.PUBLIC, MATCH_VISIBILITY.LINK, MATCH_VISIBILITY.PRIVATE]),
    password: z.string().max(100).optional().or(z.literal('')),
    notes: z.string().trim().max(300).optional().or(z.literal('')),
  })
  .superRefine(refinePlaceRequired)

type FormValues = z.infer<typeof schema>

export default function EditTournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data: tournament, isLoading } = useTournament(id)
  const updateTournament = useUpdateTournament()

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: tournament
      ? {
          title: tournament.title,
          description: tournament.description ?? '',
          start_at: tournament.start_at,
          city: tournament.city,
          place_defined: tournament.place_defined,
          place_text: tournament.place_text ?? '',
          duration_target_games: tournament.duration_target_games,
          visibility: tournament.visibility as
            | typeof MATCH_VISIBILITY.PUBLIC
            | typeof MATCH_VISIBILITY.LINK
            | typeof MATCH_VISIBILITY.PRIVATE,
          password: '',
          notes: tournament.notes ?? '',
        }
      : undefined,
  })

  const placeDefined = watch('place_defined')
  const durationValue = watch('duration_target_games')
  const visibilityValue = watch('visibility')

  const closeToTournament = () => {
    if (!id) {
      router.back()
      return
    }
    router.replace(`/(tabs)/tournaments/${id}` as Href)
  }

  if (isLoading || !tournament) {
    return (
      <View style={[s.centered, { paddingTop: screenTopPadding(insets.top, 8) }]}>
        <View style={s.closeBar}>
          <View style={s.closeBarSpacer} />
          <Pressable
            onPress={closeToTournament}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar edición">
            <Text style={s.closeX}>✕</Text>
          </Pressable>
        </View>
        <Text>Cargando…</Text>
      </View>
    )
  }

  if (tournament.status !== TOURNAMENT_STATUS.REGISTRATION) {
    return (
      <View style={[s.centered, { paddingTop: screenTopPadding(insets.top, 8) }]}>
        <View style={s.closeBar}>
          <View style={s.closeBarSpacer} />
          <Pressable
            onPress={closeToTournament}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar edición">
            <Text style={s.closeX}>✕</Text>
          </Pressable>
        </View>
        <Text style={s.error}>Solo se puede editar antes de organizar el cuadro.</Text>
        <Button title="Volver" onPress={closeToTournament} style={{ marginTop: 16 }} />
      </View>
    )
  }

  const onSubmit = async (values: FormValues) => {
    const isBecomingPrivate =
      values.visibility === MATCH_VISIBILITY.PRIVATE &&
      tournament.visibility !== MATCH_VISIBILITY.PRIVATE
    if (isBecomingPrivate && !values.password?.trim()) {
      Alert.alert('Contraseña requerida', 'Introduce una contraseña para el torneo privado.')
      return
    }

    try {
      await updateTournament.mutateAsync({
        id,
        data: {
          title: values.title,
          description: values.description || null,
          notes: values.notes || null,
          start_at: values.start_at,
          city: values.city,
          ...placePayload(values),
          duration_target_games: values.duration_target_games,
          visibility: values.visibility,
        },
        password: values.visibility === MATCH_VISIBILITY.PRIVATE ? values.password : undefined,
      })
      closeToTournament()
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar')
    }
  }

  return (
    <KeyboardAwareScrollView
      style={s.scroll}
      contentContainerStyle={[s.container, { paddingTop: screenTopPadding(insets.top, 8) }]}>
      <View style={s.closeBar}>
        <View style={s.closeBarSpacer} />
        <Pressable
          onPress={closeToTournament}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar edición">
          <Text style={s.closeX}>✕</Text>
        </Pressable>
      </View>
      <Text style={s.heading}>Editar torneo</Text>
      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <Input
            label="Título *"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.title?.message}
            autoCapitalize="sentences"
          />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <Input
            label="Descripción"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            multiline
            numberOfLines={3}
            autoCapitalize="sentences"
          />
        )}
      />
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
      <Controller
        control={control}
        name="city"
        render={({ field }) => (
          <MunicipalityPicker
            label="Ciudad *"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.city?.message}
          />
        )}
      />
      {placeDefined ? (
        <Controller
          control={control}
          name="place_text"
          render={({ field }) => (
            <Input
              label="Lugar *"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              error={errors.place_text?.message}
              autoCapitalize="sentences"
            />
          )}
        />
      ) : null}
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
            />
          )}
        />
      </View>
      <View style={s.fieldWrap}>
        <Text style={s.label}>Duración (juegos)</Text>
        <View style={s.chips}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Pressable
              key={n}
              style={[s.chip, durationValue === n && s.chipOn]}
              onPress={() => setValue('duration_target_games', n)}>
              <Text style={[s.chipText, durationValue === n && s.chipTextOn]}>{n}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={s.fieldWrap}>
        <Text style={s.label}>Visibilidad</Text>
        <View style={s.chips}>
          <Pressable
            style={[s.chip, visibilityValue === MATCH_VISIBILITY.PUBLIC && s.chipOn]}
            onPress={() =>
              setValue('visibility', MATCH_VISIBILITY.PUBLIC, { shouldValidate: true })
            }>
            <Text style={[s.chipText, visibilityValue === MATCH_VISIBILITY.PUBLIC && s.chipTextOn]}>
              Pública
            </Text>
          </Pressable>
          <Pressable
            style={[s.chip, visibilityValue === MATCH_VISIBILITY.PRIVATE && s.chipOn]}
            onPress={() =>
              setValue('visibility', MATCH_VISIBILITY.PRIVATE, { shouldValidate: true })
            }>
            <Text
              style={[s.chipText, visibilityValue === MATCH_VISIBILITY.PRIVATE && s.chipTextOn]}>
              Privada
            </Text>
          </Pressable>
        </View>
      </View>
      {visibilityValue === MATCH_VISIBILITY.PRIVATE ? (
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <Input
              label={
                tournament.visibility === MATCH_VISIBILITY.PRIVATE
                  ? 'Nueva contraseña (deja vacío para mantener la actual)'
                  : 'Contraseña *'
              }
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
      <Button
        title="Guardar cambios"
        onPress={handleSubmit(onSubmit)}
        loading={updateTournament.isPending}
      />
    </KeyboardAwareScrollView>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  closeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginHorizontal: -4,
  },
  closeBarSpacer: { flex: 1 },
  closeX: { fontSize: 22, color: Colors.textSecondary, padding: 8 },
  error: { color: Colors.textSecondary, textAlign: 'center' },
  heading: { fontSize: 22, fontFamily: Fonts.bold, marginBottom: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 10,
  },
  rowText: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 15, fontFamily: Fonts.medium },
  rowHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 14, fontFamily: Fonts.semiBold, marginBottom: 8 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipOn: { borderColor: Colors.primary, backgroundColor: Colors.wonBackground },
  chipText: { color: Colors.textSecondary },
  chipTextOn: { color: Colors.primary, fontFamily: Fonts.semiBold },
})
