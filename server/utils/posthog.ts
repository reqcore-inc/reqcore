import { PostHog } from 'posthog-node'

let client: PostHog | null = null

/**
 * Lazily-initialized server-side PostHog client for backend event capture.
 * Uses the same public key and host configured for the Nuxt module.
 *
 * Returns `null` when POSTHOG_PUBLIC_KEY is not set (e.g. local dev),
 * so callers should null-check before calling methods.
 */
export function useServerPostHog(): PostHog | null {
  if (client) return client

  const config = useRuntimeConfig()
  const publicKey = config.public.posthog?.publicKey
  const host = config.public.posthog?.host

  if (!publicKey) {
    return null
  }

  client = new PostHog(publicKey, {
    host: host || 'https://eu.i.posthog.com',
    // Flush events every 10 seconds or 20 events, whichever comes first
    flushAt: 20,
    flushInterval: 10_000,
  })

  return client
}
