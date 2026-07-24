import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ApproveResultModal } from '@/components/matches/ApproveResultModal'
import {
  EditMatchTeamModal,
  type EditMatchTeamFormValues,
} from '@/components/matches/EditMatchTeamModal'
import { MatchPasswordModal } from '@/components/matches/MatchPasswordModal'
import { CancelMatchModal } from '@/components/matches/CancelMatchModal'
import { IncompleteRosterStartModal } from '@/components/matches/IncompleteRosterStartModal'
import { LeaveMatchModal } from '@/components/matches/LeaveMatchModal'
import { DisputeResultModal } from '@/components/matches/DisputeResultModal'
import { ResultCard } from '@/components/matches/ResultCard'
import { RecordResultModal } from '@/components/matches/RecordResultModal'
import { SubmitResultModal } from '@/components/matches/SubmitResultModal'
import { Button } from '@/components/ui/Button'
import { ReportModal } from '@/components/ui/ReportModal'
import { ShareInviteButton } from '@/components/ShareInviteButton'
import { useAuthStore } from '@/hooks/useAuth'
import {
  useCancelMatch,
  useGrantMatchPasswordAccess,
  useJoinMatch,
  useLeaveMatch,
  useMatch,
  useRecordMatchResultDirect,
  useStartMatch,
  useUpdateMatchTeam,
} from '@/hooks/useMatches'
import { useTournament, useRecordTournamentMatchAsReferee } from '@/hooks/useTournaments'
import { useMatchResult, useSubmitConfirmation, useSubmitResult } from '@/hooks/useResults'
import {
  freeTeamSlots,
  getParticipantProfile,
  isRosterFull,
  resolveTeamName,
} from '@/services/matches.service'
import {
  buildMatchTeamEditSlots,
  canEditMatchTeam,
  editableTextSlotsForTeam,
  validateTextRosterCapacity,
} from '@/services/matches.service'
import { isUnspecifiedTeamName } from '@/utils/matchTeamNames'
import type { ParticipantProfile, ParticipantWithProfile } from '@/services/matches.service'
import { collectTeamRosterEntries } from '@/utils/matchTeamNames'
import type { ReportTargetType } from '@/services/reports.service'
import { MATCH_STATUS, MATCH_VISIBILITY, RESULT_STATUS, TEAM } from '@/constants'
import { clearScoreboardState } from '@/lib/scoreboardStorage'
import {
  clearPendingMatchResultFromScoreboard,
  getPendingMatchResultFromScoreboard,
  setPendingMatchResultFromScoreboard,
} from '@/lib/pendingMatchResultFromScoreboard'
import { prefetchOrientationLock } from '@/lib/orientationLock'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'
import { matchStatusDisplay } from '@/utils/matchDisplay'
import * as ScreenOrientation from 'expo-screen-orientation'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function submitterDisplayName(participants: ParticipantWithProfile[], userId: string) {
  const p = participants.find((x) => x.user_id === userId)
  return p?.profile?.display_name ?? 'Jugador'
}

// ─── Participant card ─────────────────────────────────────────────────────────

interface ParticipantCardProps {
  participant: ParticipantWithProfile
  matchId: string
  canRevealPhone: boolean
  currentUserId?: string
  onReportUser?: (userId: string, displayName: string) => void
}

