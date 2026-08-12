import { useState } from 'react'
import { Alert, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ScrollableModalBody } from '@/components/ui/ScrollableModalBody'
import { useSendFriendRequest } from '@/hooks/useFriends'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export interface SendFriendRequestModalProps {
  visible: boolean
  addresseeId: string
  addresseeName: string
  onClose: () => void
  onSent?: () => void
}

export function SendFriendRequestModal({
  visible,
  addresseeId,
  addresseeName,
  onClose,
  onSent,
}: SendFriendRequestModalProps) {
  const [message, setMessage] = useState('')
  const send = useSendFriendRequest()

  const close = () => {
    setMessage('')
    onClose()
  }

  const handleSend = async () => {
    if (send.isPending) return
    try {
      await send.mutateAsync({ addresseeId, message })
      setMessage('')
      onSent?.()
      onClose()
    } catch (err) {
      Alert.alert('No se pudo enviar la solicitud', err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!send.isPending) close()
      }}>
      <SafeAreaView style={s.wrap}>
        <View style={s.header}>
          <Text style={s.title}>Enviar solicitud de amistad</Text>
          <Pressable
            onPress={close}
            disabled={send.isPending}
            accessibilityRole="button"
            accessibilityLabel="Cerrar">
            <Text style={s.close}>✕</Text>
          </Pressable>
        </View>
        <ScrollableModalBody>
          <Text style={s.message}>
            Vas a enviar una solicitud de amistad a{' '}
            <Text style={s.name}>{addresseeName || 'este usuario'}</Text>. Podrá aceptarla o
            rechazarla desde su perfil.
          </Text>
          <Input
            label="Mensaje (opcional)"
            value={message}
            onChangeText={setMessage}
            placeholder="Escribe un mensaje para tu amigo…"
            multiline
            numberOfLines={3}
            maxLength={200}
            style={s.messageInput}
          />
          <Button
            title="Enviar solicitud"
            onPress={() => void handleSend()}
            loading={send.isPending}
            style={s.btn}
          />
          <Button
            title="Cancelar"
            variant="outline"
            onPress={close}
            disabled={send.isPending}
            style={s.btn}
          />
        </ScrollableModalBody>
      </SafeAreaView>
    </Modal>
  )
}

const s = StyleSheet.create({
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
  message: { fontSize: 15, color: Colors.textPrimary, marginBottom: 20, lineHeight: 22 },
  name: { fontFamily: Fonts.bold },
  messageInput: { minHeight: 90, textAlignVertical: 'top' },
  btn: { marginBottom: 12 },
})
