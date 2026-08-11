import { Redirect, useLocalSearchParams } from 'expo-router'

/** Deep link stub: `jugamus://leagues/{id}` → league detail. */
export default function LeagueDeepLinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  if (!id) {
    return <Redirect href="/(tabs)/matches" />
  }

  return <Redirect href={`/(tabs)/leagues/${id}`} />
}
