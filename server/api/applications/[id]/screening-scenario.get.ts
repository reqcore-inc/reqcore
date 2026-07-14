import { eq, and, desc } from 'drizzle-orm'
import { application, screeningScenario } from '../../../database/schema'
import { z } from 'zod'

const paramsSchema = z.object({ id: z.string().min(1) })

/** History cap — per-application row counts are small (one row per generation
 *  attempt), so a plain `orderBy(desc(createdAt))` scan against the existing
 *  `screening_scenario_application_id_idx` index is fast enough. No dedicated
 *  createdAt index/migration is needed for this volume. */
const HISTORY_LIMIT = 20

/**
 * GET /api/applications/:id/screening-scenario
 * Get the latest AI-generated screening scenario for an application, plus
 * its generation history (append-only audit trail, newest first).
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { scoring: ['read'] })
  const orgId = session.session.activeOrganizationId
  const { id: applicationId } = await getValidatedRouterParams(event, paramsSchema.parse)

  // Verify application exists and is org-scoped BEFORE touching screening_scenario.
  const app = await db.query.application.findFirst({
    where: and(eq(application.id, applicationId), eq(application.organizationId, orgId)),
    columns: { id: true },
  })
  if (!app) {
    throw createError({ statusCode: 404, statusMessage: 'Application not found' })
  }

  const history = await db.select({
    id: screeningScenario.id,
    questions: screeningScenario.questions,
    config: screeningScenario.config,
    status: screeningScenario.status,
    provider: screeningScenario.provider,
    model: screeningScenario.model,
    promptTokens: screeningScenario.promptTokens,
    completionTokens: screeningScenario.completionTokens,
    costUsdMicros: screeningScenario.costUsdMicros,
    errorMessage: screeningScenario.errorMessage,
    generatedById: screeningScenario.generatedById,
    createdAt: screeningScenario.createdAt,
  })
    .from(screeningScenario)
    .where(and(
      eq(screeningScenario.applicationId, applicationId),
      eq(screeningScenario.organizationId, orgId),
    ))
    .orderBy(desc(screeningScenario.createdAt))
    .limit(HISTORY_LIMIT)

  return {
    latest: history[0] ?? null,
    history,
  }
})
