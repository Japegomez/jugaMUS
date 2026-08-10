import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { Input } from '@/components/ui/Input'
import { MunicipalityPicker } from '@/components/ui/MunicipalityPicker'
import {
  LEAGUE_FORMAT,
  LEAGUE_FORMAT_LABELS,
  LEAGUE_STATUS,
  MATCH_VISIBILITY,
  type LeagueFormat,
} from '@/constants'
import { useLeague, useUpdateLeague } from '@/hooks/useLeagues'
import { DEFAULT_LEAGUE_CITY, DEFAULT_LEAGUE_TITLE, leaguePlacePayload } from '@/utils/leagueForm'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'

const schema = z
  .object({
    title: z.string().trim().max(80).optional().or(z.literal('')),
    description: z.string().trim().max(300).optional().or(z.literal('')),
    start_at: z.string().min(1),
    end_at: z.string().optional().or(z.literal('')),
    city: z.string().trim().max(120).optional().or(z.literal('')),
    place_text: z.string().trim().max(150).optional().or(z.literal('')),
    duration_target_games: z.number().int().min(1).max(6),
    format: z.enum([
      LEAGUE_FORMAT.SINGLE_ROUND,
      LEAGUE_FORMAT.DOUBLE_ROUND,
      LEAGUE_FORMAT.OPEN_ELO,
    ]),
    visibility: z.enum([MATCH_VISIBILITY.PUBLIC, MATCH_VISIBILITY.LINK, MATCH_VISIBILITY.PRIVATE]),
    password: z.string().max(100).optional().or(z.literal('')),
    notes: z.string().trim().max(300).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.format === LEAGUE_FORMAT.OPEN_ELO) {
      if (!data.end_at?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La liga abierta requiere fecha de fin',
          path: ['end_at'],
        })
      } else if (new Date(data.end_at).getTime() <= new Date(data.start_at).getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La fecha de fin debe ser posterior al inicio',
          path: ['end_at'],
        })
      }
    }
  })

type FormValues = z.infer<typeof schema>

