import { useMemo, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { AvatarCircle } from '@/components/profile/AvatarCircle'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useInviteFriendToMatch } from '@/hooks/useMatchInvitations'
import { useMyFriends } from '@/hooks/useFriends'
import { buildMatchHttpsInviteUrl } from '@/lib/inviteLinks'
import { buildInviteShareMessage, shareInviteViaWhatsApp } from '@/lib/shareInvite'
import type { MatchTeamEditSlot, TextPlayerFields } from '@/services/matches.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export type EditMatchTeamFormValues = {
  teamName: string
  textByField: Partial<Record<keyof TextPlayerFields, string>>
}

type EditMatchTeamModalProps = {
  visible: boolean
  teamLabel: string
  customTeamName: string
  slots: MatchTeamEditSlot[]
  /** Match being edited (standalone planned match). When provided, the
   * "Añadir amigo" tab is shown so the creator can invite friends. */
  matchId?: string
  team?: string
  /** Free slots on this team (registered + text + pending < 2). */
  freeSlots?: number
  /** Used in the WhatsApp invite message when inviting from this modal. */
  matchTitle?: string
  onClose: () => void
  onSubmit: (values: EditMatchTeamFormValues) => void | Promise<void>
  loading?: boolean
}

function initialTextByField(
  slots: MatchTeamEditSlot[]
): Partial<Record<keyof TextPlayerFields, string>> {
  const out: Partial<Record<keyof TextPlayerFields, string>> = {}
  for (const slot of slots) {
    if (slot.kind === 'text') {
      out[slot.field] = slot.value
    }
  }
  return out
}

type EditMatchTeamFormProps = {
  teamLabel: string
  customTeamName: string
  slots: MatchTeamEditSlot[]
  matchId?: string
  team?: string
  freeSlots?: number
  matchTitle?: string
  onClose: () => void
  onSubmit: (values: EditMatchTeamFormValues) => void | Promise<void>
  loading?: boolean
}

