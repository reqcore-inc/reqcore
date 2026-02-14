import type { H3Event } from 'h3'

/**
 * Require an authenticated session with an active organization.
 * Throws 401 if not authenticated, 403 if no active organization selected.
 *
 * Usage: `const session = await requireAuth(event)`
 * Then: `const orgId = session.session.activeOrganizationId!`
 */
export async function requireAuth(event: H3Event) {
  const session = await auth.api.getSession({
    headers: event.headers,
  })

  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (!session.session.activeOrganizationId) {
    throw createError({ statusCode: 403, statusMessage: 'No active organization' })
  }

  return session
}
