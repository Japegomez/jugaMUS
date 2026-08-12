import { zodResolver } from '@hookform/resolvers/zod'
import { useFocusEffect } from '@react-navigation/native'
import { useRouter, type Href } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView'
import { dateToLocalIsoString } from '@/components/ui/dateTimePickerUtils'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { Input } from '@/components/ui/Input'
import {
  MatchScorePicker,
  type MatchScoreValues,
  validateMatchScores,
} from '@/components/matches/MatchScorePicker'
import { MunicipalityPicker } from '@/components/ui/MunicipalityPicker'
import { AvatarCircle } from '@/components/profile/AvatarCircle'
import { useAuthStore } from '@/hooks/useAuth'
import { useCreateMatch, useRecordMatchResultDirect } from '@/hooks/useMatches'
import { useInviteFriendToMatch } from '@/hooks/useMatchInvitations'
import { useMyFriends } from '@/hooks/useFriends'
import { useProfile } from '@/hooks/useProfile'
import { useSubmitResult } from '@/hooks/useResults'
import { MATCH_STATUS, MATCH_VISIBILITY, TEAM } from '@/constants'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'
import { acknowledgeAlert, showAlert } from '@/utils/alert'
import {
  AUTO_CANCEL_INCOMPLETE_ROSTER_ALERT,
  hasIncompleteMatchRoster,
  PAST_DATE_INCOMPLETE_ROSTER_ALERT,
  isMatchStartAtPast,
  requiresFutureStartAtForIncompleteRoster,
} from '@/utils/matchCreateForm'
import { resolveTeamName } from '@/utils/matchTeamNames'
import { showFormFieldsMissingAlert } from '@/utils/formValidation'

const DEFAULT_MATCH_TITLE = 'Partida'
const DEFAULT_MATCH_CITY = 'Ciudad por definir'

// ─── Schema ───────────────────────────────────────────────────────────────────

