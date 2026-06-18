import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'

import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

type AvatarCircleProps = {
  uri: string | null | undefined
  name: string
  size?: number
  style?: ViewStyle
  imageStyle?: ImageStyle
  fallbackStyle?: ViewStyle
  initialsStyle?: TextStyle
}

function initialsFromName(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function AvatarCircle({
  uri,
  name,
  size = 96,
  style,
  imageStyle,
  fallbackStyle,
  initialsStyle,
}: AvatarCircleProps) {
  const radius = size / 2
  const fontSize = Math.round(size * 0.375)

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius: radius }, imageStyle]}
      />
    )
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius },
        fallbackStyle,
        style,
      ]}>
      <Text style={[styles.initials, { fontSize }, initialsStyle]}>
        {initialsFromName(name) || '?'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
})
