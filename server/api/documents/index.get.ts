import { eq } from 'drizzle-orm'
import { document } from '../../database/schema'

/**
 * GET /api/documents
 *
 * List all documents for the current organization.
 * Requires authentication.
 * Used by admin to view and manage document expiration dates.
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId

  const docs = await db.query.document.findMany({
    where: eq(document.organizationId, orgId),
    columns: {
      id: true,
      originalFilename: true,
      createdAt: true,
      expirationDate: true,
    },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  })

  return docs
})
