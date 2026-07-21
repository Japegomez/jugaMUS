import { Redirect, useLocalSearchParams } from 'expo-router'

/** Entry point for `jugamus://tournaments/{id}` invite links. */
export default function TournamentDeepLinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  if (!id) {
    return <Redirect href="/(tabs)/matches" />
  }

  return <Redirect href={`/(tabs)/tournaments/${id}`} />
}