export default function EditLeagueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data: league, isLoading } = useLeague(id)
  const updateLeague = useUpdateLeague()

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: league
      ? {
          title: league.title,
          description: league.description ?? '',
          start_at: league.start_at,
          end_at: league.end_at ?? '',
          city: league.city,
          place_text: league.place_defined ? (league.place_text ?? '') : '',
          duration_target_games: league.duration_target_games,
          format: league.format as LeagueFormat,
          visibility: league.visibility as
            | typeof MATCH_VISIBILITY.PUBLIC
            | typeof MATCH_VISIBILITY.LINK
            | typeof MATCH_VISIBILITY.PRIVATE,
          password: '',
          notes: league.notes ?? '',
        }
      : undefined,
  })

  const durationValue = watch('duration_target_games')
  const visibilityValue = watch('visibility')
  const formatValue = watch('format')

  if (isLoading || !league) {
    return (
      <View style={[s.centered, { paddingTop: screenTopPadding(insets.top, 8) }]}>
        <Text style={s.meta}>Cargando…</Text>
      </View>
    )
  }

  if (league.status !== LEAGUE_STATUS.REGISTRATION) {
    return (
      <View style={[s.centered, { paddingTop: screenTopPadding(insets.top, 8) }]}>
        <Text style={s.meta}>Solo se puede editar durante la inscripción.</Text>
        <Button title="Volver" onPress={() => router.replace(`/(tabs)/leagues/${id}` as Href)} />
      </View>
    )
  }

  const onSubmit = async (values: FormValues) => {
    try {
      await updateLeague.mutateAsync({
        id,
        data: {
          title: values.title?.trim() || DEFAULT_LEAGUE_TITLE,
          description: values.description || null,
          notes: values.notes || null,
          start_at: values.start_at,
          end_at:
            values.format === LEAGUE_FORMAT.OPEN_ELO
              ? values.end_at || null
              : values.end_at?.trim()
                ? values.end_at
                : null,
          city: values.city?.trim() || DEFAULT_LEAGUE_CITY,
          ...leaguePlacePayload(values.place_text),
          duration_target_games: values.duration_target_games,
          visibility: values.visibility,
          format: values.format,
        },
        password:
          values.visibility === MATCH_VISIBILITY.PRIVATE && values.password?.trim()
            ? values.password
            : undefined,
      })
      router.replace(`/(tabs)/leagues/${id}` as Href)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar')
    }
  }

  return (
    <KeyboardAwareScrollView
      style={s.scroll}
      contentContainerStyle={[s.container, { paddingTop: screenTopPadding(insets.top, 8) }]}>
      <View style={s.closeBar}>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => router.replace(`/(tabs)/leagues/${id}` as Href)}
          accessibilityRole="button">
          <Text style={s.closeX}>✕</Text>
        </Pressable>
      </View>
      <Text style={s.heading}>Editar liga</Text>

      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <Input label="Título" value={field.value ?? ''} onChangeText={field.onChange} />
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
          />
        )}
      />

      <Text style={s.label}>Formato</Text>
      <View style={s.chipRow}>
        {(Object.keys(LEAGUE_FORMAT_LABELS) as LeagueFormat[]).map((fmt) => (
          <Pressable
            key={fmt}
            style={[s.chip, formatValue === fmt && s.chipSelected]}
            onPress={() => setValue('format', fmt, { shouldValidate: true })}>
            <Text style={[s.chipText, formatValue === fmt && s.chipTextSelected]}>
              {LEAGUE_FORMAT_LABELS[fmt]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Controller
        control={control}
        name="start_at"
        render={({ field }) => (
          <DateTimePicker label="Inicio" value={field.value} onChange={field.onChange} />
        )}
      />
      {formatValue === LEAGUE_FORMAT.OPEN_ELO ? (
        <Controller
          control={control}
          name="end_at"
          render={({ field }) => (
            <DateTimePicker
              label="Fin (obligatorio)"
              value={field.value || league.end_at || ''}
              onChange={field.onChange}
              error={errors.end_at?.message}
            />
          )}
        />
      ) : null}
      <Controller
        control={control}
        name="city"
        render={({ field }) => (
          <MunicipalityPicker
            label="Ciudad"
            value={field.value ?? ''}
            onChangeText={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="place_text"
        render={({ field }) => (
          <Input label="Lugar" value={field.value ?? ''} onChangeText={field.onChange} />
        )}
      />

      <Text style={s.label}>Juegos a ganar</Text>
      <View style={s.chipRow}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <Pressable
            key={n}
            style={[s.chip, durationValue === n && s.chipSelected]}
            onPress={() => setValue('duration_target_games', n)}>
            <Text style={[s.chipText, durationValue === n && s.chipTextSelected]}>{n}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Visibilidad</Text>
      <View style={s.chipRow}>
        <Pressable
          style={[s.chip, visibilityValue === MATCH_VISIBILITY.PUBLIC && s.chipSelected]}
          onPress={() => setValue('visibility', MATCH_VISIBILITY.PUBLIC)}>
          <Text
            style={[
              s.chipText,
              visibilityValue === MATCH_VISIBILITY.PUBLIC && s.chipTextSelected,
            ]}>
            Pública
          </Text>
        </Pressable>
        <Pressable
          style={[s.chip, visibilityValue === MATCH_VISIBILITY.PRIVATE && s.chipSelected]}
          onPress={() => setValue('visibility', MATCH_VISIBILITY.PRIVATE)}>
          <Text
            style={[
              s.chipText,
              visibilityValue === MATCH_VISIBILITY.PRIVATE && s.chipTextSelected,
            ]}>
            Privada
          </Text>
        </Pressable>
      </View>
      {visibilityValue === MATCH_VISIBILITY.PRIVATE ? (
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <Input
              label="Nueva contraseña (opcional)"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              secureTextEntry
            />
          )}
        />
      ) : null}

      <Button
        title="Guardar"
        onPress={handleSubmit(onSubmit)}
        loading={updateLeague.isPending}
      />
    </KeyboardAwareScrollView>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, paddingBottom: 48, gap: 12 },
  centered: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  closeBar: { flexDirection: 'row' },
  closeX: { fontSize: 22, color: Colors.textSecondary, padding: 4 },
  heading: { fontSize: 22, fontFamily: Fonts.bold, color: Colors.textPrimary },
  meta: { color: Colors.textSecondary },
  label: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipSelected: { borderColor: Colors.primary },
  chipText: { color: Colors.textPrimary, fontFamily: Fonts.medium },
  chipTextSelected: { color: Colors.primary },
})