function ParticipantCard({
  participant,
  matchId,
  canRevealPhone,
  currentUserId,
  onReportUser,
}: ParticipantCardProps) {
  const router = useRouter()
  const [fullProfile, setFullProfile] = useState<ParticipantProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const canOpenProfile = Boolean(
    participant.user_id && currentUserId && participant.user_id !== currentUserId
  )

  const handleOpenProfile = () => {
    if (!canOpenProfile) return
    router.push(`/(tabs)/profile/${participant.user_id}` as Href)
  }

  const handleRevealPhone = async () => {
    if (!canRevealPhone) return
    setLoading(true)
    try {
      const profile = await getParticipantProfile(matchId, participant.user_id)
      setFullProfile(profile)
    } finally {
      setLoading(false)
    }
  }

  const p = participant?.profile
  if (!p) return null

  return (
    <View style={card.wrap}>
      <Pressable
        style={({ pressed }) => [card.profileTap, pressed && card.profileTapPressed]}
        onPress={canOpenProfile ? handleOpenProfile : undefined}
        disabled={!canOpenProfile}
        accessibilityRole={canOpenProfile ? 'button' : undefined}
        accessibilityLabel={canOpenProfile ? `Ver perfil de ${p.display_name}` : undefined}>
        {p.photo_url ? (
          <Image source={{ uri: p.photo_url }} style={card.avatar} />
        ) : (
          <View style={card.avatarPlaceholder}>
            <Text style={card.avatarInitial}>{p.display_name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={card.info}>
          <Text style={[card.name, canOpenProfile && card.nameLink]}>{p.display_name}</Text>
          {p.city ? <Text style={card.city}>{p.city}</Text> : null}
        </View>
      </Pressable>
      <View style={card.actions}>
        {canRevealPhone ? (
          <>
            {fullProfile?.phone_e164 ? (
              <Text style={card.phone}>{fullProfile.phone_e164}</Text>
            ) : (
              <Pressable onPress={handleRevealPhone} disabled={loading}>
                <Text style={card.revealPhone}>{loading ? 'Cargando...' : 'Ver teléfono'}</Text>
              </Pressable>
            )}
          </>
        ) : null}
        {currentUserId && participant.user_id !== currentUserId && onReportUser ? (
          <Pressable
            onPress={() => onReportUser(participant.user_id, p.display_name)}
            accessibilityRole="button"
            accessibilityLabel={`Reportar a ${p.display_name}`}
            style={card.reportBtn}>
            <Text style={card.reportText}>Reportar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const card = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  profileTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  profileTapPressed: { opacity: 0.75 },
  actions: {
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: 4,
    maxWidth: '42%',
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: Colors.white, fontSize: 16, fontFamily: Fonts.bold },
  info: { flex: 1, marginLeft: 12, minWidth: 0 },
  name: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  nameLink: { color: Colors.primary },
  city: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  phone: { fontSize: 13, color: Colors.primary, marginTop: 3, fontFamily: Fonts.medium },
  revealPhone: {
    fontSize: 13,
    color: Colors.primary,
    marginTop: 3,
    textDecorationLine: 'underline',
  },
  reportBtn: { marginTop: 8, alignSelf: 'flex-start' },
  reportText: { fontSize: 13, color: Colors.danger, fontFamily: Fonts.semiBold },
})

// ─── Team section ─────────────────────────────────────────────────────────────

interface TeamSectionProps {
  team: string
  teamLabel: string
  freeSlots: number
  participants: ParticipantWithProfile[]
  rosterText: {
    team_a_player_1: string | null
    team_a_player_2: string | null
    team_b_player_1: string | null
    team_b_player_2: string | null
  }
  matchId: string
  canRevealPhone: boolean
  currentUserId?: string
  onReportUser?: (userId: string, displayName: string) => void
  editLabel?: string
  onEdit?: () => void
}

function TextPlayerRow({ name }: { name: string }) {
  return (
    <View style={textPlayer_s.row}>
      <Text style={textPlayer_s.name}>{name}</Text>
    </View>
  )
}

function TeamSection({
  team,
  teamLabel,
  freeSlots,
  participants,
  rosterText,
  matchId,
  canRevealPhone,
  currentUserId,
  onReportUser,
  editLabel,
  onEdit,
}: TeamSectionProps) {
  const entries = collectTeamRosterEntries(rosterText, participants, team)

  return (
    <View style={team_s.wrap}>
      <View style={team_s.header}>
        <Text style={team_s.title}>{teamLabel}</Text>
        <View style={team_s.headerRight}>
          {onEdit && editLabel ? (
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel={editLabel}
              style={team_s.editBtn}>
              <Text style={team_s.editText}>{editLabel}</Text>
            </Pressable>
          ) : null}
          <Text style={team_s.slots}>
            {freeSlots > 0
              ? `${freeSlots} plaza${freeSlots > 1 ? 's' : ''} libre${freeSlots > 1 ? 's' : ''}`
              : 'Completo'}
          </Text>
        </View>
      </View>
      {entries.length === 0 ? (
        <Text style={team_s.empty}>Sin jugadores aún</Text>
      ) : (
        entries.map((entry) => {
          if (entry.kind === 'text') {
            return <TextPlayerRow key={`text-${team}-${entry.name}`} name={entry.name} />
          }

          // Guard defensivo: evita crash si el roster viene incompleto.
          if (!entry.participant) return null

          return (
            <ParticipantCard
              key={entry.participant.id}
              participant={entry.participant}
              matchId={matchId}
              canRevealPhone={canRevealPhone}
              currentUserId={currentUserId}
              onReportUser={onReportUser}
            />
          )
        })
      )}
    </View>
  )
}

const team_s = StyleSheet.create({
  wrap: { marginBottom: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editBtn: { paddingVertical: 2, paddingHorizontal: 4 },
  editText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary },
  slots: { fontSize: 13, color: Colors.textSecondary },
  empty: { fontSize: 14, color: Colors.textSecondary, paddingVertical: 8 },
})

const textPlayer_s = StyleSheet.create({
  row: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  name: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
})

// ─── Join Modal ───────────────────────────────────────────────────────────────

interface JoinModalProps {
  visible: boolean
  onClose: () => void
  onJoin: (team: string) => void
  slotsA: number
  slotsB: number
  teamAName: string
  teamBName: string
  loading: boolean
}

function JoinModal({
  visible,
  onClose,
  onJoin,
  slotsA,
  slotsB,
  teamAName,
  teamBName,
  loading,
}: JoinModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={jm.wrap}>
        <View style={jm.header}>
          <Text style={jm.title}>Unirse a la partida</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar">
            <Text style={jm.close}>✕</Text>
          </Pressable>
        </View>
        <View style={jm.body}>
          <Text style={jm.subtitle}>Elige tu equipo</Text>
          {([TEAM.A, TEAM.B] as const).map((team) => {
            const slots = team === TEAM.A ? slotsA : slotsB
            const label = team === TEAM.A ? teamAName : teamBName
            const isFull = slots === 0
            return (
              <Pressable
                key={team}
                style={[jm.option, isFull && jm.optionDisabled]}
                onPress={() => !isFull && onJoin(team)}
                disabled={isFull || loading}
                accessibilityRole="button"
                accessibilityState={{ disabled: isFull }}>
                <Text style={[jm.optionLabel, isFull && jm.optionLabelDisabled]}>{label}</Text>
                <Text style={[jm.optionSlots, isFull && jm.optionLabelDisabled]}>
                  {isFull
                    ? 'Completo'
                    : `${slots} plaza${slots > 1 ? 's' : ''} libre${slots > 1 ? 's' : ''}`}
                </Text>
              </Pressable>
            )
          })}
          {loading ? <ActivityIndicator style={{ marginTop: 16 }} /> : null}
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const jm = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.textPrimary },
  close: { fontSize: 18, color: Colors.textSecondary, padding: 4 },
  body: { padding: 20 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: 16 },
  option: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionDisabled: { borderColor: Colors.border },
  optionLabel: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.primary },
  optionLabelDisabled: { color: Colors.textSecondary },
  optionSlots: { fontSize: 13, color: Colors.primary },
})

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MatchDetailScreen() {
  const { id, openResult, gamesA, gamesB } = useLocalSearchParams<{
    id: string
    openResult?: string
    gamesA?: string
    gamesB?: string
  }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const userId = useAuthStore((s) => s.session?.user.id)

  const closeToMyMatches = useCallback(() => {
    clearPendingMatchResultFromScoreboard(id)
    router.replace('/(tabs)/matches' as Href)
  }, [router, id])

  const { data: match, isLoading, isError, refetch: refetchMatch } = useMatch(id)
  const {
    data: resultBundle,
    isLoading: resultLoading,
    refetch: refetchResult,
  } = useMatchResult(id)

  useFocusEffect(
    useCallback(() => {
      void refetchMatch()
      void refetchResult()
    }, [refetchMatch, refetchResult])
  )
  const joinMatch = useJoinMatch()
  const grantAccess = useGrantMatchPasswordAccess()
  const leaveMatch = useLeaveMatch()
  const cancelMatch = useCancelMatch()
  const startMatch = useStartMatch()
  const updateMatchTeam = useUpdateMatchTeam()
  const submitResultMut = useSubmitResult()
  const submitConfirmationMut = useSubmitConfirmation()
  const recordResultDirectMut = useRecordMatchResultDirect()
  const recordRefereeMut = useRecordTournamentMatchAsReferee()

  const tournamentId = match?.tournament_id ?? null
  const { data: tournamentMeta } = useTournament(tournamentId ?? '')

  const [joinModalVisible, setJoinModalVisible] = useState(false)
  const [submitResultVisible, setSubmitResultVisible] = useState(false)
  const [recordResultVisible, setRecordResultVisible] = useState(false)
  const [recordRefereeVisible, setRecordRefereeVisible] = useState(false)
  const [disputeResultVisible, setDisputeResultVisible] = useState(false)
  const [approveResultVisible, setApproveResultVisible] = useState(false)
  const [cancelMatchVisible, setCancelMatchVisible] = useState(false)
  const [incompleteRosterStartVisible, setIncompleteRosterStartVisible] = useState(false)
  const [leaveMatchVisible, setLeaveMatchVisible] = useState(false)
  const [editTeamVisible, setEditTeamVisible] = useState(false)
  const [editingTeam, setEditingTeam] = useState<string | null>(null)
  const [passwordModalDismissed, setPasswordModalDismissed] = useState(false)

  const needsPrivateAccess = Boolean(
    match &&
    match.visibility === MATCH_VISIBILITY.PRIVATE &&
    match.viewer_has_full_access === false &&
    match.creator_id !== userId
  )
  const passwordModalVisible = needsPrivateAccess && !passwordModalDismissed
  const [reportModal, setReportModal] = useState<{
    targetType: ReportTargetType
    targetId: string
    targetLabel?: string
  } | null>(null)

  const scoreboardPrefill = useMemo(() => {
    const openFlag = Array.isArray(openResult) ? openResult[0] : openResult
    const rawA = Array.isArray(gamesA) ? gamesA[0] : gamesA
    const rawB = Array.isArray(gamesB) ? gamesB[0] : gamesB
    if (openFlag !== '1' || rawA == null || rawB == null) return null
    const parsedA = Number(rawA)
    const parsedB = Number(rawB)
    if (!Number.isFinite(parsedA) || !Number.isFinite(parsedB)) return null
    return { teamAGames: parsedA, teamBGames: parsedB, lockValues: true as const }
  }, [openResult, gamesA, gamesB])

  const [lockedScoreboardPrefill, setLockedScoreboardPrefill] = useState<{
    teamAGames: number
    teamBGames: number
    lockValues: true
  } | null>(null)

  const resultPrefill = lockedScoreboardPrefill ?? scoreboardPrefill

  const clearScoreboardAfterResult = async () => {
    clearPendingMatchResultFromScoreboard(id)
    await clearScoreboardState(id)
  }

  const dismissScoreboardResultFlow = useCallback(() => {
    const cameFromScoreboard = lockedScoreboardPrefill != null
    setSubmitResultVisible(false)
    setRecordResultVisible(false)
    setLockedScoreboardPrefill(null)
    clearPendingMatchResultFromScoreboard(id)
    if (cameFromScoreboard) void clearScoreboardState(id)
  }, [id, lockedScoreboardPrefill])

  useEffect(() => {
    if (!match) return
    if (submitResultVisible || recordResultVisible) return

    const matchId = Array.isArray(id) ? id[0] : id
    if (!matchId) return

    const pending = getPendingMatchResultFromScoreboard(matchId)
    const prefill = pending
      ? {
          teamAGames: pending.teamAGames,
          teamBGames: pending.teamBGames,
          lockValues: true as const,
        }
      : scoreboardPrefill

    if (!prefill) return

    // Persist intent across orientation remounts until the modal is dismissed/submitted.
    if (!pending) {
      setPendingMatchResultFromScoreboard({
        matchId,
        teamAGames: prefill.teamAGames,
        teamBGames: prefill.teamBGames,
      })
    }

    const active = match.participants.filter((p) => p.left_at === null)
    const myParticipation = active.find((p) => p.user_id === userId)
    const otherRegistered = active.filter((p) => p.user_id !== userId)
    const isPersonalMatch =
      !match.tournament_id && match.creator_id === userId && otherRegistered.length === 0

    const frame = requestAnimationFrame(() => {
      setLockedScoreboardPrefill(prefill)
      if (isPersonalMatch) setRecordResultVisible(true)
      else if (myParticipation) setSubmitResultVisible(true)
      if (scoreboardPrefill) {
        router.setParams({ openResult: undefined, gamesA: undefined, gamesB: undefined } as never)
      }
    })

    return () => cancelAnimationFrame(frame)
  }, [match, scoreboardPrefill, submitResultVisible, recordResultVisible, userId, id, router])

  if (isLoading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (isError || !match) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>No se pudo cargar la partida.</Text>
        <Button title="Volver" onPress={closeToMyMatches} style={{ marginTop: 16 }} />
      </View>
    )
  }

  const activeParticipants = match.participants.filter((p) => p.left_at === null)
  const myParticipation = activeParticipants.find((p) => p.user_id === userId)
  const isCreator = match.creator_id === userId
  const isParticipant = Boolean(myParticipation)
  const isPlanned = match.status === MATCH_STATUS.PLANNED
  const isInProgress = match.status === MATCH_STATUS.IN_PROGRESS
  const isCancelled = match.status === MATCH_STATUS.CANCELLED
  const canCancelMatch = isCreator && !isCancelled && (isPlanned || isInProgress)

  const slotsA = freeTeamSlots(match, match.participants, TEAM.A)
  const slotsB = freeTeamSlots(match, match.participants, TEAM.B)
  const hasSlots = slotsA > 0 || slotsB > 0
  const canJoin =
    isPlanned &&
    hasSlots &&
    !isParticipant &&
    !isCancelled &&
    !match.tournament_id &&
    !needsPrivateAccess
  const canLeave = isPlanned && isParticipant && !match.tournament_id

  const latestResult = resultBundle?.result ?? null
  const myResultConfirmation = resultBundle?.myConfirmation ?? null

  const resultBlocksNewSubmit =
    latestResult &&
    (latestResult.status === RESULT_STATUS.PENDING_VALIDATION ||
      latestResult.status === RESULT_STATUS.CONFIRMED)

  const otherRegistered = activeParticipants.filter((p) => p.user_id !== userId)
  const rivalHasRegisteredParticipants = activeParticipants.some(
    (p) => p.user_id && p.team !== myParticipation?.team
  )
  const isPersonalMatch = !match.tournament_id && isCreator && otherRegistered.length === 0

  const canSubmitResult = Boolean(
    userId &&
    myParticipation &&
    !isPersonalMatch &&
    match.status !== MATCH_STATUS.CANCELLED &&
    (match.status === MATCH_STATUS.IN_PROGRESS ||
      match.status === MATCH_STATUS.FINISHED_NO_RESULT) &&
    !resultBlocksNewSubmit
  )

  const canRecordDirect = Boolean(
    userId && isPersonalMatch && isInProgress && !resultBlocksNewSubmit && !match.tournament_id
  )

  // También permitimos llevar la cuenta en partidos de torneos (no durante validación de resultado).
  const canOpenScoreboard = Boolean(
    userId && isParticipant && isInProgress && !resultBlocksNewSubmit
  )

  const allTextPlayers =
    activeParticipants.length === 0 &&
    Boolean(
      match.team_a_player_1?.trim() ||
      match.team_a_player_2?.trim() ||
      match.team_b_player_1?.trim() ||
      match.team_b_player_2?.trim()
    )

  const canRecordAsReferee = Boolean(
    userId &&
    match.tournament_id &&
    tournamentMeta?.creator_id === userId &&
    allTextPlayers &&
    isInProgress &&
    !resultBlocksNewSubmit &&
    !match.tournament_is_bye
  )

  const canValidateResult = Boolean(
    userId &&
    myParticipation &&
    latestResult?.status === RESULT_STATUS.PENDING_VALIDATION &&
    myParticipation.team !== latestResult.submitted_by_team &&
    !myResultConfirmation
  )

  const awaitingRivalValidation = Boolean(
    latestResult?.status === RESULT_STATUS.PENDING_VALIDATION &&
    myParticipation?.team === latestResult.submitted_by_team
  )

  const status = matchStatusDisplay(match)
  const teamAName = resolveTeamName(match, TEAM.A, match.participants)
  const teamBName = resolveTeamName(match, TEAM.B, match.participants)

  const { canEdit: canEditTeam, teams: editableTeams } = canEditMatchTeam(
    match,
    match.participants,
    userId
  )
  const canEditTeamA = canEditTeam && editableTeams.includes(TEAM.A)
  const canEditTeamB = canEditTeam && editableTeams.includes(TEAM.B)
  const editTeamSlots =
    editingTeam && canEditTeam && editableTeams.includes(editingTeam)
      ? buildMatchTeamEditSlots(
          {
            team_a_player_1: match.team_a_player_1,
            team_a_player_2: match.team_a_player_2,
            team_b_player_1: match.team_b_player_1,
            team_b_player_2: match.team_b_player_2,
          },
          match.participants,
          editingTeam
        )
      : []
  const editTeamLabel = editingTeam === TEAM.B ? teamBName : editingTeam === TEAM.A ? teamAName : ''
  const editCustomTeamName =
    editingTeam &&
    !isUnspecifiedTeamName(
      editingTeam === TEAM.B ? match.team_b_name : match.team_a_name,
      editingTeam
    )
      ? (editingTeam === TEAM.B ? match.team_b_name : match.team_a_name).trim()
      : ''

  const openEditTeam = (team: string) => {
    setEditingTeam(team)
    setEditTeamVisible(true)
  }

  const closeEditTeam = () => {
    setEditTeamVisible(false)
    setEditingTeam(null)
  }

  const handleEditTeam = async (values: EditMatchTeamFormValues) => {
    if (!editingTeam) return

    const rosterText = {
      team_a_player_1: match.team_a_player_1,
      team_a_player_2: match.team_a_player_2,
      team_b_player_1: match.team_b_player_1,
      team_b_player_2: match.team_b_player_2,
    }

    const draftText = { ...rosterText }
    for (const slot of editTeamSlots) {
      if (slot.kind === 'text') {
        draftText[slot.field] = values.textByField[slot.field]?.trim() || null
      }
    }

    const editableFields = editableTextSlotsForTeam(match.participants, editingTeam, draftText)
    const textUpdates: Partial<Record<keyof typeof draftText, string | null>> = {}
    for (const field of editableFields) {
      const newVal = values.textByField[field]?.trim() || null
      const oldVal = rosterText[field]?.trim() || null
      if (oldVal && !newVal) {
        Alert.alert(
          'Nombre obligatorio',
          'No puedes quitar jugadores de la pareja. Solo puedes editar el nombre.'
        )
        return
      }
      if (newVal !== oldVal) {
        textUpdates[field] = newVal
      }
    }

    const mergedText = { ...rosterText, ...textUpdates }
    const rosterError = validateTextRosterCapacity(match.participants, mergedText, match)
    if (rosterError) {
      Alert.alert('Plantilla completa', rosterError)
      return
    }

    try {
      await updateMatchTeam.mutateAsync({
        matchId: id,
        team: editingTeam,
        teamName: values.teamName,
        textUpdates,
      })
      closeEditTeam()
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar la pareja')
      throw err
    }
  }

  const handleJoin = async (team: string) => {
    if (!userId) return
    try {
      await joinMatch.mutateAsync({ matchId: id, userId, team })
      setJoinModalVisible(false)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo unir a la partida')
    }
  }

  const handleGrantAccess = async (password: string) => {
    await grantAccess.mutateAsync({ matchId: id, password })
    setPasswordModalDismissed(true)
    await refetchMatch()
  }

  const handleConfirmLeave = async () => {
    if (!userId) return
    await leaveMatch.mutateAsync({ matchId: id, userId })
  }

  const handleSubmitScores = async (payload: { teamAGames: number; teamBGames: number }) => {
    if (!userId || !myParticipation) return
    try {
      await submitResultMut.mutateAsync({
        matchId: id,
        submittedByUserId: userId,
        submittedByTeam: myParticipation.team,
        teamAGames: payload.teamAGames,
        teamBGames: payload.teamBGames,
      })
      await clearScoreboardAfterResult()
      setSubmitResultVisible(false)
      setLockedScoreboardPrefill(null)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo registrar el resultado')
    }
  }

  const handleRecordDirect = async (payload: { teamAGames: number; teamBGames: number }) => {
    if (!userId) return
    try {
      await recordResultDirectMut.mutateAsync({
        matchId: id,
        teamAGames: payload.teamAGames,
        teamBGames: payload.teamBGames,
      })
      await clearScoreboardAfterResult()
      setRecordResultVisible(false)
      setLockedScoreboardPrefill(null)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo registrar el marcador')
    }
  }

  const handleRecordAsReferee = async (payload: { teamAGames: number; teamBGames: number }) => {
    if (!userId || !match.tournament_id) return
    try {
      await recordRefereeMut.mutateAsync({
        matchId: id,
        tournamentId: match.tournament_id,
        teamAGames: payload.teamAGames,
        teamBGames: payload.teamBGames,
      })
      setRecordRefereeVisible(false)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo registrar el resultado')
    }
  }

  const handleApproveResult = async () => {
    if (!userId || !myParticipation || !latestResult) return
    try {
      await submitConfirmationMut.mutateAsync({
        matchId: id,
        matchResultId: latestResult.id,
        userId,
        team: myParticipation.team,
        decision: 'approve',
      })
      setApproveResultVisible(false)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo confirmar')
    }
  }

  const handleApproveResultPress = () => setApproveResultVisible(true)

  const handleDisputeResult = async (comment: string | null) => {
    if (!userId || !myParticipation || !latestResult) return
    try {
      await submitConfirmationMut.mutateAsync({
        matchId: id,
        matchResultId: latestResult.id,
        userId,
        team: myParticipation.team,
        decision: 'dispute',
        comment,
      })
      setDisputeResultVisible(false)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo registrar la disputa')
    }
  }

  const handleConfirmCancelMatch = async () => {
    await cancelMatch.mutateAsync(id)
  }

  const handleConfirmStartMatch = async () => {
    if (!isRosterFull(match, match.participants)) {
      setIncompleteRosterStartVisible(true)
      return
    }
    try {
      await startMatch.mutateAsync(id)
    } catch (err) {
      await refetchMatch()
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo empezar la partida')
    }
  }

  return (
    <>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled">
        <View style={[s.closeBar, { paddingTop: screenTopPadding(insets.top, 8) }]}>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={closeToMyMatches}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar">
            <Text style={s.closeX}>✕</Text>
          </Pressable>
        </View>

        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.headerText}>
            <Text style={s.title}>{match.title}</Text>
            <View style={[s.statusBadge, { borderColor: status.color }]}>
              <Text style={[s.statusText, { color: status.color }]}>{status.text}</Text>
            </View>
            {match.tournament_id && tournamentMeta ? (
              <Pressable
                onPress={() => router.push(`/(tabs)/tournaments/${match.tournament_id}` as Href)}
                style={({ pressed }) => [s.tournamentBadge, pressed && s.tournamentBadgePressed]}
                accessibilityRole="button"
                accessibilityLabel={`Ir al torneo: ${tournamentMeta.title}`}>
                <Text style={s.tournamentBadgeText}>🏆 Ir al torneo</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Info block */}
        <View style={s.infoBlock}>
          <InfoRow icon="📅" text={formatDate(match.start_at)} />
          <InfoRow icon="📍" text={match.city} />
          {match.place_defined && match.place_text ? (
            <InfoRow icon="🏠" text={match.place_text} />
          ) : !match.place_defined ? (
            <InfoRow icon="🏠" text="Lugar por definir" muted />
          ) : null}
          <InfoRow
            icon="🃏"
            text={`${match.duration_target_games} juego${match.duration_target_games > 1 ? 's' : ''}`}
          />
          <InfoRow
            icon="👁️"
            text={
              match.visibility === MATCH_VISIBILITY.PRIVATE
                ? 'Partida privada (con contraseña)'
                : match.visibility === MATCH_VISIBILITY.PUBLIC
                  ? 'Partida pública'
                  : 'Solo con enlace'
            }
          />
        </View>

        {!needsPrivateAccess ? (
          <ShareInviteButton
            kind="match"
            id={id}
            title={match.title}
            meta={`${match.city} · ${formatDate(match.start_at)}`}
            style={s.shareBtn}
          />
        ) : null}

        {/* Description */}
        {match.description ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Descripción</Text>
            <Text style={s.descText}>{match.description}</Text>
          </View>
        ) : null}

        {/* Participants */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Participantes</Text>
          {needsPrivateAccess ? (
            <>
              <Text style={s.privateGateText}>
                Introduce la contraseña para unirte y ver el plantel.
              </Text>
              <Button
                title="Introducir contraseña"
                onPress={() => setPasswordModalDismissed(false)}
                style={s.privateGateBtn}
              />
            </>
          ) : (
            <>
              <TeamSection
                team={TEAM.A}
                teamLabel={teamAName}
                freeSlots={slotsA}
                participants={match.participants}
                rosterText={{
                  team_a_player_1: match.team_a_player_1,
                  team_a_player_2: match.team_a_player_2,
                  team_b_player_1: match.team_b_player_1,
                  team_b_player_2: match.team_b_player_2,
                }}
                matchId={id}
                canRevealPhone={Boolean(myParticipation)}
                currentUserId={userId}
                onReportUser={
                  isParticipant
                    ? (reportedUserId, displayName) =>
                        setReportModal({
                          targetType: 'user',
                          targetId: reportedUserId,
                          targetLabel: displayName,
                        })
                    : undefined
                }
                editLabel={canEditTeamA ? 'Editar' : undefined}
                onEdit={canEditTeamA ? () => openEditTeam(TEAM.A) : undefined}
              />
              <TeamSection
                team={TEAM.B}
                teamLabel={teamBName}
                freeSlots={slotsB}
                participants={match.participants}
                rosterText={{
                  team_a_player_1: match.team_a_player_1,
                  team_a_player_2: match.team_a_player_2,
                  team_b_player_1: match.team_b_player_1,
                  team_b_player_2: match.team_b_player_2,
                }}
                matchId={id}
                canRevealPhone={Boolean(myParticipation)}
                currentUserId={userId}
                onReportUser={
                  isParticipant
                    ? (reportedUserId, displayName) =>
                        setReportModal({
                          targetType: 'user',
                          targetId: reportedUserId,
                          targetLabel: displayName,
                        })
                    : undefined
                }
                editLabel={canEditTeamB ? 'Editar' : undefined}
                onEdit={canEditTeamB ? () => openEditTeam(TEAM.B) : undefined}
              />
            </>
          )}
        </View>

        {/* Resultado (F7) */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Resultado</Text>
          {!userId ? (
            <Text style={s.resultEmpty}>Inicia sesión para ver o registrar resultados.</Text>
          ) : resultLoading ? (
            <ActivityIndicator style={{ marginVertical: 12 }} />
          ) : latestResult ? (
            <ResultCard result={latestResult} teamAName={teamAName} teamBName={teamBName} />
          ) : (
            <Text style={s.resultEmpty}>Aún no hay resultado registrado.</Text>
          )}
          {isCancelled ? (
            <Text style={s.resultHint}>
              Esta partida ha sido cancelada. No hay resultado oficial.
            </Text>
          ) : null}
          {latestResult?.status === RESULT_STATUS.DISPUTED ? (
            <Text style={s.resultHint}>
              El resultado está en disputa. Podéis registrar un nuevo resultado.
            </Text>
          ) : null}
          {awaitingRivalValidation ? (
            <Text style={s.resultHint}>Esperando la validación del equipo contrario.</Text>
          ) : null}
          {latestResult?.status === RESULT_STATUS.CONFIRMED &&
          match.status === MATCH_STATUS.FINISHED ? (
            <Text style={s.resultHint}>Partida cerrada con resultado confirmado.</Text>
          ) : null}
        </View>

        {/* Actions */}
        <View style={s.actions}>
          {canJoin ? (
            <Button
              title="Unirse a la partida"
              onPress={() => setJoinModalVisible(true)}
              style={s.actionBtn}
            />
          ) : null}

          {canLeave ? (
            <Button
              title="Abandonar partida"
              onPress={() => setLeaveMatchVisible(true)}
              loading={leaveMatch.isPending}
              style={s.actionBtn}
            />
          ) : null}

          {isCreator && isPlanned ? (
            <Button
              title="Editar partida"
              onPress={() => router.push(`/(tabs)/matches/edit/${id}`)}
              style={s.actionBtn}
            />
          ) : null}

          {isCreator && isPlanned ? (
            <Button
              title="Empezar partida"
              onPress={() => void handleConfirmStartMatch()}
              loading={startMatch.isPending}
              style={s.actionBtn}
            />
          ) : null}

          {canCancelMatch && isPlanned ? (
            <Button
              title="Cancelar partida"
              onPress={() => setCancelMatchVisible(true)}
              variant="danger"
              style={s.actionBtn}
            />
          ) : null}

          {canSubmitResult ? (
            <Button
              title="Registrar resultado"
              onPress={() => setSubmitResultVisible(true)}
              style={s.actionBtn}
            />
          ) : null}

          {canRecordDirect ? (
            <Button
              title="Registrar resultado"
              onPress={() => setRecordResultVisible(true)}
              style={s.actionBtn}
            />
          ) : null}

          {canOpenScoreboard ? (
            <Button
              title="Marcador"
              onPress={() => {
                prefetchOrientationLock(ScreenOrientation.OrientationLock.LANDSCAPE)
                router.push(`/(tabs)/matches/scoreboard/${id}` as Href)
              }}
              style={s.actionBtn}
            />
          ) : null}

          {canCancelMatch && isInProgress ? (
            <Button
              title="Cancelar partida"
              onPress={() => setCancelMatchVisible(true)}
              variant="danger"
              style={s.actionBtn}
            />
          ) : null}

          {canRecordAsReferee ? (
            <Button
              title="Registrar resultado como árbitro"
              onPress={() => setRecordRefereeVisible(true)}
              style={s.actionBtn}
            />
          ) : null}

          {canValidateResult ? (
            <>
              <Button
                title="Aprobar resultado"
                onPress={handleApproveResultPress}
                style={s.actionBtn}
              />
              <Button
                title="Disputar resultado"
                variant="secondary"
                onPress={() => {
                  setApproveResultVisible(false)
                  setDisputeResultVisible(true)
                }}
                style={s.actionBtn}
              />
            </>
          ) : null}
        </View>

        {userId && !isCreator ? (
          <View style={s.reportMatchRow}>
            <Pressable
              onPress={() =>
                setReportModal({
                  targetType: 'match',
                  targetId: id,
                  targetLabel: match.title,
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Reportar esta partida">
              <Text style={s.reportMatchLink}>Reportar partida</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <JoinModal
        visible={joinModalVisible}
        onClose={() => setJoinModalVisible(false)}
        onJoin={handleJoin}
        slotsA={slotsA}
        slotsB={slotsB}
        teamAName={teamAName}
        teamBName={teamBName}
        loading={joinMatch.isPending}
      />

      <CancelMatchModal
        visible={cancelMatchVisible}
        onClose={() => setCancelMatchVisible(false)}
        inProgress={isInProgress}
        loading={cancelMatch.isPending}
        onConfirm={handleConfirmCancelMatch}
      />

      <IncompleteRosterStartModal
        visible={incompleteRosterStartVisible}
        onClose={() => setIncompleteRosterStartVisible(false)}
      />

      <LeaveMatchModal
        visible={leaveMatchVisible}
        onClose={() => setLeaveMatchVisible(false)}
        loading={leaveMatch.isPending}
        onConfirm={handleConfirmLeave}
      />

      <EditMatchTeamModal
        visible={editTeamVisible}
        teamLabel={editTeamLabel}
        customTeamName={editCustomTeamName}
        slots={editTeamSlots}
        onClose={closeEditTeam}
        onSubmit={handleEditTeam}
        loading={updateMatchTeam.isPending}
      />

      <MatchPasswordModal
        visible={passwordModalVisible}
        onClose={() => setPasswordModalDismissed(true)}
        onSubmit={(password) => handleGrantAccess(password)}
        accessOnly
        title="Acceso a partida privada"
        hint="Introduce la contraseña para ver la partida. Después podrás unirte con el botón de abajo."
        isLoading={grantAccess.isPending}
      />

      {myParticipation ? (
        <SubmitResultModal
          visible={submitResultVisible}
          onClose={dismissScoreboardResultFlow}
          viewerTeamLabel={resolveTeamName(match, myParticipation.team, match.participants)}
          teamAName={teamAName}
          teamBName={teamBName}
          durationTargetGames={match.duration_target_games}
          rivalAutoConfirms={!rivalHasRegisteredParticipants}
          loading={submitResultMut.isPending}
          initialTeamAGames={resultPrefill?.teamAGames}
          initialTeamBGames={resultPrefill?.teamBGames}
          lockValues={resultPrefill?.lockValues}
          onSubmit={handleSubmitScores}
        />
      ) : null}

      <RecordResultModal
        visible={recordResultVisible}
        onClose={dismissScoreboardResultFlow}
        teamAName={teamAName}
        teamBName={teamBName}
        durationTargetGames={match.duration_target_games}
        hint="Partida personal: el marcador queda confirmado al guardar (sin validación del rival)."
        loading={recordResultDirectMut.isPending}
        initialTeamAGames={resultPrefill?.teamAGames}
        initialTeamBGames={resultPrefill?.teamBGames}
        lockValues={resultPrefill?.lockValues}
        onSubmit={handleRecordDirect}
      />

      <RecordResultModal
        visible={recordRefereeVisible}
        onClose={() => setRecordRefereeVisible(false)}
        teamAName={teamAName}
        teamBName={teamBName}
        durationTargetGames={match.duration_target_games}
        hint="Como organizador del torneo, el marcador queda confirmado al guardar."
        submitLabel="Confirmar marcador"
        loading={recordRefereeMut.isPending}
        onSubmit={handleRecordAsReferee}
      />

      {latestResult && myParticipation ? (
        <>
          <ApproveResultModal
            visible={approveResultVisible}
            onClose={() => setApproveResultVisible(false)}
            teamAScore={latestResult.team_a_games}
            teamBScore={latestResult.team_b_games}
            teamAName={teamAName}
            teamBName={teamBName}
            submitterDisplayName={submitterDisplayName(
              match.participants,
              latestResult.submitted_by_user_id
            )}
            loading={submitConfirmationMut.isPending}
            onConfirm={() => void handleApproveResult()}
          />
          <DisputeResultModal
            visible={disputeResultVisible}
            onClose={() => setDisputeResultVisible(false)}
            teamAScore={latestResult.team_a_games}
            teamBScore={latestResult.team_b_games}
            teamAName={teamAName}
            teamBName={teamBName}
            submitterDisplayName={submitterDisplayName(
              match.participants,
              latestResult.submitted_by_user_id
            )}
            loading={submitConfirmationMut.isPending}
            onDispute={handleDisputeResult}
          />
        </>
      ) : null}

      {reportModal ? (
        <ReportModal
          visible
          onClose={() => setReportModal(null)}
          targetType={reportModal.targetType}
          targetId={reportModal.targetId}
          targetLabel={reportModal.targetLabel}
        />
      ) : null}
    </>
  )
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────

function InfoRow({ icon, text, muted }: { icon: string; text: string; muted?: boolean }) {
  return (
    <View style={ir.row}>
      <Text style={ir.icon}>{icon}</Text>
      <Text style={[ir.text, muted && ir.textMuted]}>{text}</Text>
    </View>
  )
}

const ir = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  icon: { fontSize: 15, marginRight: 8, marginTop: 1 },
  text: { flex: 1, fontSize: 15, color: Colors.textPrimary },
  textMuted: { color: Colors.textSecondary, fontStyle: 'italic' },
})

const s = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
  scroll: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 20, paddingBottom: 40 },
  closeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginHorizontal: -4,
  },
  closeX: { fontSize: 22, color: Colors.textSecondary, padding: 8 },
  headerRow: { marginBottom: 16 },
  headerText: { gap: 8 },
  title: { fontSize: 22, fontFamily: Fonts.bold, color: Colors.textPrimary },
  statusBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: { fontSize: 12, fontFamily: Fonts.semiBold },
  tournamentBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.wonBackground,
  },
  tournamentBadgePressed: { opacity: 0.85 },
  tournamentBadgeText: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.primary },
  infoBlock: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  descText: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
  resultEmpty: { fontSize: 14, color: Colors.textSecondary, fontStyle: 'italic' },
  resultHint: { fontSize: 14, color: Colors.textSecondary, marginTop: 10, lineHeight: 20 },
  privateGateText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  privateGateBtn: { alignSelf: 'flex-start' },
  actions: { gap: 10 },
  actionBtn: {},
  shareBtn: { marginBottom: 20 },
  reportMatchRow: { alignItems: 'center', marginTop: 8, marginBottom: 8 },
  reportMatchLink: {
    fontSize: 14,
    color: Colors.danger,
    fontFamily: Fonts.semiBold,
    textDecorationLine: 'underline',
  },
})