const createMatchSchema = z
  .object({
    title: z.string().trim().max(80, 'El título es demasiado largo').optional().or(z.literal('')),
    description: z
      .string()
      .trim()
      .max(300, 'Descripción demasiado larga')
      .optional()
      .or(z.literal('')),
    start_at: z.string().min(1, 'Selecciona fecha y hora'),
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
  const d = new Date()
  d.setMinutes(d.getMinutes() + 10)
  return dateToLocalIsoString(d)
}

function createDefaultFormValues(): CreateMatchValues {
  return {
    title: '',
    description: '',
    start_at: defaultStartAt(),
    city: '',
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

function matchPlacePayload(placeText?: string): {
  place_defined: boolean
  place_text: string | null
} {
  const trimmed = placeText?.trim()
  if (trimmed) {
    return { place_defined: true, place_text: trimmed }
  }
  return { place_defined: false, place_text: null }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreateMatchScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)
  const { data: profile } = useProfile(sessionUserId)
  const createMatch = useCreateMatch()
  const recordMatchResult = useRecordMatchResultDirect()
  const submitResult = useSubmitResult()
  const inviteFriend = useInviteFriendToMatch()
  const { data: friends } = useMyFriends()
  const [pastResult, setPastResult] = useState<MatchScoreValues | null>(null)
  const [invitesA, setInvitesA] = useState<string[]>([])
  const [invitesB, setInvitesB] = useState<string[]>([])
  const [friendSearch, setFriendSearch] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const closeToPrevious = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace('/(tabs)/matches' as Href)
  }, [router])

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
      setPastResult(null)
      setInvitesA([])
      setInvitesB([])
      setFriendSearch('')
      Keyboard.dismiss()
    }, [reset])
  )

  const durationValue = watch('duration_target_games')
  const visibilityValue = watch('visibility')
  const startAtValue = watch('start_at')
  const teamANameValue = watch('team_a_name')
  const teamBNameValue = watch('team_b_name')
  const teamAPlayer2 = watch('team_a_player_2')
  const teamBPlayer1 = watch('team_b_player_1')
  const teamBPlayer2 = watch('team_b_player_2')
  const isPastResultMode = isMatchStartAtPast(startAtValue)

  // Invite capacity is fixed; text roster slots unlock for leftover seats.
  const inviteCapacityA = 1
  const inviteCapacityB = 2
  const textSlotsA = Math.max(0, inviteCapacityA - invitesA.length)
  const textSlotsB = Math.max(0, inviteCapacityB - invitesB.length)

  const toggleInvite = (friendId: string, team: 'A' | 'B') => {
    if (team === 'A') {
      setInvitesA((prev) => {
        if (prev.includes(friendId)) return prev.filter((id) => id !== friendId)
        if (prev.length >= inviteCapacityA) return prev
        setValue('team_a_player_2', '')
        return [...prev, friendId]
      })
      setInvitesB((prev) => prev.filter((id) => id !== friendId))
    } else {
      setInvitesB((prev) => {
        if (prev.includes(friendId)) return prev.filter((id) => id !== friendId)
        if (prev.length >= inviteCapacityB) return prev
        const nextLen = prev.length + 1
        if (nextLen >= 2) {
          setValue('team_b_player_1', '')
          setValue('team_b_player_2', '')
        } else if (nextLen === 1) {
          // One rival invite leaves a single text slot → keep player_1, drop player_2.
          setValue('team_b_player_2', '')
        }
        return [...prev, friendId]
      })
      setInvitesA((prev) => prev.filter((id) => id !== friendId))
    }
  }

  const filteredFriends = useMemo(() => {
    const list = friends ?? []
    const q = friendSearch.trim().toLowerCase()
    if (!q) return list
    return list.filter((f) => f.display_name.toLowerCase().includes(q))
  }, [friends, friendSearch])

  const previewTeamNames = useMemo(() => {
    const draft = {
      team_a_name: teamANameValue ?? '',
      team_b_name: teamBNameValue ?? '',
      team_a_player_1: null,
      team_a_player_2: invitesA.length > 0 ? null : teamAPlayer2?.trim() || null,
      team_b_player_1:
        invitesB.length >= 2
          ? null
          : invitesB.length === 1
            ? teamBPlayer1?.trim() || null
            : teamBPlayer1?.trim() || null,
      team_b_player_2: invitesB.length >= 1 ? null : teamBPlayer2?.trim() || null,
    }
    const creatorParticipant = profile?.display_name
      ? [
          {
            team: TEAM.A,
            joined_at: '1970-01-01T00:00:00.000Z',
            left_at: null,
            profile: { display_name: profile.display_name },
          },
        ]
      : []
    return {
      teamA: resolveTeamName(draft, TEAM.A, creatorParticipant),
      teamB: resolveTeamName(draft, TEAM.B, []),
    }
  }, [
    profile?.display_name,
    teamANameValue,
    teamAPlayer2,
    teamBNameValue,
    teamBPlayer1,
    teamBPlayer2,
    invitesA.length,
    invitesB.length,
  ])

  useEffect(() => {
    setPastResult(null)
  }, [durationValue, isPastResultMode])

  useEffect(() => {
    setInvitesA((prev) => (prev.length > inviteCapacityA ? prev.slice(0, inviteCapacityA) : prev))
  }, [inviteCapacityA])

  useEffect(() => {
    setInvitesB((prev) => (prev.length > inviteCapacityB ? prev.slice(0, inviteCapacityB) : prev))
  }, [inviteCapacityB])

  const onSubmit = async (values: CreateMatchValues) => {
    if (isSubmitting) return
    if (isPastResultMode && !pastResult) {
      showAlert('Resultado pendiente', 'Selecciona el marcador de la partida antes de crearla.')
      return
    }
    if (isPastResultMode && pastResult) {
      const scoreError = validateMatchScores(
        pastResult.teamAGames,
        pastResult.teamBGames,
        values.duration_target_games
      )
      if (scoreError) {
        showAlert('Marcador no válido', scoreError)
        return
      }
    }
    const effectiveRoster = {
      team_a_player_2: invitesA.length > 0 ? 'invited' : values.team_a_player_2,
      team_b_player_1: invitesB.length >= 1 ? 'invited' : values.team_b_player_1,
      team_b_player_2:
        invitesB.length >= 2
          ? 'invited'
          : invitesB.length === 1
            ? values.team_b_player_1
            : values.team_b_player_2,
    }
    if (isPastResultMode && hasIncompleteMatchRoster(effectiveRoster)) {
      showAlert(
        'Faltan jugadores',
        'Para registrar una partida ya jugada debes completar los cuatro jugadores de los dos equipos (por nombre o invitando a amigos).'
      )
      return
    }
    if (isPastResultMode && invitesB.length > 0 && !pastResult) {
      showAlert('Resultado pendiente', 'Selecciona el marcador de la partida antes de crearla.')
      return
    }
    if (
      !isPastResultMode &&
      requiresFutureStartAtForIncompleteRoster(values.start_at, effectiveRoster)
    ) {
      showAlert(PAST_DATE_INCOMPLETE_ROSTER_ALERT.title, PAST_DATE_INCOMPLETE_ROSTER_ALERT.message)
      return
    }

    const inviteTargets = [
      ...invitesA.slice(0, inviteCapacityA).map((fid) => ({ fid, team: TEAM.A as const })),
      ...invitesB.slice(0, inviteCapacityB).map((fid) => ({ fid, team: TEAM.B as const })),
    ]

    setIsSubmitting(true)
    try {
      const match = await createMatch.mutateAsync({
        data: {
          title: values.title?.trim() || DEFAULT_MATCH_TITLE,
          description: values.description || null,
          start_at: values.start_at,
          city: values.city?.trim() || DEFAULT_MATCH_CITY,
          ...matchPlacePayload(values.place_text),
          duration_target_games: values.duration_target_games,
          visibility: values.visibility,
          location_privacy: 'participants_only',
          ...(isPastResultMode ? { status: MATCH_STATUS.IN_PROGRESS } : {}),
          team_a_name: (values.team_a_name ?? '').trim(),
          team_b_name: (values.team_b_name ?? '').trim(),
          team_a_player_1: null,
          team_a_player_2: invitesA.length > 0 ? null : textPlayerOrNull(values.team_a_player_2),
          team_b_player_1: invitesB.length >= 2 ? null : textPlayerOrNull(values.team_b_player_1),
          team_b_player_2: invitesB.length >= 1 ? null : textPlayerOrNull(values.team_b_player_2),
        },
        password: values.visibility === MATCH_VISIBILITY.PRIVATE ? values.password : undefined,
      })
      if (!isPastResultMode && hasIncompleteMatchRoster(effectiveRoster)) {
        await acknowledgeAlert(
          AUTO_CANCEL_INCOMPLETE_ROSTER_ALERT.title,
          AUTO_CANCEL_INCOMPLETE_ROSTER_ALERT.message
        )
      }

      const failedInvites: { fid: string; team: string }[] = []
      if (inviteTargets.length > 0) {
        await Promise.all(
          inviteTargets.map(async ({ fid, team }) => {
            try {
              await inviteFriend.mutateAsync({ matchId: match.id, inviteeId: fid, team })
            } catch (err) {
              console.warn('invite_friend_failed', err)
              failedInvites.push({ fid, team })
            }
          })
        )
      }

      const successfulInviteCount = inviteTargets.length - failedInvites.length
      const rivalInvitesOk =
        invitesB.length === 0 || failedInvites.filter((f) => f.team === TEAM.B).length === 0

      if (isPastResultMode && pastResult) {
        // Only submit for validation when rival invites were created successfully.
        if (successfulInviteCount > 0 && rivalInvitesOk && invitesB.length > 0) {
          await submitResult.mutateAsync({
            matchId: match.id,
            submittedByUserId: sessionUserId!,
            submittedByTeam: TEAM.A,
            teamAGames: pastResult.teamAGames,
            teamBGames: pastResult.teamBGames,
          })
        } else if (successfulInviteCount === 0 || invitesB.length === 0) {
          await recordMatchResult.mutateAsync({
            matchId: match.id,
            teamAGames: pastResult.teamAGames,
            teamBGames: pastResult.teamBGames,
          })
        } else {
          showAlert(
            'Invitaciones incompletas',
            'No se pudo enviar alguna invitación rival. El resultado no se ha registrado como pendiente de validación. Revisa las invitaciones en la ficha de la partida.'
          )
        }
      }

      if (failedInvites.length > 0) {
        const names = failedInvites
          .map((f) => friends?.find((fr) => fr.user_id === f.fid)?.display_name ?? 'Amigo')
          .join(', ')
        await new Promise<void>((resolve) => {
          Alert.alert(
            'Algunas invitaciones fallaron',
            `No se pudo invitar a: ${names}. Puedes reintentarlo desde la ficha de la partida.`,
            [{ text: 'Entendido', onPress: () => resolve() }]
          )
        })
      }

      router.replace({
        pathname: '/(tabs)/matches/[id]',
        params: {
          id: match.id,
          ...(successfulInviteCount > 0 && failedInvites.length === 0 ? { shareInvite: '1' } : {}),
        },
      } as Href)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo crear la partida')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <KeyboardAwareScrollView
      style={s.scroll}
      contentContainerStyle={[s.container, { paddingTop: screenTopPadding(insets.top, 8) }]}>
      <View style={s.closeBar}>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={closeToPrevious}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar">
          <Text style={s.closeX}>✕</Text>
        </Pressable>
      </View>

      <Text style={s.heading}>Nueva partida</Text>

      {/* Título */}
      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <Input
            label="Título"
            placeholder="Partida"
            value={field.value ?? ''}
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
            label="Fecha y hora"
            value={field.value ?? ''}
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
            label="Ciudad o pueblo"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            error={errors.city?.message}
            placeholder="Ciudad por definir"
          />
        )}
      />

      {/* Lugar (texto) */}
      <Controller
        control={control}
        name="place_text"
        render={({ field }) => (
          <Input
            label="Lugar"
            placeholder="Lugar por definir"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            error={errors.place_text?.message}
            autoCapitalize="sentences"
          />
        )}
      />

      {/* Duración */}
      <View style={s.fieldWrap}>
        <Text style={s.label}>Duración (juegos)</Text>
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
        <Text style={s.label}>Visibilidad</Text>
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
              label="Contraseña"
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
        <Text style={s.label}>Equipos y jugadores</Text>
        <Text style={s.hint}>
          Te unirás automáticamente como jugador 1 del primer equipo. Invita amigos primero; las
          plazas libres se pueden completar con nombres (sin cuenta).
        </Text>

        {friends && friends.length > 0 ? (
          <>
            <Text style={s.subLabel}>Invitar amigos</Text>
            <Text style={s.hint}>
              Compañero = tu equipo. Rival = equipo contrario. Las plazas de texto se desbloquean
              según las invitaciones pendientes.
            </Text>
            <View style={s.friendSearchWrap}>
              <TextInput
                value={friendSearch}
                onChangeText={setFriendSearch}
                placeholder="Buscar amigo…"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                style={s.friendSearchInput}
                accessibilityLabel="Buscar amigos para invitar"
              />
              {friendSearch.length > 0 ? (
                <Pressable
                  onPress={() => setFriendSearch('')}
                  accessibilityRole="button"
                  accessibilityLabel="Limpiar búsqueda de amigos"
                  hitSlop={8}
                  style={s.friendSearchClear}>
                  <Text style={s.friendSearchClearText}>✕</Text>
                </Pressable>
              ) : null}
            </View>
            {filteredFriends.length === 0 ? (
              <Text style={s.friendSearchEmpty}>No hay amigos con ese nombre.</Text>
            ) : (
              <ScrollView
                style={s.friendListScroll}
                contentContainerStyle={s.friendListContent}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator>
                {filteredFriends.map((f) => {
                  const inA = invitesA.includes(f.user_id)
                  const inB = invitesB.includes(f.user_id)
                  return (
                    <View key={f.user_id} style={s.friendRow}>
                      <AvatarCircle uri={f.photo_url} name={f.display_name} size={40} />
                      <View style={s.friendInfo}>
                        <Text style={s.friendName} numberOfLines={1}>
                          {f.display_name}
                        </Text>
                        {f.city ? (
                          <Text style={s.friendCity} numberOfLines={1}>
                            {f.city}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => toggleInvite(f.user_id, 'A')}
                        disabled={!inA && inviteCapacityA - invitesA.length <= 0}
                        style={[
                          s.inviteChip,
                          inA && s.inviteChipActive,
                          !inA && inviteCapacityA - invitesA.length <= 0 && s.inviteChipDisabled,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: inA }}>
                        <Text style={[s.inviteChipText, inA && s.inviteChipTextActive]}>
                          {inA ? 'Compañero ✓' : 'Compañero'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => toggleInvite(f.user_id, 'B')}
                        disabled={!inB && inviteCapacityB - invitesB.length <= 0}
                        style={[
                          s.inviteChip,
                          inB && s.inviteChipActive,
                          !inB && inviteCapacityB - invitesB.length <= 0 && s.inviteChipDisabled,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: inB }}>
                        <Text style={[s.inviteChipText, inB && s.inviteChipTextActive]}>
                          {inB ? 'Rival ✓' : 'Rival'}
                        </Text>
                      </Pressable>
                    </View>
                  )
                })}
              </ScrollView>
            )}
            {invitesA.length + invitesB.length > 0 ? (
              <Text style={s.friendSelectionHint}>
                {invitesA.length + invitesB.length}{' '}
                {invitesA.length + invitesB.length === 1
                  ? 'amigo seleccionado'
                  : 'amigos seleccionados'}
                {' · '}
                {textSlotsA + textSlotsB}{' '}
                {textSlotsA + textSlotsB === 1 ? 'plaza de texto libre' : 'plazas de texto libres'}
              </Text>
            ) : null}
          </>
        ) : null}

        <Text style={s.subLabel}>Nombres (sin cuenta)</Text>
        {textSlotsA > 0 ? (
          <Controller
            control={control}
            name="team_a_player_2"
            render={({ field }) => (
              <Input
                label="Compañero (jugador 2)"
                placeholder="Nombre"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                error={errors.team_a_player_2?.message}
                autoCapitalize="words"
              />
            )}
          />
        ) : (
          <Text style={s.slotLockedHint}>Compañero cubierto por invitación.</Text>
        )}
        <Controller
          control={control}
          name="team_a_name"
          render={({ field }) => (
            <Input
              label="Nombre equipo A"
              placeholder="Jugador1 - Jugador2"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              error={errors.team_a_name?.message}
              autoCapitalize="words"
            />
          )}
        />
        {textSlotsB >= 1 ? (
          <Controller
            control={control}
            name="team_b_player_1"
            render={({ field }) => (
              <Input
                label={textSlotsB === 1 ? 'Rival (sin cuenta)' : 'Jugador 1'}
                placeholder="Nombre"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                error={errors.team_b_player_1?.message}
                autoCapitalize="words"
              />
            )}
          />
        ) : null}
        {textSlotsB >= 2 ? (
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
        ) : textSlotsB === 0 ? (
          <Text style={s.slotLockedHint}>Rivales cubiertos por invitación.</Text>
        ) : null}
        <Controller
          control={control}
          name="team_b_name"
          render={({ field }) => (
            <Input
              label="Nombre equipo B"
              placeholder="Jugador1 - Jugador2"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              error={errors.team_b_name?.message}
              autoCapitalize="words"
            />
          )}
        />
      </View>

      {isPastResultMode ? (
        <View style={s.pastResultCard}>
          <Text style={s.pastResultTitle}>Partida ya jugada</Text>
          <Text style={s.pastResultText}>
            La hora de inicio es anterior a la hora actual. Se entiende que estás registrando una
            partida ya jugada. Introduce el resultado para que se cree directamente como finalizada.
          </Text>
          <MatchScorePicker
            durationTargetGames={durationValue}
            teamAName={previewTeamNames.teamA}
            teamBName={previewTeamNames.teamB}
            hint="Selecciona el marcador final."
            showSubmitButton={false}
            startEmpty
            onChange={setPastResult}
          />
        </View>
      ) : null}

      {/* Notas */}
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <Input
            label="Notas"
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
        loading={
          isSubmitting ||
          createMatch.isPending ||
          recordMatchResult.isPending ||
          submitResult.isPending ||
          inviteFriend.isPending
        }
        style={s.submitBtn}
      />
    </KeyboardAwareScrollView>
  )
}

