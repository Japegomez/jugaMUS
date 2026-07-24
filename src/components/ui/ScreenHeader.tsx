import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Colors } from '@/theme/colors'
import { useResponsiveLayout } from '@/theme/responsive'
import { Fonts } from '@/theme/typography'

type ScreenHeaderProps = {
  title: string
  subtitle?: string
  trailing?: ReactNode
}

export function ScreenHeader({ title, subtitle, trailing }: ScreenHeaderProps) {
  const { font, space } = useResponsiveLayout()

  return (
    <View style={[styles.header, { paddingBottom: space(16) }]}>
      <View style={styles.headerText}>
        <Text style={[styles.title, { fontSize: font(22) }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { fontSize: font(13), lineHeight: font(18) }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 8,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 4,
  },
})
