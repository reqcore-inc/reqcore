/**
 * Client-only plugin that identifies the current user and organization
 * in PostHog whenever the auth session is available.
 *
 * - Upgrades PostHog from cookieless to full cookie-based persistence
 *   for returning opted-in users, BEFORE identity watchers fire.
 * - Calls posthog.identify() with the user's ID and person properties
 * - Calls posthog.group() for the active organization (group analytics)
 * - Resets PostHog on sign-out to avoid cross-user data leakage
 */
import { CONSENT_COOKIE_NAME } from '~/composables/useAnalyticsConsent'

// URL properties that may carry tokens or invitation IDs — always sanitized.
// Includes referrer properties: if a user navigated from /jobs?invite_token=xxx,
// the next page's $referrer would expose that token without sanitization.
const SENSITIVE_URL_PROPS = ['$current_url', '$initial_current_url', '$referrer', '$initial_referrer'] as const

export default defineNuxtPlugin({
  name: 'posthog-identity',
  setup() {
    // usePostHog() is auto-imported by @posthog/nuxt, but the module is
    // conditionally loaded (only when POSTHOG_PUBLIC_KEY is set).  In CI and
    // local-dev without the key the auto-import doesn't exist, so we replicate
    // its safe accessor here: $posthog is a function provided by the module's
    // plugin — when the module isn't loaded it simply won't be on NuxtApp.
    const $ph = (useNuxtApp() as Record<string, unknown>).$posthog as (() => import('posthog-js').PostHog) | undefined
    const posthog = $ph?.()
    if (!posthog) return

    const cookieDomain = (useRuntimeConfig().public as Record<string, string>).cookieDomain
    const consentCookie = useCookie<string | null>(CONSENT_COOKIE_NAME, {
      domain: cookieDomain || undefined,
      maxAge: 365 * 24 * 60 * 60,
      path: '/',
      sameSite: 'lax',
    })

    // ── Cross-domain consent linking ──
    // The marketing site (reqcore.com) appends ?ph_consent=granted when the
    // user already accepted analytics there.  Apply it to the shared cookie so
    // the consent banner doesn't appear a second time on the app.
    const url = new URL(window.location.href)
    let urlModified = false
    const crossDomainConsent = url.searchParams.get('ph_consent')
    if (crossDomainConsent === 'granted') {
      // Only accept cross-domain consent when the referrer is the known
      // marketing site.  Without this check any crafted link with
      // ?ph_consent=granted would silently bypass the consent banner,
      // violating GDPR Art. 7 (consent must be freely given).
      let fromTrustedOrigin = false
      if (document.referrer) {
        try {
          const ref = new URL(document.referrer)
          fromTrustedOrigin = ref.hostname === 'reqcore.com' || ref.hostname.endsWith('.reqcore.com')
        }
        catch { /* invalid referrer — ignore */ }
      }
      if (fromTrustedOrigin) {
        consentCookie.value = 'granted'
      }
      url.searchParams.delete('ph_consent')
      urlModified = true
    }

    // ── Apply stored consent: upgrade persistence for returning opted-in users ──
    // PostHog starts with cookieless tracking (persistence: 'memory',
    // person_profiles: 'never').  If the user already consented, upgrade to
    // full cookie-based persistence before identity watchers fire so that
    // identify() and group() calls create person profiles.
    const storedConsent = consentCookie.value
    if (storedConsent === 'granted') {
      posthog.set_config({
        persistence: 'localStorage+cookie',
        person_profiles: 'identified_only',
        cross_subdomain_cookie: true,
      })
    }
    // No else needed: cookieless tracking continues for non-consented visitors.
    // Events still flow (aggregate analytics) but no person profiles are created.

    // ── Privacy: strip query params and hashes from captured URLs ──
    // These may contain tokens, invitation IDs, or other PII.
    const originalCapture = posthog.capture.bind(posthog)

    // ── Cross-domain identity linking ──
    // The marketing site (reqcore.com) appends ?ph_did=<distinct_id> to links
    // pointing here.  If present, alias the marketing visitor's anonymous ID to
    // this session so the full journey is stitched together in PostHog.
    const marketingDistinctId = url.searchParams.get('ph_did')
    // Validate format: PostHog distinct IDs are typically UUIDs or short
    // alphanumeric strings.  Reject anything outside that to prevent
    // passing arbitrary untrusted input to posthog.alias().
    const isValidDistinctId = marketingDistinctId && /^[\w-]{10,100}$/.test(marketingDistinctId)
    if (isValidDistinctId && storedConsent === 'granted') {
      // Create an alias so both IDs resolve to the same person in PostHog.
      posthog.alias(marketingDistinctId)
      // Strip the param from the URL to prevent it leaking into pageview props.
      url.searchParams.delete('ph_did')
      urlModified = true
    }

    if (urlModified) {
      window.history.replaceState({}, '', url.pathname + url.search + url.hash)
    }

    posthog.capture = (eventName: string, properties?: Record<string, unknown>, options?: unknown) => {
      const props = { ...properties }
      for (const key of SENSITIVE_URL_PROPS) {
        if (typeof props[key] === 'string') {
          try {
            const url = new URL(props[key] as string)
            url.search = ''
            url.hash = ''
            props[key] = url.toString()
          }
          catch { /* keep original if parsing fails */ }
        }
      }
      return originalCapture(eventName, props, options as never)
    }

    // Provide a hook that components/composables can use to identify the user
    // after the app has mounted and auth session is available.
    return {
      provide: {
        // User ID + person properties (email, name) are sent for opted-in
        // users.  GDPR-safe: identify() in usePostHogIdentity is gated on
        // consent, and person_profiles is 'never' until consent upgrades it
        // to 'identified_only'.
        posthogIdentifyUser: (userId: string, properties?: Record<string, string | undefined>) => {
          posthog.identify(userId, properties)
        },
        // Only id and human-readable name are forwarded.  slug is redundant
        // for analytics purposes and is omitted to minimise data collection.
        posthogSetOrganization: (org: { id: string, name?: string, member_role?: string }) => {
          posthog.group('organization', org.id, {
            name: org.name || undefined,
            member_role: org.member_role || undefined,
          })
        },
        posthogReset: () => {
          posthog.reset()
        },
        posthogResetGroups: () => {
          posthog.resetGroups()
        },
      },
    }
  },
})
