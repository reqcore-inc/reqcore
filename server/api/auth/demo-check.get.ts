import { eq } from 'drizzle-orm'
import * as schema from '../../database/schema'

/**
 * Server-side check: is the current session a demo organization?
 *
 * Used by the fresh-signup page to reliably detect demo sessions
 * before signing out and redirecting to sign-up.
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session) {
    return { hasSession: false, isDemo: false }
  }

  const demoSlug = useRuntimeConfig().public.demoOrgSlug as string
  const activeOrgId = (session.session as { activeOrganizationId?: string }).activeOrganizationId

  if (!demoSlug || !activeOrgId) {
    return { hasSession: true, isDemo: false }
  }

  const [org] = await db
    .select({ slug: schema.organization.slug })
    .from(schema.organization)
    .where(eq(schema.organization.id, activeOrgId))
    .limit(1)

  return { hasSession: true, isDemo: org?.slug === demoSlug }
})
