import { eq } from 'drizzle-orm'
import * as schema from '../../database/schema'

/**
 * Demo-aware signup redirect — navigated to directly by the browser (GET).
 *
 * Flow:
 *   marketing site "Use Cloud" → GET /auth/fresh-signup (Nuxt page) →
 *   window.location.replace('/api/auth/demo-fresh-signup') → this handler
 *
 * If the visitor has a demo-org session, we sign them out using Better
 * Auth's server-side API (`auth.api.signOut` with `asResponse: true`).
 * This bypasses CSRF origin checks (no Origin header needed for GET),
 * deletes the session from the DB, and returns a Response with the
 * exact Set-Cookie headers needed to clear the auth cookies. We forward
 * those headers into our 302 redirect so the browser clears cookies
 * as part of following the redirect.
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session) {
    return sendRedirect(event, '/auth/sign-up')
  }

  const demoSlug = useRuntimeConfig().public.demoOrgSlug as string
  const activeOrgId = (session.session as { activeOrganizationId?: string }).activeOrganizationId

  if (!demoSlug || !activeOrgId) {
    return sendRedirect(event, '/dashboard')
  }

  const [org] = await db
    .select({ slug: schema.organization.slug })
    .from(schema.organization)
    .where(eq(schema.organization.id, activeOrgId))
    .limit(1)

  if (org?.slug !== demoSlug) {
    return sendRedirect(event, '/dashboard')
  }

  // ── Demo session: sign out via Better Auth's server-side API ───
  //
  // auth.api.signOut() with asResponse:true:
  //   1. Bypasses CSRF/origin check (it's a direct server-side call)
  //   2. Deletes the session from the database
  //   3. Returns a Response with Set-Cookie headers that clear the
  //      auth cookies (correct prefix, Secure flag, domain, etc.)
  const signOutResponse = await (auth.api.signOut as Function)({
    headers: event.headers,
    asResponse: true,
  }) as Response

  // Forward Set-Cookie headers from Better Auth into our redirect
  for (const cookie of signOutResponse.headers.getSetCookie()) {
    appendResponseHeader(event, 'set-cookie', cookie)
  }

  return sendRedirect(event, '/auth/sign-up')
})
