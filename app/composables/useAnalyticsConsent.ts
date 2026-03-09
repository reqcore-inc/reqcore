/**
 * Composable for managing PostHog analytics consent (GDPR compliance).
 *
 * By default, PostHog captures events. Users can opt out via this composable.
 * The consent state is persisted in localStorage.
 *
 * Usage:
 *   const { hasConsented, acceptAnalytics, declineAnalytics } = useAnalyticsConsent()
 */
const CONSENT_KEY = 'reqcore-analytics-consent'

type ConsentState = 'granted' | 'denied' | null

export function useAnalyticsConsent() {
  const posthog = usePostHog()

  const consentState = useState<ConsentState>('analytics-consent', () => {
    if (import.meta.server) return null
    return (localStorage.getItem(CONSENT_KEY) as ConsentState) || null
  })

  const hasConsented = computed(() => consentState.value === 'granted')
  const hasDeclined = computed(() => consentState.value === 'denied')
  const needsConsent = computed(() => consentState.value === null)

  function acceptAnalytics() {
    consentState.value = 'granted'
    if (import.meta.client) {
      localStorage.setItem(CONSENT_KEY, 'granted')
    }
    posthog?.opt_in_capturing()
  }

  function declineAnalytics() {
    consentState.value = 'denied'
    if (import.meta.client) {
      localStorage.setItem(CONSENT_KEY, 'denied')
    }
    posthog?.opt_out_capturing()
  }

  // Apply stored consent on mount
  if (import.meta.client && consentState.value === 'denied') {
    posthog?.opt_out_capturing()
  }

  return {
    hasConsented,
    hasDeclined,
    needsConsent,
    acceptAnalytics,
    declineAnalytics,
  }
}
