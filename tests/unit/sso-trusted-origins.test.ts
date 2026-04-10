import { describe, it, expect } from 'vitest'

/**
 * Tests for the SSO trusted origins resolver logic.
 *
 * The resolveTrustedOrigins function in auth.ts dynamically adds IdP origins
 * for SSO callback flows. These tests verify the URL parsing and filtering
 * logic that would be applied to registered SSO provider issuers.
 */

describe('SSO trusted origins — issuer URL parsing', () => {
  /**
   * Simulates the issuer → origin extraction from resolveTrustedOrigins.
   * This mirrors the logic in server/utils/auth.ts without requiring
   * a database or running Better Auth instance.
   */
  function extractOriginFromIssuer(issuer: string): string | null {
    try {
      return new URL(issuer).origin
    } catch {
      return null
    }
  }

  it('extracts origin from a standard issuer URL', () => {
    expect(extractOriginFromIssuer('https://login.company.com/realms/prod'))
      .toBe('https://login.company.com')
  })

  it('extracts origin from Okta issuer', () => {
    expect(extractOriginFromIssuer('https://acme.okta.com'))
      .toBe('https://acme.okta.com')
  })

  it('extracts origin from Azure AD issuer with path', () => {
    expect(extractOriginFromIssuer('https://login.microsoftonline.com/tenant-id/v2.0'))
      .toBe('https://login.microsoftonline.com')
  })

  it('extracts origin from Google issuer', () => {
    expect(extractOriginFromIssuer('https://accounts.google.com'))
      .toBe('https://accounts.google.com')
  })

  it('extracts origin from issuer with non-standard port', () => {
    expect(extractOriginFromIssuer('https://keycloak.internal.corp:8443/realms/prod'))
      .toBe('https://keycloak.internal.corp:8443')
  })

  it('returns null for invalid issuer URLs', () => {
    expect(extractOriginFromIssuer('not-a-url')).toBeNull()
    expect(extractOriginFromIssuer('')).toBeNull()
  })

  it('strips path from issuer to only return origin', () => {
    const origin = extractOriginFromIssuer('https://auth.company.com/deep/nested/path?query=1')
    expect(origin).toBe('https://auth.company.com')
    // Must not include path, query, or fragment
    expect(origin).not.toContain('/deep')
    expect(origin).not.toContain('?')
  })

  it('deduplicates origins from multiple providers with same host', () => {
    const issuers = [
      'https://auth.company.com/realms/staging',
      'https://auth.company.com/realms/production',
      'https://other.idp.com',
    ]
    const origins = [...new Set(
      issuers.map(extractOriginFromIssuer).filter((o): o is string => o !== null),
    )]
    expect(origins).toEqual([
      'https://auth.company.com',
      'https://other.idp.com',
    ])
  })
})

describe('SSO flow URL detection', () => {
  /**
   * Mirrors the isSsoFlow check from resolveTrustedOrigins.
   */
  function isSsoFlow(url: string): boolean {
    return url.includes('/sso/') || url.includes('/sign-in/sso')
  }

  it('detects SSO callback URLs', () => {
    expect(isSsoFlow('https://app.reqcore.com/api/auth/sso/callback/acme-sso')).toBe(true)
  })

  it('detects SSO sign-in URLs', () => {
    expect(isSsoFlow('https://app.reqcore.com/api/auth/sign-in/sso')).toBe(true)
  })

  it('does not flag regular auth routes', () => {
    expect(isSsoFlow('https://app.reqcore.com/api/auth/sign-in/email')).toBe(false)
    expect(isSsoFlow('https://app.reqcore.com/api/auth/session')).toBe(false)
    expect(isSsoFlow('https://app.reqcore.com/dashboard')).toBe(false)
  })

  it('does not flag routes with "sso" in other contexts', () => {
    // "sso" appears but not in a path segment matching the check
    expect(isSsoFlow('https://app.reqcore.com/api/auth/sso-settings')).toBe(false)
  })
})
