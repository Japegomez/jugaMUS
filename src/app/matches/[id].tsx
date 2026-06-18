import { Redirect, useLocalSearchParams } from 'expo-router'

/** Entry point for `jugamus://matches/{id}` invite links. */
export default function MatchDeepLinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  if (!id) {
    return <Redirect href="/(tabs)/matches" />
  }

  return <Redirect href={`/(tabs)/matches/${id}`} />
}
