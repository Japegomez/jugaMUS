import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/ui/Button'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'

export const LEGAL_DISCLAIMER = 'Texto legal definitivo pendiente de revisión jurídica.'

type Props = {
  title: string
  children: ReactNode
}

export function LegalScreenLayout({ title, children }: Props) {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: screenTopPadding(insets.top, 24) }]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.disclaimerBox}>
        <Text style={styles.disclaimer}>{LEGAL_DISCLAIMER}</Text>
      </View>
      {children}
      <View style={styles.actions}>
        <Button title="Volver" variant="outline" onPress={() => router.back()} />
      </View>
    </ScrollView>
  )
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.h2}>{heading}</Text>
      {children}
    </View>
  )
}

export function LegalParagraph({ children }: { children: string }) {
  return <Text style={styles.p}>{children}</Text>
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    marginBottom: 16,
    color: Colors.textPrimary,
  },
  disclaimerBox: {
    backgroundColor: Colors.wonBackground,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
    padding: 12,
    marginBottom: 20,
  },
  disclaimer: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontFamily: Fonts.medium,
  },
  section: {
    marginBottom: 20,
  },
  h2: {
    fontSize: 17,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  p: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
    marginBottom: 8,
  },
  actions: {
    marginTop: 24,
  },
})
