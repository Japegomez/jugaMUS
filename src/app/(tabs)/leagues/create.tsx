import { zodResolver } from '@hookform/resolvers/zod'
import { useFocusEffect } from '@react-navigation/native'
import { useRouter, type Href } from 'expo-router'
import { useCallback, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'

import {
  AddLeaguePairModal,
  type AddLeaguePairFormValues,
} from '@/components/leagues/AddLeaguePairModal'
import {
  EditLeaguePairModal,
  type EditLeaguePairFormValues,
} from '@/components/leagues/EditLeaguePairModal'
import { LeaguePairCard } from '@/components/leagues/LeaguePairCard'
import { AddPairButton } from '@/components/ui/AddPairButton'
import { Button } from '@/components/ui/Button'
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView'
import { dateToLocalIsoString } from '@/components/ui/dateTimePickerUtils'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { Input } from '@/components/ui/Input'
import { MunicipalityPicker } from '@/components/ui/MunicipalityPicker'
import {
  LEAGUE_FORMAT,
  LEAGUE_FORMAT_LABELS,
  MATCH_VISIBILITY,
  type LeagueFormat,
} from '@/constants'
import { useAuthStore } from '@/hooks/useAuth'
import {
  useAddLeaguePair,
  useCreateLeague,
  useRemoveLeaguePair,
  useUpdateLeaguePair,
} from '@/hooks/useLeagues'
import { isLeaguePairComplete, type LeaguePairRow } from '@/services/leagues.service'
import { acknowledgeAlert, confirmAlert, showAlert } from '@/utils/alert'
import { showFormFieldsMissingAlert } from '@/utils/formValidation'
import {
  AUTO_START_LEAGUE_ALERT,
  DEFAULT_LEAGUE_CITY,
  DEFAULT_LEAGUE_TITLE,
  leaguePlacePayload,
} from '@/utils/leagueForm'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'

const schema = z
  .object({
    title: z.string().trim().max(80, 'El título es demasiado largo').optional().or(z.literal('')),
    description: z.string().trim().max(300).optional().or(z.literal('')),
    start_at: z.string().min(1, 'Selecciona fecha y hora de inicio'),
    end_at: z.string().optional().or(z.literal('')),
    city: z
      .string()
      .trim()
      .max(120, 'Nombre de ciudad demasiado largo')
      .optional()
      .or(z.literal('')),
    place_text: z
      .string()
      .trim()
      .max(150, 'Texto de lugar demasiado largo')
      .optional()
      .or(z.literal('')),
    duration_target_games: z.number().int().min(1).max(6),
    format: z.enum([
      LEAGUE_FORMAT.SINGLE_ROUND,
      LEAGUE_FORMAT.DOUBLE_ROUND,
      LEAGUE_FORMAT.OPEN_ELO,
    ]),
    visibility: z.enum([MATCH_VISIBILITY.PUBLIC, MATCH_VISIBILITY.LINK, MATCH_VISIBILITY.PRIVATE]),
    password: z.string().max(100, 'Contraseña demasiado larga').optional().or(z.literal('')),
    notes: z.string().trim().max(300).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.visibility === MATCH_VISIBILITY.PRIVATE && !data.password?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Introduce una contraseña para la liga privada',
        path: ['password'],
      })
    }
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

function defaultStartAt() {
  const d = new Date()
  d.setHours(d.getHours() + 2, 0, 0, 0)
  return dateToLocalIsoString(d)
}

function defaultEndAt() {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  d.setHours(23, 0, 0, 0)
  return dateToLocalIsoString(d)
}

function createDefaultFormValues(): FormValues {
  return {
    title: '',
    description: '',
    start_at: defaultStartAt(),
    end_at: defaultEndAt(),
    city: '',
    place_text: '',
    duration_target_games: 3,
    format: LEAGUE_FORMAT.SINGLE_ROUND,
    visibility: MATCH_VISIBILITY.PUBLIC,
    password: '',
    notes: '',
  }
}

