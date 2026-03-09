/**
 * Client-only plugin that identifies the current user and organization
 * in PostHog whenever the auth session is available.
 *
 * - Calls posthog.identify() with the user's ID and safe properties
 * - Calls posthog.group() for the active organization (group analytics)
 * - Resets PostHog on sign-out to avoid cross-user data leakage
 */
export default defineNuxtPlugin({
  name: 'posthog-identity',
  parallel: true,
  setup() {
    const posthog = usePostHog()
    if (!posthog) return

    // ── Privacy: strip query params and hashes from captured URLs ──
    // These may contain tokens, invitation IDs, or other PII.
    const originalCapture = posthog.capture.bind(posthog)
    posthog.capture = (eventName: string, properties?: Record<string, unknown>, options?: unknown) => {
      const props = { ...properties }
      if (typeof props['$current_url'] === 'string') {
        try {
          const url = new URL(props['$current_url'])
          url.search = ''
          url.hash = ''
          props['$current_url'] = url.toString()
        }
        catch { /* keep original if parsing fails */ }
      }
      return originalCapture(eventName, props, options as never)
    }

    // Provide a hook that components/composables can use to identify the user
    // after the app has mounted and auth session is available.
    return {
      provide: {
        posthogIdentifyUser: (user: { id: string, name?: string, createdAt?: string }) => {
          posthog.identify(user.id, {
            name: user.name || undefined,
            createdAt: user.createdAt || undefined,
          })
        },
        posthogSetOrganization: (org: { id: string, name?: string, slug?: string }) => {
          posthog.group('organization', org.id, {
            name: org.name || undefined,
            slug: org.slug || undefined,
          })
        },
        posthogReset: () => {
          posthog.reset()
        },
      },
    }
  },
})
