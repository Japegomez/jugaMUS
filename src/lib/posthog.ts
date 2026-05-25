import PostHog from 'posthog-react-native'

// Singleton — se inicializa una sola vez en el provider del layout raíz
export const posthog = new PostHog(process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '', {
  // Región EU para cumplimiento RGPD
  host: 'https://eu.i.posthog.com',
  // No capturar nada hasta que el usuario no haya sido identificado
  disabled: !process.env.EXPO_PUBLIC_POSTHOG_API_KEY,
})
