import { Redirect, useLocalSearchParams } from 'expo-router'

/** HTTPS App Link stub: `https://host/l/{id}` → league detail. */
export default function LeagueHttpsInviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  if (!id) {
    return <Redirect href="/(tabs)/matches" />
  }

  return <Redirect href={`/(tabs)/leagues/${id}`} />
}
