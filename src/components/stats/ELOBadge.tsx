import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { showAlert } from '@/utils/alert'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

const ELO_HELP_TITLE = '¿Qué es el ELO?'
const ELO_HELP_MESSAGE =
  'Es tu nivel en JugaMUS. Empiezas con 1200. Ganas más puntos si derrotas a rivales más fuertes, y pierdes más si caes contra rivales peores. Solo cambia al jugar contra rivales con cuenta en la app; jugar contra rivales introducidos por texto no lo afecta.'

export function ELOBadge({ rating }: { rating: number }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.value}>{rating}</Text>
      <Text style={styles.label}>ELO</Text>
      <Pressable
        onPress={() => showAlert(ELO_HELP_TITLE, ELO_HELP_MESSAGE)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Qué es el ELO"
        style={({ pressed }) => [styles.helpBtn, pressed && styles.helpBtnPressed]}>
        <Ionicons name="help-circle-outline" size={18} color={Colors.textSecondary} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.primary,
  },
  label: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.4,
  },
  helpBtn: {
    marginLeft: 2,
    padding: 2,
  },
  helpBtnPressed: {
    opacity: 0.7,
  },
})