function EditMatchTeamForm({
  teamLabel,
  customTeamName,
  slots,
  matchId,
  team,
  freeSlots,
  matchTitle,
  onClose,
  onSubmit,
  loading,
}: EditMatchTeamFormProps) {
  const [tab, setTab] = useState<'edit' | 'friends'>('edit')
  const [teamName, setTeamName] = useState(customTeamName)
  const [textByField, setTextByField] = useState(() => initialTextByField(slots))

  const textSlots = useMemo(() => slots.filter((s) => s.kind === 'text'), [slots])

  const canInviteFriends = Boolean(matchId && team)

  const handleSubmit = async () => {
    for (const slot of textSlots) {
      const initial = slot.value.trim()
      const current = (textByField[slot.field] ?? '').trim()
      if (initial && !current) {
        Alert.alert(
          'Nombre obligatorio',
          'No puedes quitar jugadores de la pareja. Solo puedes editar el nombre.'
        )
        return
      }
    }
    try {
      await onSubmit({ teamName, textByField })
    } catch {
      // El padre muestra el error; mantenemos el formulario.
    }
  }

  return (
    <SafeAreaView style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Editar pareja</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar">
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>
      {canInviteFriends ? (
        <View style={styles.tabs}>
          <Pressable
            onPress={() => setTab('edit')}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === 'edit' }}
            style={[styles.tab, tab === 'edit' && styles.tabActive]}>
            <Text style={[styles.tabText, tab === 'edit' && styles.tabTextActive]}>
              Editar pareja
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('friends')}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === 'friends' }}
            style={[styles.tab, tab === 'friends' && styles.tabActive]}>
            <Text style={[styles.tabText, tab === 'friends' && styles.tabTextActive]}>
              Añadir amigo
            </Text>
          </Pressable>
        </View>
      ) : null}
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          {tab === 'friends' && canInviteFriends ? (
            <InviteFriendsTab
              matchId={matchId!}
              team={team!}
              teamLabel={teamLabel}
              matchTitle={matchTitle}
              freeSlots={freeSlots ?? 0}
            />
          ) : (
            <>
              <Text style={styles.teamHint}>{teamLabel}</Text>

              {slots.map((slot, index) => (
                <View key={`slot-${index}`} style={styles.slot}>
                  <Text style={styles.slotLabel}>Jugador {index + 1}</Text>
                  {slot.kind === 'registered' ? (
                    <View style={styles.locked}>
                      <Text style={styles.lockedName}>{slot.displayName}</Text>
                      <Text style={styles.lockedHint}>Inscrito con cuenta (no editable)</Text>
                    </View>
                  ) : (
                    <Input
                      label="Nombre (texto)"
                      placeholder={index === 0 ? 'Nombre del jugador' : 'Compañero'}
                      value={textByField[slot.field] ?? ''}
                      onChangeText={(value) =>
                        setTextByField((prev) => ({ ...prev, [slot.field]: value }))
                      }
                      autoCapitalize="words"
                    />
                  )}
                </View>
              ))}

              <Input
                label="Nombre de la pareja (opcional)"
                placeholder="Nombre Jugador1 - Nombre Jugador2"
                value={teamName}
                onChangeText={setTeamName}
                autoCapitalize="words"
              />

              <Button
                title="Guardar cambios"
                onPress={() => void handleSubmit()}
                loading={loading}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function InviteFriendsTab({
  matchId,
  team,
  teamLabel,
  matchTitle,
  freeSlots,
}: {
  matchId: string
  team: string
  teamLabel: string
  matchTitle?: string
  freeSlots: number
}) {
  const { data: friends, isLoading } = useMyFriends()
  const invite = useInviteFriendToMatch()
  const [invitedIds, setInvitedIds] = useState<string[]>([])
  const [invitingId, setInvitingId] = useState<string | null>(null)

  const remainingSlots = Math.max(0, freeSlots - invitedIds.length)

  const handleInvite = async (friendId: string) => {
    if (remainingSlots <= 0 || invitedIds.includes(friendId)) return
    setInvitingId(friendId)
    try {
      await invite.mutateAsync({ matchId, inviteeId: friendId, team })
      setInvitedIds((prev) => (prev.includes(friendId) ? prev : [...prev, friendId]))
      const url = buildMatchHttpsInviteUrl(matchId)
      const message = buildInviteShareMessage({
        kind: 'match',
        title: matchTitle?.trim() || 'Partida',
        url,
        meta: `Te he invitado a unirte a ${teamLabel} en esta partida`,
      })
      try {
        await shareInviteViaWhatsApp(message)
      } catch (shareErr) {
        console.warn('share_invite_failed', shareErr)
      }
    } catch (err) {
      Alert.alert('No se pudo invitar', err instanceof Error ? err.message : 'Error')
    } finally {
      setInvitingId(null)
    }
  }

  if (remainingSlots <= 0) {
    return <Text style={styles.empty}>{teamLabel} ya está completo.</Text>
  }

  if (isLoading) {
    return <Text style={styles.empty}>Cargando amigos…</Text>
  }

  if (!friends || friends.length === 0) {
    return (
      <Text style={styles.empty}>
        Aún no tienes amigos. Envía una solicitud desde el perfil de un usuario para poder
        invitarle.
      </Text>
    )
  }

  return (
    <View style={styles.friendsList}>
      <Text style={styles.teamHint}>Invita a un amigo a unirse a {teamLabel}</Text>
      {friends.map((f) => {
        const alreadyInvited = invitedIds.includes(f.user_id)
        return (
          <View key={f.user_id} style={styles.friendRow}>
            <AvatarCircle uri={f.photo_url} name={f.display_name} size={40} />
            <View style={styles.friendInfo}>
              <Text style={styles.friendName} numberOfLines={1}>
                {f.display_name}
              </Text>
              {f.city ? (
                <Text style={styles.friendCity} numberOfLines={1}>
                  {f.city}
                </Text>
              ) : null}
            </View>
            <Button
              title={alreadyInvited ? 'Invitado' : 'Invitar'}
              onPress={() => void handleInvite(f.user_id)}
              loading={invitingId === f.user_id}
              disabled={alreadyInvited || remainingSlots <= 0 || invitingId !== null}
              style={styles.inviteBtn}
              textStyle={styles.inviteBtnText}
            />
          </View>
        )
      })}
    </View>
  )
}

export function EditMatchTeamModal({
  visible,
  teamLabel,
  customTeamName,
  slots,
  matchId,
  team,
  freeSlots,
  matchTitle,
  onClose,
  onSubmit,
  loading,
}: EditMatchTeamModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      {visible ? (
        <EditMatchTeamForm
          key={`${teamLabel}-${slots.map((s) => (s.kind === 'text' ? s.field : 'reg')).join('-')}`}
          teamLabel={teamLabel}
          customTeamName={customTeamName}
          slots={slots}
          matchId={matchId}
          team={team}
          freeSlots={freeSlots}
          matchTitle={matchTitle}
          onClose={onClose}
          onSubmit={onSubmit}
          loading={loading}
        />
      ) : null}
    </Modal>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background },
  keyboard: { flex: 1 },
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },
  body: { padding: 20, paddingBottom: 40 },
  teamHint: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  slot: { marginBottom: 16 },
  slotLabel: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.primary, marginBottom: 8 },
  locked: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  lockedName: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  lockedHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  friendsList: { gap: 12 },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  friendInfo: { flex: 1, minWidth: 0, gap: 2 },
  friendName: { fontSize: 15, fontFamily: Fonts.medium, color: Colors.textPrimary },
  friendCity: { fontSize: 13, color: Colors.textSecondary },
  inviteBtn: { minHeight: 36, paddingHorizontal: 14 },
  inviteBtnText: { fontSize: 13 },
  empty: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
})
