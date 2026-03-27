/**
 * Composable for managing PostHog analytics consent.
 *
 * Cookieless tracking is ALWAYS active — no consent needed.
 * Accepting analytics upgrades to full cookie-based tracking
 * (UTM, sessions, identity). Declining keeps cookieless mode.
 */

/** Cookie name — shared across reqcore-web and applirank */
export const CONSENT_COOKIE_NAME = 'reqcore-consent'

/** @deprecated Old localStorage key — used only for one-time migration */
const LEGACY_STORAGE_KEY = 'reqcore-analytics-consent'

type ConsentState = 'granted' | 'denied' | null

export function useAnalyticsConsent() {
  // usePostHog() is auto-imported by @posthog/nuxt, but the module is
  // conditionally loaded.  Replicate the safe accessor so this composable
  // works even when PostHog is not configured (CI, self-hosted without key).
  const posthog = (useNuxtApp() as Record<string, unknown>).$posthog as (() => import('posthog-js').PostHog) | undefined
  const ph = posthog?.()

  const cookieDomain = (useRuntimeConfig().public as Record<string, string>).cookieDomain

  // Cross-subdomain cookie: domain=.reqcore.com makes this visible on both
  // reqcore.com (marketing) and app.reqcore.com (app).
  const consentCookie = useCookie<ConsentState>(CONSENT_COOKIE_NAME, {
    domain: cookieDomain || undefined,
    maxAge: 365 * 24 * 60 * 60,
    path: '/',
    sameSite: 'lax',
  })

  // One-time migration: move consent from localStorage to cookie for users
  // who consented before this change, then clean up localStorage.
  if (import.meta.client && !consentCookie.value) {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy === 'granted' || legacy === 'denied') {
      consentCookie.value = legacy
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    }
  }

  const hasConsented = computed(() => consentCookie.value === 'granted')
  const hasDeclined = computed(() => consentCookie.value === 'denied')
  const needsConsent = computed(() => !consentCookie.value)

  function acceptAnalytics() {
    consentCookie.value = 'granted'
    if (import.meta.client) localStorage.removeItem(LEGACY_STORAGE_KEY)
    if (!ph) return
    // Upgrade from cookieless to full cookie-based persistence
    ph.set_config({
      persistence: 'localStorage+cookie',
      person_profiles: 'identified_only',
      cross_subdomain_cookie: true,
    })
    // Register UTM + attribution now that we have persistence
    if (import.meta.client) {
      const params = new URLSearchParams(window.location.search)
      const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
      const utmProps: Record<string, string> = {}
      for (const key of utmKeys) {
        const val = params.get(key)
        if (val) utmProps[key] = val
      }
      if (Object.keys(utmProps).length > 0) {
        ph.register(utmProps)
        const firstTouch: Record<string, string> = {}
        for (const [k, v] of Object.entries(utmProps)) {
          firstTouch[`initial_${k}`] = v
        }
        ph.register_once(firstTouch)
      }
      ph.register_once({
        initial_referrer: document.referrer || '$direct',
        initial_landing_page: window.location.pathname,
      })
      ph.capture('consent_granted')
    }
  }

  function declineAnalytics() {
    consentCookie.value = 'denied'
    if (import.meta.client) localStorage.removeItem(LEGACY_STORAGE_KEY)
    // No action needed — cookieless tracking continues without cookies or person profiles
  }

  return {
    hasConsented,
    hasDeclined,
    needsConsent,
    acceptAnalytics,
    declineAnalytics,
  }
}
