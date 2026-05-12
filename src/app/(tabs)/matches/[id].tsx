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

import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/hooks/useAuth'
import { useCancelMatch, useJoinMatch, useLeaveMatch, useMatch } from '@/hooks/useMatches'
import { getParticipantProfile } from '@/services/matches.service'
import type { ParticipantProfile, ParticipantWithProfile } from '@/services/matches.service'
import { MATCH_STATUS, MATCH_VISIBILITY, MAX_PLAYERS_PER_TEAM, TEAM } from '@/constants'

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
    default:
      return { text: status, color: '#888' }
  }
}

// ─── Participant card ─────────────────────────────────────────────────────────

interface ParticipantCardProps {
  participant: ParticipantWithProfile
  matchId: string
  isViewerParticipant: boolean
}

function ParticipantCard({ participant, matchId, isViewerParticipant }: ParticipantCardProps) {
  const [fullProfile, setFullProfile] = useState<ParticipantProfile | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRevealPhone = async () => {
    if (!isViewerParticipant) return
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
        {isViewerParticipant && (
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
})

// ─── Team section ─────────────────────────────────────────────────────────────

interface TeamSectionProps {
  team: string
  participants: ParticipantWithProfile[]
  matchId: string
  isViewerParticipant: boolean
}

function TeamSection({ team, participants, matchId, isViewerParticipant }: TeamSectionProps) {
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
            isViewerParticipant={isViewerParticipant}
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
  const userId = useAuthStore((s) => s.session?.user.id)

  const { data: match, isLoading, isError } = useMatch(id)
  const joinMatch = useJoinMatch()
  const leaveMatch = useLeaveMatch()
  const cancelMatch = useCancelMatch()

  const [joinModalVisible, setJoinModalVisible] = useState(false)

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

  const slotsA = MAX_PLAYERS_PER_TEAM - activeParticipants.filter((p) => p.team === TEAM.A).length
  const slotsB = MAX_PLAYERS_PER_TEAM - activeParticipants.filter((p) => p.team === TEAM.B).length
  const hasSlots = slotsA > 0 || slotsB > 0
  const canJoin = isPlanned && hasSlots && !isParticipant && !isCreator
  const canLeave = isPlanned && isParticipant

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
            isViewerParticipant={isParticipant || isCreator}
          />
          <TeamSection
            team={TEAM.B}
            participants={match.participants}
            matchId={id}
            isViewerParticipant={isParticipant || isCreator}
          />
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
        </View>
      </ScrollView>

      <JoinModal
        visible={joinModalVisible}
        onClose={() => setJoinModalVisible(false)}
        onJoin={handleJoin}
        slotsA={slotsA}
        slotsB={slotsB}
        loading={joinMatch.isPending}
      />
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
  actions: { gap: 10 },
  actionBtn: {},
})
