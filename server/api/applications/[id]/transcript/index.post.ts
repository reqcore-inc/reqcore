import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { application, screeningTranscript } from '../../../../database/schema'
import { transcriptPasteSchema } from '../../../../utils/schemas/transcript'
import { findActiveCandidate } from '../../../../utils/candidate-retention'

const paramsSchema = z.object({ id: z.string().min(1) })

/**
 * POST /api/applications/:id/transcript
 *
 * Attach a screening-call transcript to an application by pasting plain
 * text (the "paste" path — see docs/spec/transcript-analysis.md). The
 * "upload" path (PDF/DOC/DOCX) is a separate endpoint.
 *
 * Security:
 *   - Auth + `scoring:['create']` permission required (same permission as
 *     running an analysis; paste + run share a gate per spec).
 *   - Application org double-scoped (`and(eq(id), eq(organizationId))`),
 *     so a cross-org application id 404s rather than leaking existence.
 *   - Quarantine gate (`findActiveCandidate`) on the application's candidate —
 *     no transcript can be attached to a candidate under GDPR retention hold.
 *   - Body validated with `transcriptPasteSchema` (1..200,000 chars); h3's
 *     `readValidatedBody` turns a Zod validation failure into a 400.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { scoring: ['create'] })
  const orgId = session.session.activeOrganizationId
  const { id: applicationId } = await getValidatedRouterParams(event, paramsSchema.parse)

  // Org double-scope the application lookup — cross-org ids must 404, not leak existence.
  const app = await db.query.application.findFirst({
    where: and(eq(application.id, applicationId), eq(application.organizationId, orgId)),
    columns: { id: true, candidateId: true },
  })

  if (!app) {
    throw createError({ statusCode: 404, statusMessage: 'Application not found' })
  }

  // Quarantine gate — no new transcript for a candidate under retention hold.
  const activeCandidate = await findActiveCandidate(orgId, app.candidateId)

  if (!activeCandidate) {
    throw createError({ statusCode: 409, statusMessage: 'Candidate is quarantined or not found' })
  }

  const body = await readValidatedBody(event, transcriptPasteSchema.parse)

  const [created] = await db.insert(screeningTranscript).values({
    organizationId: orgId,
    applicationId,
    sourceType: 'paste',
    documentId: null,
    rawText: body.text,
    truncated: false,
    createdById: session.user.id,
  }).returning({
    id: screeningTranscript.id,
    createdAt: screeningTranscript.createdAt,
    sourceType: screeningTranscript.sourceType,
  })

  if (!created) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create transcript' })
  }

  setResponseStatus(event, 201)
  return created
})