function Chip({
  label,
  sublabel,
  selected,
  onPress,
}: {
  label: string
  sublabel?: string
  selected: boolean
  onPress: () => void
}) {
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

export default function CreateLeagueScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const userId = useAuthStore((s) => s.session?.user.id)
  const createLeague = useCreateLeague()
  const addPair = useAddLeaguePair()
  const updatePair = useUpdateLeaguePair()
  const removePair = useRemoveLeaguePair()

  const [step, setStep] = useState<1 | 2>(1)
  const [leagueId, setLeagueId] = useState<string | null>(null)
  const [pairs, setPairs] = useState<LeaguePairRow[]>([])
  const [pairModalOpen, setPairModalOpen] = useState(false)
  const [editingPair, setEditingPair] = useState<LeaguePairRow | null>(null)

  const userAlreadyInPair = Boolean(
    userId && pairs.some((p) => p.player_a_user_id === userId || p.player_b_user_id === userId)
  )

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: createDefaultFormValues(),
  })

  useFocusEffect(
    useCallback(() => {
      return () => {
        setStep(1)
        setLeagueId(null)
        setPairs([])
        setPairModalOpen(false)
        setEditingPair(null)
        reset(createDefaultFormValues())
      }
    }, [reset])
  )

  const durationValue = watch('duration_target_games')
  const visibilityValue = watch('visibility')
  const formatValue = watch('format')

  const onStep1 = async (values: FormValues) => {
    try {
      const row = await createLeague.mutateAsync({
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
          location_privacy: 'participants_only',
          format: values.format,
        },
        password: values.visibility === MATCH_VISIBILITY.PRIVATE ? values.password : undefined,
      })
      setLeagueId(row.id)
      setStep(2)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo crear la liga')
    }
  }

  const handleAddPair = async (values: AddLeaguePairFormValues) => {
    if (!leagueId || !userId) return

    const useSelfA = values.playerAIsSelf && !userAlreadyInPair
    const useSelfB = values.playerBIsSelf && !userAlreadyInPair && !useSelfA
    const playerAUserId = useSelfA ? userId : null
    const playerAText = useSelfA ? null : values.playerAText.trim() || null
    const playerBUserId = useSelfB ? userId : null
    const playerBText = useSelfB ? null : values.playerBText.trim() || null

    if (!playerAUserId && !playerAText && !playerBUserId && !playerBText) {
      Alert.alert('Error', 'Indica al menos un jugador para la pareja')
      throw new Error('pair_players_required')
    }

    try {
      const row = await addPair.mutateAsync({
        leagueId,
        name: values.name.trim() || undefined,
        playerAUserId,
        playerAText,
        playerBUserId,
        playerBText,
      })
      setPairs((prev) => [...prev, row])
      setPairModalOpen(false)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo añadir la pareja')
      throw err
    }
  }

  const handleEditPair = async (values: EditLeaguePairFormValues) => {
    if (!editingPair || !leagueId) return
    try {
      const updated = await updatePair.mutateAsync({
        pairId: editingPair.id,
        leagueId,
        name: values.name.trim() || undefined,
        playerAText: editingPair.player_a_user_id ? null : values.playerAText.trim() || null,
        playerBText: editingPair.player_b_user_id ? null : values.playerBText.trim() || null,
      })
      setPairs((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setEditingPair(null)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar la pareja')
      throw err
    }
  }

  const runDeletePair = async (pairId: string) => {
    if (!leagueId) return
    try {
      await removePair.mutateAsync({ pairId, leagueId })
      setPairs((prev) => prev.filter((p) => p.id !== pairId))
      setEditingPair(null)
    } catch (err) {
      showAlert('Error', err instanceof Error ? err.message : 'No se pudo eliminar la pareja')
    }
  }

  const finish = async () => {
    if (!leagueId) return
    await acknowledgeAlert(AUTO_START_LEAGUE_ALERT.title, AUTO_START_LEAGUE_ALERT.message)
    router.replace(`/(tabs)/leagues/${leagueId}` as Href)
  }

  const closeToMyMatches = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace('/(tabs)/matches' as Href)
  }, [router])

  const closeBar = (
    <View style={s.closeBar}>
      <View style={{ flex: 1 }} />
      <Pressable
        onPress={closeToMyMatches}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Cerrar">
        <Text style={s.closeX}>✕</Text>
      </Pressable>
    </View>
  )

  if (step === 1) {
    return (
      <KeyboardAwareScrollView
        style={s.scroll}
        contentContainerStyle={[s.container, { paddingTop: screenTopPadding(insets.top, 8) }]}>
        {closeBar}
        <Text style={s.heading}>Organizar liga</Text>
        <Text style={s.step}>Paso 1 de 2 — Datos de la liga</Text>

        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <Input
              label="Título"
              placeholder="Liga"
              value={field.value ?? ''}
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
              placeholder="Detalles..."
              value={field.value ?? ''}
              onChangeText={field.onChange}
              error={errors.description?.message}
              multiline
              numberOfLines={3}
              autoCapitalize="sentences"
            />
          )}
        />

        <Text style={s.label}>Formato</Text>
        <View style={s.chipRow}>
          {(Object.keys(LEAGUE_FORMAT_LABELS) as LeagueFormat[]).map((fmt) => (
            <Chip
              key={fmt}
              label={LEAGUE_FORMAT_LABELS[fmt]}
              selected={formatValue === fmt}
              onPress={() => setValue('format', fmt, { shouldValidate: true })}
            />
          ))}
        </View>

        <Controller
          control={control}
          name="start_at"
          render={({ field }) => (
            <DateTimePicker
              label="Inicio"
              value={field.value}
              onChange={field.onChange}
              error={errors.start_at?.message}
            />
          )}
        />

        {formatValue === LEAGUE_FORMAT.OPEN_ELO ? (
          <Controller
            control={control}
            name="end_at"
            render={({ field }) => (
              <DateTimePicker
                label="Fin (obligatorio)"
                value={field.value || defaultEndAt()}
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
              error={errors.city?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="place_text"
          render={({ field }) => (
            <Input
              label="Lugar"
              placeholder="Bar, club..."
              value={field.value ?? ''}
              onChangeText={field.onChange}
              error={errors.place_text?.message}
            />
          )}
        />

        <Text style={s.label}>Juegos a ganar</Text>
        <View style={s.chipRow}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Chip
              key={n}
              label={String(n)}
              selected={durationValue === n}
              onPress={() => setValue('duration_target_games', n)}
            />
          ))}
        </View>

        <Text style={s.label}>Visibilidad</Text>
        <View style={s.chipRow}>
          <Chip
            label="Pública"
            selected={visibilityValue === MATCH_VISIBILITY.PUBLIC}
            onPress={() => setValue('visibility', MATCH_VISIBILITY.PUBLIC)}
          />
          <Chip
            label="Privada"
            selected={visibilityValue === MATCH_VISIBILITY.PRIVATE}
            onPress={() => setValue('visibility', MATCH_VISIBILITY.PRIVATE)}
          />
        </View>
        {visibilityValue === MATCH_VISIBILITY.PRIVATE ? (
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <Input
                label="Contraseña"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                error={errors.password?.message}
                secureTextEntry
              />
            )}
          />
        ) : null}

        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Input
              label="Notas"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              multiline
              numberOfLines={2}
            />
          )}
        />

        <Button
          title="Continuar"
          onPress={handleSubmit(onStep1, showFormFieldsMissingAlert)}
          loading={createLeague.isPending}
        />
      </KeyboardAwareScrollView>
    )
  }

  return (
    <KeyboardAwareScrollView
      style={s.scroll}
      contentContainerStyle={[s.container, { paddingTop: screenTopPadding(insets.top, 8) }]}>
      {closeBar}
      <Text style={s.heading}>Parejas de la liga</Text>
      <Text style={s.step}>Paso 2 de 2 — Añade parejas</Text>
      <Text style={s.hint}>
        Completas: {pairs.filter(isLeaguePairComplete).length} / {pairs.length}
      </Text>

      {pairs.map((pair) => (
        <LeaguePairCard
          key={pair.id}
          pair={pair}
          subtitle={isLeaguePairComplete(pair) ? 'Completa' : 'Incompleta'}
          onEdit={() => setEditingPair(pair)}
        />
      ))}

      <AddPairButton onPress={() => setPairModalOpen(true)} />
      <Button title="Ir a la liga" onPress={() => void finish()} />

      <AddLeaguePairModal
        visible={pairModalOpen}
        onClose={() => setPairModalOpen(false)}
        onSubmit={handleAddPair}
        loading={addPair.isPending}
        defaultSelfSlot={userAlreadyInPair ? null : 'a'}
        selfJoinDisabled={userAlreadyInPair}
      />
      <EditLeaguePairModal
        visible={Boolean(editingPair)}
        pair={editingPair}
        onClose={() => setEditingPair(null)}
        onSubmit={handleEditPair}
        canDelete
        saveLoading={updatePair.isPending}
        deleteLoading={removePair.isPending}
        onDelete={async () => {
          if (!editingPair) return
          const ok = await confirmAlert('Eliminar pareja', '¿Seguro?', {
            confirmText: 'Eliminar',
            destructive: true,
          })
          if (ok) await runDeletePair(editingPair.id)
        }}
      />
    </KeyboardAwareScrollView>
  )
}

const chip = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
  },
  selected: { borderColor: Colors.primary, backgroundColor: Colors.background },
  label: { fontSize: 14, fontFamily: Fonts.medium, color: Colors.textPrimary },
  labelSelected: { color: Colors.primary },
  sublabel: { fontSize: 11, color: Colors.textSecondary },
  sublabelSelected: { color: Colors.primary },
})

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, paddingBottom: 48, gap: 12 },
  closeBar: { flexDirection: 'row', alignItems: 'center' },
  closeX: { fontSize: 22, color: Colors.textSecondary, padding: 4 },
  heading: { fontSize: 22, fontFamily: Fonts.bold, color: Colors.textPrimary },
  step: { fontSize: 14, color: Colors.textSecondary, marginBottom: 4 },
  hint: { fontSize: 13, color: Colors.textSecondary },
  label: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.textPrimary, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
