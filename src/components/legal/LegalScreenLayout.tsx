import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { Button } from '@/components/ui/Button'

export const LEGAL_DISCLAIMER = 'Texto legal definitivo pendiente de revisión jurídica.'

type Props = {
  title: string
  children: ReactNode
}

export function LegalScreenLayout({ title, children }: Props) {
  const router = useRouter()

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
    fontWeight: '700',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  disclaimerBox: {
    backgroundColor: '#fff8e6',
    borderLeftWidth: 4,
    borderLeftColor: '#c9a227',
    padding: 12,
    marginBottom: 20,
    borderRadius: 4,
  },
  disclaimer: {
    fontSize: 14,
    lineHeight: 20,
    color: '#5c4a12',
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  h2: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  p: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    color: '#333',
  },
  actions: {
    marginTop: 24,
  },
})
