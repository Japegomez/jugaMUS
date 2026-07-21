import { Redirect, useLocalSearchParams } from 'expo-router'

/** HTTPS App Link stub: `https://host/m/{id}` → match detail. */
export default function MatchHttpsInviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  if (!id) {
    return <Redirect href="/(tabs)/matches" />
  }

  return <Redirect href={`/(tabs)/matches/${id}`} />
}
