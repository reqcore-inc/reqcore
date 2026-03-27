import { eq, and } from 'drizzle-orm'
import { trackingLink, job } from '../../database/schema'
import { createTrackingLinkSchema } from '../../utils/schemas/trackingLink'

/**
 * POST /api/tracking-links
 * Create a new tracking link with a unique code.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { sourceTracking: ['create'] })
  const orgId = session.session.activeOrganizationId
  const userId = session.user.id

  const body = await readValidatedBody(event, createTrackingLinkSchema.parse)

  // If scoped to a job, verify the job belongs to this org
  if (body.jobId) {
    const existingJob = await db.query.job.findFirst({
      where: and(eq(job.id, body.jobId), eq(job.organizationId, orgId)),
      columns: { id: true },
    })
    if (!existingJob) {
      throw createError({ statusCode: 404, statusMessage: 'Job not found' })
    }
  }

  // Generate a unique short code (8 chars, URL-safe)
  const code = generateTrackingCode()

  const [created] = await db.insert(trackingLink).values({
    organizationId: orgId,
    jobId: body.jobId ?? null,
    channel: body.channel,
    name: body.name,
    code,
    utmSource: body.utmSource ?? null,
    utmMedium: body.utmMedium ?? null,
    utmCampaign: body.utmCampaign ?? null,
    utmTerm: body.utmTerm ?? null,
    utmContent: body.utmContent ?? null,
    createdById: userId,
  }).returning()

  setResponseStatus(event, 201)
  return created
})

/** Generate a cryptographically random URL-safe tracking code */
function generateTrackingCode(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  // Base64url encoding without padding — 8 chars from 6 bytes
  return Buffer.from(bytes).toString('base64url')
}
