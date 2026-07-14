import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'
import { application, screeningTranscript } from '../../../../database/schema'

const paramsSchema = z.object({ id: z.string().min(1) })

/**
 * GET /api/applications/:id/transcript
 *
 * List the screening transcripts attached to an application, each with its
 * `transcript_analysis` rows (see docs/spec/transcript-analysis.md). The
 * analysis IS the product, so every non-sensitive analysis field is
 * returned in full — but list items deliberately omit `rawText` to keep the
 * payload light; the paste/upload endpoints already returned the raw text
 * at creation time, and there is no dedicated single-transcript GET yet.
 *
 * Security:
 *   - Auth + `scoring:['read']` permission required.
 *   - Application org double-scoped (`and(eq(id), eq(organizationId))`), so a
 *     cross-org application id 404s rather than leaking existence.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { scoring: ['read'] })
  const orgId = session.session.activeOrganizationId
  const { id: applicationId } = await getValidatedRouterParams(event, paramsSchema.parse)

  // Org double-scope the application lookup — cross-org ids must 404, not leak existence.
  const app = await db.query.application.findFirst({
    where: and(eq(application.id, applicationId), eq(application.organizationId, orgId)),
    columns: { id: true },
  })

  if (!app) {
    throw createError({ statusCode: 404, statusMessage: 'Application not found' })
  }

  const transcripts = await db.query.screeningTranscript.findMany({
    where: and(
      eq(screeningTranscript.applicationId, applicationId),
      eq(screeningTranscript.organizationId, orgId),
    ),
    orderBy: desc(screeningTranscript.createdAt),
    with: {
      document: { columns: { originalFilename: true } },
      analyses: true,
    },
  })

  // Deliberately omit `rawText` from list items — the analysis is the
  // product, the raw transcript text is not needed to render the list.
  return transcripts.map((t) => ({
    id: t.id,
    sourceType: t.sourceType,
    truncated: t.truncated,
    createdAt: t.createdAt,
    documentId: t.documentId,
    originalFilename: t.document?.originalFilename ?? null,
    analyses: t.analyses.map((a) => ({
      id: a.id,
      status: a.status,
      extractionMode: a.extractionMode,
      recommendation: a.recommendation,
      confidence: a.confidence,
      rationale: a.rationale,
      sectionScores: a.sectionScores,
      answerBreakdown: a.answerBreakdown,
      createdAt: a.createdAt,
    })),
  }))
})
