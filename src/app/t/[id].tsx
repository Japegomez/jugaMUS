import { Redirect, useLocalSearchParams } from 'expo-router'

/** HTTPS App Link stub: `https://host/t/{id}` → tournament detail. */
export default function TournamentHttpsInviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  if (!id) {
    return <Redirect href="/(tabs)/matches" />
  }

  return <Redirect href={`/(tabs)/tournaments/${id}`} />
}
