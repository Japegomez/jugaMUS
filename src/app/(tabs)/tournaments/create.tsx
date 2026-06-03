import { zodResolver } from '@hookform/resolvers/zod'
import { useFocusEffect } from '@react-navigation/native'
import { useRouter, type Href } from 'expo-router'
import { useCallback, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'

import { AddPairModal, type AddPairFormValues } from '@/components/tournaments/AddPairModal'
import { EditPairModal, type EditPairFormValues } from '@/components/tournaments/EditPairModal'
import { PairCard } from '@/components/tournaments/PairCard'
import { Button } from '@/components/ui/Button'
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView'
import { dateToLocalIsoString } from '@/components/ui/dateTimePickerUtils'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { Input } from '@/components/ui/Input'
import { MunicipalityPicker } from '@/components/ui/MunicipalityPicker'
import { MATCH_VISIBILITY } from '@/constants'
import { useAuthStore } from '@/hooks/useAuth'
import {
  useAddTournamentPair,
  useCreateTournament,
  useRemoveTournamentPair,
  useUpdateTournamentPair,
} from '@/hooks/useTournaments'
import { isTournamentPairComplete, type TournamentPairRow } from '@/services/tournaments.service'
import { confirmAlert, showAlert } from '@/utils/alert'
import { placeFormFields, refinePlaceRequired, placePayload } from '@/utils/placeForm'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'

const schema = z
  .object({
    title: z.string().trim().min(3, 'Mínimo 3 caracteres').max(80),
    description: z.string().trim().max(300).optional().or(z.literal('')),
    start_at: z.string().min(1, 'Selecciona fecha y hora'),
    city: z.string().trim().min(1, 'Selecciona ciudad'),
    ...placeFormFields,
    duration_target_games: z.number().int().min(1).max(6),
    visibility: z.enum([MATCH_VISIBILITY.PUBLIC, MATCH_VISIBILITY.LINK]),
    notes: z.string().trim().max(300).optional().or(z.literal('')),
  })
  .superRefine(refinePlaceRequired)

type FormValues = z.infer<typeof schema>

function createDefaultFormValues(): FormValues {
  return {
    title: '',
    description: '',
    start_at: defaultStartAt(),
    city: '',
    place_defined: true,
    place_text: '',
    duration_target_games: 3,
    visibility: MATCH_VISIBILITY.PUBLIC,
    notes: '',
  }
}

function defaultStartAt() {
  const d = new Date()
  d.setHours(d.getHours() + 2, 0, 0, 0)
  return dateToLocalIsoString(d)
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

export default function CreateTournamentScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const userId = useAuthStore((s) => s.session?.user.id)
  const createTournament = useCreateTournament()
  const addPair = useAddTournamentPair()
  const updatePair = useUpdateTournamentPair()
  const removePair = useRemoveTournamentPair()

  const [step, setStep] = useState<1 | 2>(1)
  const [tournamentId, setTournamentId] = useState<string | null>(null)
  const [pairs, setPairs] = useState<TournamentPairRow[]>([])
  const [pairModalOpen, setPairModalOpen] = useState(false)
  const [editingPair, setEditingPair] = useState<TournamentPairRow | null>(null)

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
        setTournamentId(null)
        setPairs([])
        setPairModalOpen(false)
        setEditingPair(null)
        reset(createDefaultFormValues())
      }
    }, [reset])
  )

  const placeDefined = watch('place_defined')
  const durationValue = watch('duration_target_games')
  const visibilityValue = watch('visibility')

  const onStep1 = async (values: FormValues) => {
    try {
      const row = await createTournament.mutateAsync({
        title: values.title,
        description: values.description || null,
        notes: values.notes || null,
        start_at: values.start_at,
        city: values.city,
        ...placePayload(values),
        duration_target_games: values.duration_target_games,
        visibility: values.visibility,
        location_privacy: 'participants_only',
        creator_joins_as_player: false,
      })
      setTournamentId(row.id)
      setStep(2)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo crear el torneo')
    }
  }

  const handleAddPair = async (values: AddPairFormValues) => {
    if (!tournamentId || !userId) return

    const useSelfA = values.playerAIsSelf && !userAlreadyInPair
    const useSelfB = values.playerBIsSelf && !userAlreadyInPair && !useSelfA
    const playerAUserId = useSelfA ? userId : null
    const playerAText = useSelfA ? null : values.playerAText.trim() || null
    const playerBUserId = useSelfB ? userId : null
    const playerBText = useSelfB ? null : values.playerBText.trim() || null

    const hasPlayerA = playerAUserId !== null || playerAText !== null
    const hasPlayerB = playerBUserId !== null || playerBText !== null
    if (!hasPlayerA && !hasPlayerB) {
      Alert.alert('Error', 'Indica al menos un jugador para la pareja')
      throw new Error('pair_players_required')
    }

    try {
      const row = await addPair.mutateAsync({
        tournamentId,
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

  const handleEditPair = async (values: EditPairFormValues) => {
    if (!editingPair || !tournamentId) return
    try {
      const updated = await updatePair.mutateAsync({
        pairId: editingPair.id,
        tournamentId,
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

  const confirmDeletePair = async () => {
    if (!editingPair) return
    const pairId = editingPair.id
    const ok = await confirmAlert(
      'Eliminar pareja',
      '¿Seguro que quieres eliminar esta pareja del torneo?',
      { confirmText: 'Eliminar', destructive: true }
    )
    if (ok) void runDeletePair(pairId)
  }

  const runDeletePair = async (pairId: string) => {
    if (!tournamentId) return
    try {
      await removePair.mutateAsync({ pairId, tournamentId })
      setPairs((prev) => prev.filter((p) => p.id !== pairId))
      setEditingPair(null)
    } catch (err) {
      showAlert('Error', err instanceof Error ? err.message : 'No se pudo eliminar la pareja')
    }
  }

  const finish = () => {
    if (!tournamentId) return
    router.replace(`/(tabs)/tournaments/${tournamentId}` as Href)
  }

  if (step === 1) {
    return (
      <KeyboardAwareScrollView
        style={s.scroll}
        contentContainerStyle={[s.container, { paddingTop: screenTopPadding(insets.top, 20) }]}>
        <Text style={s.heading}>Organizar torneo</Text>
        <Text style={s.step}>Paso 1 de 2 — Datos del torneo</Text>

        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <Input
              label="Título *"
              placeholder="Ej. Torneo de primavera"
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
              label="Ciudad o pueblo *"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.city?.message}
            />
          )}
        />
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
        {placeDefined ? (
          <Controller
            control={control}
            name="place_text"
            render={({ field }) => (
              <Input
                label="Lugar *"
                placeholder="Ej. Bar El Rincón"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                error={errors.place_text?.message}
                autoCapitalize="sentences"
              />
            )}
          />
        ) : null}
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
        </View>
        <View style={s.fieldWrap}>
          <Text style={s.label}>Visibilidad *</Text>
          <View style={s.visRow}>
            <Chip
              label="Pública"
              sublabel="Aparece en listados"
              selected={visibilityValue === MATCH_VISIBILITY.PUBLIC}
              onPress={() =>
                setValue('visibility', MATCH_VISIBILITY.PUBLIC, { shouldValidate: true })
              }
            />
            <Chip
              label="Con enlace"
              sublabel="Solo con invitación"
              selected={visibilityValue === MATCH_VISIBILITY.LINK}
              onPress={() =>
                setValue('visibility', MATCH_VISIBILITY.LINK, { shouldValidate: true })
              }
            />
          </View>
        </View>
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Input
              label="Notas opcionales"
              placeholder="Información para participantes..."
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
          title="Añadir parejas"
          onPress={handleSubmit(onStep1)}
          loading={createTournament.isPending}
          style={s.submitBtn}
        />
      </KeyboardAwareScrollView>
    )
  }

  return (
    <KeyboardAwareScrollView
      style={s.scroll}
      contentContainerStyle={[s.container, { paddingTop: screenTopPadding(insets.top, 20) }]}>
      <Text style={s.heading}>Parejas inscritas</Text>
      <Text style={s.step}>Paso 2 de 2 — Añade las parejas participantes</Text>
      <Text style={s.hint}>
        Puedes añadir tantas parejas como quieras. Cada pareja puede incluir jugadores registrados o
        nombres de texto.
      </Text>

      {pairs.length === 0 ? (
        <Text style={s.empty}>Aún no hay parejas. Pulsa «Añadir pareja».</Text>
      ) : (
        pairs.map((p) => (
          <PairCard
            key={p.id}
            pair={p}
            subtitle={!isTournamentPairComplete(p) ? 'Falta un jugador' : undefined}
            editLabel="Editar"
            onEdit={() => setEditingPair(p)}
          />
        ))
      )}

      <Button
        title="Añadir pareja"
        variant="outline"
        onPress={() => setPairModalOpen(true)}
        style={s.actionBtn}
      />
      <Button title="Guardar torneo" onPress={finish} style={s.submitBtn} />

      <AddPairModal
        visible={pairModalOpen}
        onClose={() => setPairModalOpen(false)}
        onSubmit={handleAddPair}
        loading={addPair.isPending}
        selfJoinDisabled={userAlreadyInPair}
      />

      <EditPairModal
        visible={editingPair !== null}
        pair={editingPair}
        onClose={() => setEditingPair(null)}
        onSubmit={handleEditPair}
        onDelete={confirmDeletePair}
        saveLoading={updatePair.isPending}
        deleteLoading={removePair.isPending}
      />
    </KeyboardAwareScrollView>
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

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 20, paddingBottom: 40 },
  heading: { fontSize: 24, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 6 },
  step: { fontSize: 14, color: Colors.primary, fontFamily: Fonts.semiBold, marginBottom: 16 },
  hint: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16, lineHeight: 20 },
  empty: { fontSize: 15, color: Colors.textSecondary, fontStyle: 'italic', marginBottom: 16 },
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
  actionBtn: { marginBottom: 10 },
  submitBtn: { marginTop: 8 },
})
