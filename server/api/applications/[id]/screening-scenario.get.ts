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

  // Deliberately withhold billing/internal-audit columns from scoring:read
  // callers — mirrors scores.get.ts, which never returns analysisRun's
  // billingMode/scoredById to the client. `costUsdMicros` (platform spend)
  // and `generatedById` (internal user id) stay server-side only.
  // Token counts (promptTokens/completionTokens) ARE exposed here because
  // scores.get.ts's precedent already exposes the equivalent analysisRun
  // columns to scoring:read — token counts are considered safe usage
  // metadata, not billing/internal-identity data.
  const rows = await db.select({
    id: screeningScenario.id,
    questions: screeningScenario.questions,
    config: screeningScenario.config,
    status: screeningScenario.status,
    provider: screeningScenario.provider,
    model: screeningScenario.model,
    promptTokens: screeningScenario.promptTokens,
    completionTokens: screeningScenario.completionTokens,
    errorMessage: screeningScenario.errorMessage,
    createdAt: screeningScenario.createdAt,
  })
    .from(screeningScenario)
    .where(and(
      eq(screeningScenario.applicationId, applicationId),
      eq(screeningScenario.organizationId, orgId),
    ))
    .orderBy(desc(screeningScenario.createdAt))
    .limit(HISTORY_LIMIT)

  // Never forward raw provider/LLM error text to the client — collapse any
  // stored error into a fixed, user-facing indicator.
  const history = rows.map(row => ({
    ...row,
    errorMessage: row.errorMessage ? 'generation_failed' : null,
  }))

  return {
    latest: history[0] ?? null,
    history,
  }
})
