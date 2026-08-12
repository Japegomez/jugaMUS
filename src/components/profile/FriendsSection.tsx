import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import type { Href } from 'expo-router'

import { AvatarCircle } from '@/components/profile/AvatarCircle'
import { Button } from '@/components/ui/Button'
import {
  useCancelFriendRequest,
  useMyFriendRequests,
  useMyFriends,
  useRemoveFriend,
  useRespondFriendRequest,
  type FriendRequestRow,
  type FriendSummary,
} from '@/hooks/useFriends'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export function FriendsSection() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { data: friends, isPending: friendsPending } = useMyFriends()
  const { data: received, isPending: receivedPending } = useMyFriendRequests('received')
  const { data: sent, isPending: sentPending } = useMyFriendRequests('sent')

  const receivedCount = received?.length ?? 0
  const sentCount = sent?.length ?? 0
  const friendsCount = friends?.length ?? 0
  const totalPending = receivedCount + sentCount

  return (
    <View style={s.card}>
      <Pressable
        style={s.header}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Amigos y solicitudes">
        <Text style={s.cardTitle}>Amigos</Text>
        <View style={s.headerRight}>
          <Text style={s.count}>
            {friendsCount}
            {totalPending > 0 ? ` · ${totalPending} pendientes` : ''}
          </Text>
          <Ionicons
            name={open ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={20}
            color={Colors.textSecondary}
          />
        </View>
      </Pressable>

      {open ? (
        <View style={s.body}>
          <FriendsList
            friends={friends ?? []}
            pending={friendsPending}
            onOpenProfile={(uid) => router.push(`/(tabs)/profile/${uid}` as Href)}
          />
          <RequestsList
            title="Solicitudes recibidas"
            requests={received ?? []}
            pending={receivedPending}
            variant="received"
          />
          <RequestsList
            title="Solicitudes enviadas"
            requests={sent ?? []}
            pending={sentPending}
            variant="sent"
          />
        </View>
      ) : null}
    </View>
  )
}

function FriendsList({
  friends,
  pending,
  onOpenProfile,
}: {
  friends: FriendSummary[]
  pending: boolean
  onOpenProfile: (uid: string) => void
}) {
  const removeFriend = useRemoveFriend()

  const handleRemove = (userId: string, displayName: string) => {
    Alert.alert('Eliminar amigo', `¿Seguro que quieres eliminar a ${displayName} de tus amigos?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          void removeFriend
            .mutateAsync(userId)
            .catch((err) =>
              Alert.alert('No se pudo eliminar', err instanceof Error ? err.message : 'Error')
            )
        },
      },
    ])
  }

  if (pending && friends.length === 0) {
    return <Text style={s.empty}>Cargando amigos…</Text>
  }
  if (friends.length === 0) {
    return (
      <Text style={s.empty}>
        Aún no tienes amigos. Envía una solicitud desde el perfil de un usuario.
      </Text>
    )
  }
  return (
    <View style={s.list}>
      {friends.map((f) => (
        <View key={f.user_id} style={s.row}>
          <Pressable
            style={s.friendProfileTap}
            onPress={() => onOpenProfile(f.user_id)}
            accessibilityRole="button"
            accessibilityLabel={`Ver perfil de ${f.display_name}`}>
            <AvatarCircle uri={f.photo_url} name={f.display_name} size={40} />
            <View style={s.rowInfo}>
              <Text style={s.rowName} numberOfLines={1}>
                {f.display_name}
              </Text>
              {f.city ? (
                <Text style={s.rowSub} numberOfLines={1}>
                  {f.city}
                </Text>
              ) : null}
            </View>
          </Pressable>
          <Pressable
            onPress={() => handleRemove(f.user_id, f.display_name)}
            accessibilityRole="button"
            accessibilityLabel={`Eliminar a ${f.display_name} de tus amigos`}
            disabled={removeFriend.isPending}
            style={s.removeBtn}>
            <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          </Pressable>
        </View>
      ))}
    </View>
  )
}

function RequestsList({
  title,
  requests,
  pending,
  variant,
}: {
  title: string
  requests: FriendRequestRow[]
  pending: boolean
  variant: 'received' | 'sent'
}) {
  const respond = useRespondFriendRequest()
  const cancel = useCancelFriendRequest()

  const handle = async (fn: () => Promise<unknown>, errTitle: string) => {
    try {
      await fn()
    } catch (err) {
      Alert.alert(errTitle, err instanceof Error ? err.message : 'Error')
    }
  }

  if (pending && requests.length === 0) return null
  if (requests.length === 0) {
    return (
      <View style={s.subGroup}>
        <Text style={s.subTitle}>{title}</Text>
        <Text style={s.empty}>No hay solicitudes.</Text>
      </View>
    )
  }
  return (
    <View style={s.subGroup}>
      <Text style={s.subTitle}>{title}</Text>
      <View style={s.list}>
        {requests.map((r) => (
          <View key={r.friendship_id} style={s.row}>
            <AvatarCircle uri={r.photo_url} name={r.display_name} size={36} />
            <View style={s.rowInfo}>
              <Text style={s.rowName} numberOfLines={1}>
                {r.display_name}
              </Text>
              {r.message ? (
                <Text style={s.rowSub} numberOfLines={2}>
                  “{r.message}”
                </Text>
              ) : null}
            </View>
            {variant === 'received' ? (
              <View style={s.rowActions}>
                <Button
                  title="Aceptar"
                  onPress={() =>
                    void handle(
                      () => respond.mutateAsync({ friendshipId: r.friendship_id, accept: true }),
                      'No se pudo aceptar'
                    )
                  }
                  loading={respond.isPending}
                  style={s.smallBtn}
                  textStyle={s.smallBtnText}
                />
                <Button
                  title="Rechazar"
                  variant="outline"
                  onPress={() =>
                    void handle(
                      () => respond.mutateAsync({ friendshipId: r.friendship_id, accept: false }),
                      'No se pudo rechazar'
                    )
                  }
                  loading={respond.isPending}
                  style={s.smallBtn}
                  textStyle={s.smallBtnText}
                />
              </View>
            ) : (
              <Button
                title="Cancelar"
                variant="outline"
                onPress={() =>
                  void handle(() => cancel.mutateAsync(r.friendship_id), 'No se pudo cancelar')
                }
                loading={cancel.isPending}
                style={s.smallBtn}
                textStyle={s.smallBtnText}
              />
            )}
          </View>
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  count: { fontSize: 13, color: Colors.textSecondary, fontFamily: Fonts.regular },
  body: { gap: 16, paddingBottom: 8 },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  friendProfileTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  removeBtn: { padding: 8 },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontFamily: Fonts.medium, color: Colors.textPrimary },
  rowSub: { fontSize: 13, color: Colors.textSecondary },
  rowActions: { flexDirection: 'row', gap: 8 },
  smallBtn: { minHeight: 36, paddingHorizontal: 12 },
  smallBtnText: { fontSize: 13 },
  subGroup: { gap: 6 },
  subTitle: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  empty: { fontSize: 13, color: Colors.textSecondary, paddingVertical: 4 },
})
