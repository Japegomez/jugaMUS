import { useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
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

import { DisputeResultModal } from '@/components/matches/DisputeResultModal'
import { ResultCard } from '@/components/matches/ResultCard'
import { SubmitResultModal } from '@/components/matches/SubmitResultModal'
import { Button } from '@/components/ui/Button'
import { ReportModal } from '@/components/ui/ReportModal'
import { useAuthStore } from '@/hooks/useAuth'
import { useCancelMatch, useJoinMatch, useLeaveMatch, useMatch } from '@/hooks/useMatches'
import { useMatchResult, useSubmitConfirmation, useSubmitResult } from '@/hooks/useResults'
import { getParticipantProfile } from '@/services/matches.service'
import type { ParticipantProfile, ParticipantWithProfile } from '@/services/matches.service'
import type { ReportTargetType } from '@/services/reports.service'
import {
  MATCH_STATUS,
  MATCH_VISIBILITY,
  MAX_PLAYERS_PER_TEAM,
  RESULT_STATUS,
  TEAM,
} from '@/constants'

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
  return p?.profile.display_name ?? 'Jugador'
}

function statusLabel(status: string) {
  switch (status) {
    case MATCH_STATUS.PLANNED:
      return { text: 'Planificada', color: '#1a5f4a' }
    case MATCH_STATUS.IN_PROGRESS:
      return { text: 'En curso', color: '#c07000' }
    case MATCH_STATUS.FINISHED:
      return { text: 'Finalizada', color: '#555' }
    case MATCH_STATUS.FINISHED_NO_RESULT:
      return { text: 'Sin resultado', color: '#999' }
    case MATCH_STATUS.CANCELLED:
      return { text: 'Cancelada', color: '#b00020' }
    default:
      return { text: status, color: '#888' }
  }
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
  const [fullProfile, setFullProfile] = useState<ParticipantProfile | null>(null)
  const [loading, setLoading] = useState(false)

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

  const p = participant.profile

  return (
    <View style={card.wrap}>
      {p.photo_url ? (
        <Image source={{ uri: p.photo_url }} style={card.avatar} />
      ) : (
        <View style={card.avatarPlaceholder}>
          <Text style={card.avatarInitial}>{p.display_name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={card.info}>
        <Text style={card.name}>{p.display_name}</Text>
        {p.city ? <Text style={card.city}>{p.city}</Text> : null}
        {canRevealPhone && (
          <>
            {fullProfile?.phone_e164 ? (
              <Text style={card.phone}>{fullProfile.phone_e164}</Text>
            ) : (
              <Pressable onPress={handleRevealPhone} disabled={loading}>
                <Text style={card.revealPhone}>{loading ? 'Cargando...' : 'Ver teléfono'}</Text>
              </Pressable>
            )}
          </>
        )}
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
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a5f4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 16, fontWeight: '700' },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  city: { fontSize: 12, color: '#888', marginTop: 1 },
  phone: { fontSize: 13, color: '#1a5f4a', marginTop: 3, fontWeight: '500' },
  revealPhone: {
    fontSize: 13,
    color: '#007AFF',
    marginTop: 3,
    textDecorationLine: 'underline',
  },
  reportBtn: { marginTop: 8, alignSelf: 'flex-start' },
  reportText: { fontSize: 13, color: '#b00020', fontWeight: '600' },
})

// ─── Team section ─────────────────────────────────────────────────────────────

interface TeamSectionProps {
  team: string
  participants: ParticipantWithProfile[]
  matchId: string
  canRevealPhone: boolean
  currentUserId?: string
  onReportUser?: (userId: string, displayName: string) => void
}

function TeamSection({
  team,
  participants,
  matchId,
  canRevealPhone,
  currentUserId,
  onReportUser,
}: TeamSectionProps) {
  const active = participants.filter((p) => p.team === team && p.left_at === null)
  const slots = MAX_PLAYERS_PER_TEAM - active.length

  return (
    <View style={team_s.wrap}>
      <View style={team_s.header}>
        <Text style={team_s.title}>Equipo {team}</Text>
        <Text style={team_s.slots}>
          {slots > 0
            ? `${slots} plaza${slots > 1 ? 's' : ''} libre${slots > 1 ? 's' : ''}`
            : 'Completo'}
        </Text>
      </View>
      {active.length === 0 ? (
        <Text style={team_s.empty}>Sin jugadores aún</Text>
      ) : (
        active.map((p) => (
          <ParticipantCard
            key={p.id}
            participant={p}
            matchId={matchId}
            canRevealPhone={canRevealPhone}
            currentUserId={currentUserId}
            onReportUser={onReportUser}
          />
        ))
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
  title: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  slots: { fontSize: 13, color: '#888' },
  empty: { fontSize: 14, color: '#bbb', paddingVertical: 8 },
})

// ─── Join Modal ───────────────────────────────────────────────────────────────

interface JoinModalProps {
  visible: boolean
  onClose: () => void
  onJoin: (team: string) => void
  slotsA: number
  slotsB: number
  loading: boolean
}

function JoinModal({ visible, onClose, onJoin, slotsA, slotsB, loading }: JoinModalProps) {
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
            const isFull = slots === 0
            return (
              <Pressable
                key={team}
                style={[jm.option, isFull && jm.optionDisabled]}
                onPress={() => !isFull && onJoin(team)}
                disabled={isFull || loading}
                accessibilityRole="button"
                accessibilityState={{ disabled: isFull }}>
                <Text style={[jm.optionLabel, isFull && jm.optionLabelDisabled]}>
                  Equipo {team}
                </Text>
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
  wrap: { flex: 1, backgroundColor: '#f6f7f4' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  close: { fontSize: 18, color: '#555', padding: 4 },
  body: { padding: 20 },
  subtitle: { fontSize: 15, color: '#555', marginBottom: 16 },
  option: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#1a5f4a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionDisabled: { borderColor: '#ddd' },
  optionLabel: { fontSize: 17, fontWeight: '700', color: '#1a5f4a' },
  optionLabelDisabled: { color: '#bbb' },
  optionSlots: { fontSize: 13, color: '#2a8f6f' },
})

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const userId = useAuthStore((s) => s.session?.user.id)

  const { data: match, isLoading, isError } = useMatch(id)
  const { data: resultBundle, isLoading: resultLoading } = useMatchResult(id)
  const joinMatch = useJoinMatch()
  const leaveMatch = useLeaveMatch()
  const cancelMatch = useCancelMatch()
  const submitResultMut = useSubmitResult()
  const submitConfirmationMut = useSubmitConfirmation()

  const [joinModalVisible, setJoinModalVisible] = useState(false)
  const [submitResultVisible, setSubmitResultVisible] = useState(false)
  const [disputeResultVisible, setDisputeResultVisible] = useState(false)
  const [reportModal, setReportModal] = useState<{
    targetType: ReportTargetType
    targetId: string
    targetLabel?: string
  } | null>(null)

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
        <Button title="Volver" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </View>
    )
  }

  const activeParticipants = match.participants.filter((p) => p.left_at === null)
  const myParticipation = activeParticipants.find((p) => p.user_id === userId)
  const isCreator = match.creator_id === userId
  const isParticipant = Boolean(myParticipation)
  const isPlanned = match.status === MATCH_STATUS.PLANNED
  const isCancelled = match.status === MATCH_STATUS.CANCELLED

  const slotsA = MAX_PLAYERS_PER_TEAM - activeParticipants.filter((p) => p.team === TEAM.A).length
  const slotsB = MAX_PLAYERS_PER_TEAM - activeParticipants.filter((p) => p.team === TEAM.B).length
  const hasSlots = slotsA > 0 || slotsB > 0
  /** Creator is not auto-added as participant; they must join like anyone else if they want a seat. */
  const canJoin = isPlanned && hasSlots && !isParticipant && !isCancelled
  const canLeave = isPlanned && isParticipant

  const latestResult = resultBundle?.result ?? null
  const myResultConfirmation = resultBundle?.myConfirmation ?? null

  const resultBlocksNewSubmit =
    latestResult &&
    (latestResult.status === RESULT_STATUS.PENDING_VALIDATION ||
      latestResult.status === RESULT_STATUS.CONFIRMED)

  const canSubmitResult = Boolean(
    userId &&
    myParticipation &&
    match.status !== MATCH_STATUS.CANCELLED &&
    (match.status === MATCH_STATUS.IN_PROGRESS ||
      match.status === MATCH_STATUS.FINISHED_NO_RESULT) &&
    !resultBlocksNewSubmit
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

  const status = statusLabel(match.status)

  const handleJoin = async (team: string) => {
    if (!userId) return
    try {
      await joinMatch.mutateAsync({ matchId: id, userId, team })
      setJoinModalVisible(false)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo unir a la partida')
    }
  }

  const handleLeave = () => {
    if (!userId) return
    Alert.alert('Abandonar partida', '¿Seguro que quieres abandonar esta partida?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Abandonar',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveMatch.mutateAsync({ matchId: id, userId })
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo abandonar')
          }
        },
      },
    ])
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
      setSubmitResultVisible(false)
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
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo confirmar')
    }
  }

  const handleApproveResultPress = () => {
    Alert.alert('Aprobar resultado', '¿Confirmas que el marcador mostrado es correcto?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, aprobar',
        onPress: () => void handleApproveResult(),
      },
    ])
  }

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

  const handleCancel = () => {
    Alert.alert(
      'Cancelar partida',
      '¿Seguro que quieres cancelar esta partida? Esta acción no se puede deshacer.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelMatch.mutateAsync(id)
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo cancelar')
            }
          },
        },
      ]
    )
  }

  return (
    <>
      <ScrollView style={s.scroll} contentContainerStyle={s.container}>
        <View style={[s.closeBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => router.back()}
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
              match.visibility === MATCH_VISIBILITY.PUBLIC ? 'Partida pública' : 'Solo con enlace'
            }
          />
        </View>

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
          <TeamSection
            team={TEAM.A}
            participants={match.participants}
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
          />
          <TeamSection
            team={TEAM.B}
            participants={match.participants}
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
          />
        </View>

        {/* Resultado (F7) */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Resultado</Text>
          {!userId ? (
            <Text style={s.resultEmpty}>Inicia sesión para ver o registrar resultados.</Text>
          ) : resultLoading ? (
            <ActivityIndicator style={{ marginVertical: 12 }} />
          ) : latestResult ? (
            <ResultCard result={latestResult} />
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
              onPress={handleLeave}
              loading={leaveMatch.isPending}
              variant="secondary"
              style={s.actionBtn}
            />
          ) : null}

          {isCreator && isPlanned ? (
            <>
              <Button
                title="Editar partida"
                onPress={() => router.push(`/(tabs)/matches/edit/${id}`)}
                variant="secondary"
                style={s.actionBtn}
              />
              <Button
                title="Cancelar partida"
                onPress={handleCancel}
                loading={cancelMatch.isPending}
                variant="danger"
                style={s.actionBtn}
              />
            </>
          ) : null}

          {canSubmitResult ? (
            <Button
              title="Registrar resultado"
              onPress={() => setSubmitResultVisible(true)}
              style={s.actionBtn}
            />
          ) : null}

          {canValidateResult ? (
            <>
              <Button
                title="Aprobar resultado"
                onPress={handleApproveResultPress}
                loading={submitConfirmationMut.isPending}
                style={s.actionBtn}
              />
              <Button
                title="Disputar resultado"
                variant="secondary"
                onPress={() => setDisputeResultVisible(true)}
                loading={submitConfirmationMut.isPending}
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
        loading={joinMatch.isPending}
      />

      {myParticipation ? (
        <SubmitResultModal
          visible={submitResultVisible}
          onClose={() => setSubmitResultVisible(false)}
          viewerTeam={myParticipation.team}
          loading={submitResultMut.isPending}
          onSubmit={handleSubmitScores}
        />
      ) : null}

      {latestResult && myParticipation ? (
        <DisputeResultModal
          visible={disputeResultVisible}
          onClose={() => setDisputeResultVisible(false)}
          teamAScore={latestResult.team_a_games}
          teamBScore={latestResult.team_b_games}
          submitterDisplayName={submitterDisplayName(
            match.participants,
            latestResult.submitted_by_user_id
          )}
          loading={submitConfirmationMut.isPending}
          onDispute={handleDisputeResult}
        />
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
  text: { flex: 1, fontSize: 15, color: '#1a1a1a' },
  textMuted: { color: '#999', fontStyle: 'italic' },
})

const s = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontSize: 16, color: '#888', textAlign: 'center' },
  scroll: { flex: 1, backgroundColor: '#f6f7f4' },
  container: { padding: 20, paddingBottom: 40 },
  closeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginHorizontal: -4,
  },
  closeX: { fontSize: 22, color: '#555', padding: 8 },
  headerRow: { marginBottom: 16 },
  headerText: { gap: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  statusBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  infoBlock: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  descText: { fontSize: 15, color: '#444', lineHeight: 22 },
  resultEmpty: { fontSize: 14, color: '#999', fontStyle: 'italic' },
  resultHint: { fontSize: 14, color: '#555', marginTop: 10, lineHeight: 20 },
  actions: { gap: 10 },
  actionBtn: {},
  reportMatchRow: { alignItems: 'center', marginTop: 8, marginBottom: 8 },
  reportMatchLink: {
    fontSize: 14,
    color: '#b00020',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
})