const FRIEND_ROW_HEIGHT = 56
const FRIEND_LIST_VISIBLE_ROWS = 5

const s = StyleSheet.create({
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
  label: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    marginBottom: 8,
    color: Colors.textPrimary,
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  visRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  hint: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12, lineHeight: 18 },
  subLabel: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    marginTop: 8,
    marginBottom: 6,
  },
  slotLockedHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 10,
    lineHeight: 18,
  },
  friendSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    minHeight: 44,
    marginBottom: 10,
  },
  friendSearchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
    paddingVertical: 10,
  },
  friendSearchClear: { padding: 4 },
  friendSearchClearText: { fontSize: 14, color: Colors.textSecondary },
  friendSearchEmpty: {
    fontSize: 13,
    color: Colors.textSecondary,
    paddingVertical: 8,
  },
  friendListScroll: {
    // ~5 friend rows visible; scroll for the rest.
    maxHeight: FRIEND_LIST_VISIBLE_ROWS * FRIEND_ROW_HEIGHT,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.background,
  },
  friendListContent: {
    paddingHorizontal: 8,
  },
  friendSelectionHint: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: FRIEND_ROW_HEIGHT,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  friendInfo: { flex: 1, minWidth: 0, gap: 2 },
  friendName: { fontSize: 15, fontFamily: Fonts.medium, color: Colors.textPrimary },
  friendCity: { fontSize: 13, color: Colors.textSecondary },
  inviteChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  inviteChipActive: { borderColor: Colors.primary, backgroundColor: Colors.wonBackground },
  inviteChipDisabled: { opacity: 0.4 },
  inviteChipText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  inviteChipTextActive: { color: Colors.primary },
  teamLabel: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    marginBottom: 8,
    marginTop: 4,
  },
  error: { color: Colors.danger, fontSize: 13, marginTop: 4 },
  submitBtn: { marginTop: 8 },
  pastResultCard: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  pastResultTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    marginBottom: 6,
  },
  pastResultText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },
})
