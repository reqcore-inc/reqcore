import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { document, orgSettings } from '../../../database/schema'

/**
 * PATCH /api/documents/:id/expiration
 *
 * Extend or modify the expiration date of a document.
 * Requires admin permission.
 *
 * Use case: Extend retention for documents with legal hold or special agreement.
 * GDPR: Documents are automatically deleted when their expiration date passes.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { admin: ['true'] })
  const orgId = session.session.activeOrganizationId

  // Get organization date format setting
  const orgSetting = await db.query.orgSettings.findFirst({
    where: eq(orgSettings.organizationId, orgId),
    columns: { dateFormat: true },
  })
  const dateFormat = orgSetting?.dateFormat ?? 'mdy'

  const { id: documentId } = await getValidatedRouterParams(event, z.object({ id: z.string().uuid() }).parse)
  const { expirationDate: expirationDateStr } = await readValidatedBody(event, z.object({
    expirationDate: z.string().datetime(),
  }).parse)
  const expirationDate = new Date(expirationDateStr)

  // Verify document exists and belongs to org
  const doc = await db.query.document.findFirst({
    where: and(
      eq(document.id, documentId),
      eq(document.organizationId, orgId),
    ),
    columns: { id: true, organizationId: true, originalFilename: true, expirationDate: true },
  })

  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }

  // Format dates for timeline message according to organization settings
  const formatDate = (date: string | Date) => {
    const d = date instanceof Date ? date : new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    
    // Format date part according to organization setting
    let datePart: string
    switch (dateFormat) {
      case 'dmy':
        datePart = `${day}/${month}/${year}`
        break
      case 'ymd':
        datePart = `${year}-${month}-${day}`
        break
      case 'mdy':
      default:
        datePart = `${month}/${day}/${year}`
    }
    
    // Add time part
    return `${datePart} ${hours}:${minutes}`
  }

  // Update expiration date
  await db.update(document)
    .set({ expirationDate })
    .where(and(
      eq(document.id, documentId),
      eq(document.organizationId, orgId),
    ))

  const oldExpirationDate = formatDate(doc.expirationDate);
  const newExpirationDate = formatDate(expirationDate);

  recordActivity({
    organizationId: orgId,
    actorId: session.user.id,
    action: 'updated',
    resourceType: 'document',
    resourceId: documentId,
    metadata: expirationDate && expirationDate !== doc.expirationDate
      ? { from: oldExpirationDate, to: newExpirationDate, title: doc.originalFilename }
      : { title: doc.originalFilename },

  })

  return {
    success: true,
    documentId,
    expirationDate: expirationDate.toISOString(),
  }
})
