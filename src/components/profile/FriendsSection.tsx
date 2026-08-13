import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useRouter } from 'expo-router'
import type { Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AvatarCircle } from '@/components/profile/AvatarCircle'
import { SendFriendRequestModal } from '@/components/profile/SendFriendRequestModal'
import { Button } from '@/components/ui/Button'
import {
  useCancelFriendRequest,
  useMyFriendRequests,
  useMyFriends,
  useRemoveFriend,
  useRespondFriendRequest,
  useSearchUsersByDisplayName,
  type FriendRequestRow,
  type FriendSummary,
  type UserSearchHit,
} from '@/hooks/useFriends'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

const FAB_SIZE = 56
const FAB_GAP_ABOVE_TAB_BAR = 6
const SEARCH_DEBOUNCE_MS = 300

type FriendsSectionProps = {
  bottom?: number
  right?: number
}

type InviteTarget = { userId: string; displayName: string } | null

export function FriendsSection({ bottom, right = 20 }: FriendsSectionProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const { width: windowWidth } = useWindowDimensions()
  const panelWidth = Math.min(360, Math.round(windowWidth * 0.86))
  const [open, setOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [inviteTarget, setInviteTarget] = useState<InviteTarget>(null)
  const [slide] = useState(() => new Animated.Value(panelWidth))
  const inviteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bottomOffset = bottom ?? tabBarHeight + FAB_GAP_ABOVE_TAB_BAR

  const { data: friends, isPending: friendsPending } = useMyFriends()
  const { data: received, isPending: receivedPending } = useMyFriendRequests('received')
  const { data: sent, isPending: sentPending } = useMyFriendRequests('sent')
  const {
    data: searchHits,
    isFetching: searchFetching,
    isError: searchError,
  } = useSearchUsersByDisplayName(debouncedQuery)

  const receivedCount = received?.length ?? 0
  const sentCount = sent?.length ?? 0
  const friendsCount = friends?.length ?? 0
  const totalPending = receivedCount + sentCount
  const showSearchResults = debouncedQuery.trim().length >= 2

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchText.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchText])

  useEffect(() => {
    return () => {
      if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      slide.setValue(panelWidth)
      return
    }
    slide.setValue(panelWidth)
    Animated.timing(slide, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start()
  }, [open, slide, panelWidth])

  const clearDrawerState = () => {
    setSearchText('')
    setDebouncedQuery('')
  }

  const animateDrawerClosed = (onClosed?: () => void) => {
    Animated.timing(slide, {
      toValue: panelWidth,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      clearDrawerState()
      setOpen(false)
      onClosed?.()
    })
  }

  const closeDrawer = () => {
    animateDrawerClosed(() => setInviteTarget(null))
  }

  /** iOS cannot present a second RN Modal on top of the friends drawer Modal. */
  const openInviteFromSearch = (hit: UserSearchHit) => {
    const target = { userId: hit.user_id, displayName: hit.display_name }
    animateDrawerClosed(() => {
      const showInvite = () => setInviteTarget(target)
      // Give iOS time to dismiss the drawer Modal before presenting pageSheet.
      if (Platform.OS === 'ios') {
        if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current)
        inviteTimerRef.current = setTimeout(showInvite, 120)
      } else {
        showInvite()
      }
    })
  }

  const openFriendProfile = (uid: string) => {
    animateDrawerClosed(() => {
      setInviteTarget(null)
      router.push(`/(tabs)/profile/${uid}` as Href)
    })
  }

  return (
    <>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={closeDrawer}
        accessibilityViewIsModal>
        <View style={s.backdropContainer}>
          <Pressable
            style={s.backdrop}
            onPress={closeDrawer}
            accessibilityRole="button"
            accessibilityLabel="Cerrar menú de amigos"
          />
          <Animated.View
            style={[
              s.panel,
              {
                width: panelWidth,
                paddingTop: Math.max(insets.top, 16),
                paddingBottom: Math.max(insets.bottom, 16),
                transform: [{ translateX: slide }],
              },
            ]}>
            <View style={s.panelHeader}>
              <View style={s.panelTitleBlock}>
                <Text style={s.panelTitle}>Amigos</Text>
                <Text style={s.panelSubtitle}>
                  {friendsCount} {friendsCount === 1 ? 'amigo' : 'amigos'}
                  {totalPending > 0 ? ` · ${totalPending} pendientes` : ''}
                </Text>
              </View>
              <Pressable
                onPress={closeDrawer}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                hitSlop={8}
                style={s.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </Pressable>
            </View>

            <View style={s.searchWrap}>
              <Ionicons name="search" size={18} color={Colors.textSecondary} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Buscar por nombre…"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                style={s.searchInput}
                accessibilityLabel="Buscar usuarios por nombre"
              />
              {searchText.length > 0 ? (
                <Pressable
                  onPress={() => setSearchText('')}
                  accessibilityRole="button"
                  accessibilityLabel="Limpiar búsqueda"
                  hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              style={s.panelScroll}
              contentContainerStyle={s.panelScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              {showSearchResults ? (
                <UserSearchResults
                  hits={searchHits ?? []}
                  loading={searchFetching}
                  error={searchError}
                  onInvite={openInviteFromSearch}
                  onOpenProfile={openFriendProfile}
                />
              ) : (
                <>
                  <Text style={s.searchHint}>Escribe al menos 2 letras para buscar usuarios.</Text>
                  <FriendsList
                    friends={friends ?? []}
                    pending={friendsPending}
                    onOpenProfile={openFriendProfile}
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
                </>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <SendFriendRequestModal
        visible={Boolean(inviteTarget)}
        addresseeId={inviteTarget?.userId ?? ''}
        addresseeName={inviteTarget?.displayName ?? ''}
        onClose={() => setInviteTarget(null)}
      />

      <View style={[s.fabWrap, { bottom: bottomOffset, right }]} pointerEvents="box-none">
        <Pressable
          style={({ pressed }) => [s.fab, pressed && s.fabPressed]}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={
            totalPending > 0
              ? `Amigos, ${totalPending} solicitudes pendientes`
              : 'Abrir menú de amigos'
          }>
          <Ionicons name="people" size={26} color={Colors.white} />
          {totalPending > 0 ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>{totalPending > 9 ? '9+' : String(totalPending)}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </>
  )
}

function UserSearchResults({
  hits,
  loading,
  error,
  onInvite,
  onOpenProfile,
}: {
  hits: UserSearchHit[]
  loading: boolean
  error: boolean
  onInvite: (hit: UserSearchHit) => void
  onOpenProfile: (uid: string) => void
}) {
  if (loading && hits.length === 0) {
    return (
      <View style={s.searchStatus}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={s.empty}>Buscando…</Text>
      </View>
    )
  }
  if (error) {
    return <Text style={s.empty}>No se pudo buscar usuarios. Inténtalo de nuevo.</Text>
  }
  if (hits.length === 0) {
    return <Text style={s.empty}>No hay usuarios con ese nombre.</Text>
  }

  return (
    <View style={s.subGroup}>
      <Text style={s.subTitle}>Resultados</Text>
      <View style={s.list}>
        {hits.map((hit) => {
          const canInvite = hit.friendship_status == null
          const actionLabel =
            hit.friendship_status === 'accepted'
              ? 'Amigos'
              : hit.friendship_status === 'pending'
                ? 'Pendiente'
                : 'Invitar'

          return (
            <View key={hit.user_id} style={s.row}>
              <Pressable
                style={s.friendProfileTap}
                onPress={() => onOpenProfile(hit.user_id)}
                accessibilityRole="button"
                accessibilityLabel={`Ver perfil de ${hit.display_name}`}>
                <AvatarCircle uri={hit.photo_url} name={hit.display_name} size={40} />
                <View style={s.rowInfo}>
                  <Text style={s.rowName} numberOfLines={1}>
                    {hit.display_name}
                  </Text>
                  {hit.city ? (
                    <Text style={s.rowSub} numberOfLines={1}>
                      {hit.city}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <Button
                title={actionLabel}
                variant={canInvite ? 'primary' : 'outline'}
                onPress={() => onInvite(hit)}
                disabled={!canInvite}
                style={s.inviteBtn}
                textStyle={s.smallBtnText}
              />
            </View>
          )
        })}
      </View>
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
        Aún no tienes amigos. Busca por nombre o envía una solicitud desde el perfil de un usuario.
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
  const [busyActions, setBusyActions] = useState<Map<string, 'accept' | 'reject' | 'cancel'>>(
    () => new Map()
  )

  const withBusy = async (
    friendshipId: string,
    action: 'accept' | 'reject' | 'cancel',
    fn: () => Promise<unknown>,
    errTitle: string
  ) => {
    setBusyActions((prev) => new Map(prev).set(friendshipId, action))
    try {
      await fn()
    } catch (err) {
      Alert.alert(errTitle, err instanceof Error ? err.message : 'Error')
    } finally {
      setBusyActions((prev) => {
        const next = new Map(prev)
        next.delete(friendshipId)
        return next
      })
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
                    void withBusy(
                      r.friendship_id,
                      'accept',
                      () => respond.mutateAsync({ friendshipId: r.friendship_id, accept: true }),
                      'No se pudo aceptar'
                    )
                  }
                  loading={busyActions.get(r.friendship_id) === 'accept'}
                  style={s.smallBtn}
                  textStyle={s.smallBtnText}
                />
                <Button
                  title="Rechazar"
                  variant="outline"
                  onPress={() =>
                    void withBusy(
                      r.friendship_id,
                      'reject',
                      () => respond.mutateAsync({ friendshipId: r.friendship_id, accept: false }),
                      'No se pudo rechazar'
                    )
                  }
                  loading={busyActions.get(r.friendship_id) === 'reject'}
                  style={s.smallBtn}
                  textStyle={s.smallBtnText}
                />
              </View>
            ) : (
              <Button
                title="Cancelar"
                variant="outline"
                onPress={() =>
                  void withBusy(
                    r.friendship_id,
                    'cancel',
                    () => cancel.mutateAsync(r.friendship_id),
                    'No se pudo cancelar'
                  )
                }
                loading={busyActions.get(r.friendship_id) === 'cancel'}
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

const webFixedBackdrop = { position: 'fixed' } as unknown as ViewStyle

const s = StyleSheet.create({
  backdropContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
    ...(Platform.OS === 'web' ? webFixedBackdrop : null),
  },
  panel: {
    height: '100%',
    backgroundColor: Colors.background,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    paddingHorizontal: 16,
    zIndex: 2,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  panelTitleBlock: { flex: 1, gap: 2 },
  panelTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  panelSubtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  searchWrap: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
    paddingVertical: 10,
  },
  searchHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    paddingBottom: 4,
  },
  searchStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  panelScroll: { flex: 1 },
  panelScrollContent: { gap: 20, paddingTop: 16, paddingBottom: 24 },
  fabWrap: {
    position: 'absolute',
    zIndex: 10,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  fabPressed: {
    opacity: 0.9,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: Colors.danger,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: Colors.white,
    fontSize: 11,
    fontFamily: Fonts.bold,
    lineHeight: 13,
  },
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
  rowActions: { flexDirection: 'column', gap: 6 },
  smallBtn: { minHeight: 36, paddingHorizontal: 12 },
  inviteBtn: { minHeight: 36, paddingHorizontal: 12, alignSelf: 'center' },
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
