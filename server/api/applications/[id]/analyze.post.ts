import { eq, and } from 'drizzle-orm'
import {
  application, scoringCriterion,
  analysisRun, criterionScore,
} from '../../../database/schema'
import { scoreApplication, computeCompositeScore } from '../../../utils/ai/scoring'
import type { CriterionDefinition } from '../../../utils/ai/scoring'
import { resolveAnalysisProvider } from '../../../utils/ai/resolveProvider'
import { assertPlatformBudget, BudgetExceededError, budgetErrorToHttp } from '../../../utils/ai/budget'
import { computeCostUsdMicros } from '../../../utils/ai/pricing'
import { captureAiGeneration } from '../../../utils/ai/observability'
import { loadApplicationContext } from '../../../utils/loadApplicationContext'
import { createRateLimiter } from '../../../utils/rateLimit'
import { z } from 'zod'

const paramsSchema = z.object({ id: z.string().min(1) })
const bodySchema = z.object({
  /** Optional override; falls back to the org's analysis default. */
  aiConfigId: z.string().min(1).nullable().optional(),
}).partial().optional()
const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20, message: 'Too many AI analysis requests. Please wait before retrying.' })

/**
 * POST /api/applications/:id/analyze
 * Run AI analysis on a single application. Scores the candidate against job criteria.
 * Stores individual criterion scores + composite score + audit trail.
 */
export default defineEventHandler(async (event) => {
  await limiter(event)
  const session = await requirePermission(event, { scoring: ['create'] })
  const orgId = session.session.activeOrganizationId
  const { id: applicationId } = await getValidatedRouterParams(event, paramsSchema.parse)
  // Body is optional — GET-style "just run with defaults" stays valid.
  const body = await readBody(event).catch(() => null)
  const parsedBody = body ? bodySchema.parse(body) : null

  // Load application + candidate + job + resume text, org-scoped and IDOR-guarded.
  const context = await loadApplicationContext(applicationId, orgId)

  if (!context) {
    throw createError({ statusCode: 404, statusMessage: 'Application not found' })
  }

  // Resolve provider: org's own key (BYOK) → platform key (OpenRouter) → 422.
  const resolved = await resolveAnalysisProvider(orgId, { preferId: parsedBody?.aiConfigId ?? null })

  // Fetch scoring criteria for this job
  const criteria = await db.select().from(scoringCriterion)
    .where(and(
      eq(scoringCriterion.jobId, context.jobId),
      eq(scoringCriterion.organizationId, orgId),
    ))

  if (criteria.length === 0) {
    throw createError({
      statusCode: 422,
      statusMessage: 'No scoring criteria defined for this job. Add criteria first.',
    })
  }

  const resumeText = context.resumeText

  if (!resumeText) {
    // Resume document exists but parsing failed or was incomplete
    if (context.resumeDocumentId) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Resume was uploaded but text extraction failed. Try re-parsing the document.',
        data: { code: 'PARSE_FAILED', documentId: context.resumeDocumentId },
      })
    }
    throw createError({
      statusCode: 422,
      statusMessage: 'No resume found for this candidate. Upload a resume first.',
    })
  }

  if (!context.jobDescription) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Job description is required for AI analysis.',
    })
  }

  const criteriaDefinitions: CriterionDefinition[] = criteria.map(c => ({
    key: c.key,
    name: c.name,
    description: c.description,
    category: c.category,
    maxScore: c.maxScore,
    weight: c.weight,
  }))

  // Money-safety gate: only platform-paid runs are budget-capped. Fail-closed —
  // if spend can't be read, the run is refused rather than risk an unbounded bill.
  if (resolved.billingMode === 'platform') {
    try {
      await assertPlatformBudget(orgId)
    } catch (err) {
      if (err instanceof BudgetExceededError) throw budgetErrorToHttp(err)
      throw createError({ statusCode: 503, statusMessage: 'AI budget check failed. Please try again later.' })
    }
  }

  const startedAt = Date.now()
  let result
  try {
    result = await scoreApplication(resolved.providerConfig, {
      jobTitle: context.jobTitle,
      jobDescription: context.jobDescription,
      criteria: criteriaDefinitions,
      resumeText,
      coverLetterText: context.coverLetterText,
      applicationNotes: context.notes,
    })
  } catch (err: any) {
    // Record failed analysis run
    await db.insert(analysisRun).values({
      organizationId: orgId,
      applicationId,
      status: 'failed',
      provider: resolved.provider,
      model: resolved.model,
      billingMode: resolved.billingMode,
      criteriaSnapshot: criteriaDefinitions as any,
      errorMessage: err?.message ?? 'Unknown error',
      scoredById: session.user.id,
    })

    captureAiGeneration({
      orgId, userId: session.user.id, applicationId, feature: 'application_analysis',
      provider: resolved.provider, model: resolved.model, billingMode: resolved.billingMode,
      promptTokens: 0, completionTokens: 0, costUsdMicros: null,
      latencyMs: Date.now() - startedAt, status: 'failed',
    })

    throw createError({
      statusCode: 502,
      statusMessage: `AI analysis failed: ${err?.message ?? 'Unknown error'}`,
    })
  }

  const costUsdMicros = computeCostUsdMicros(
    resolved.model, result.usage.promptTokens, result.usage.completionTokens,
  )

  // Compute composite score
  const compositeScore = computeCompositeScore(criteriaDefinitions, result.scoring.evaluations)

  // Insert scores, update application, and record run atomically
  const scoreValues = result.scoring.evaluations.map(evaluation => ({
    organizationId: orgId,
    applicationId,
    criterionKey: evaluation.criterionKey,
    maxScore: evaluation.maxScore,
    applicantScore: evaluation.applicantScore,
    confidence: evaluation.confidence,
    evidence: evaluation.evidence,
    strengths: evaluation.strengths,
    gaps: evaluation.gaps,
  }))

  const [run] = await db.transaction(async (tx) => {
    // Delete previous scores for this application (replace strategy)
    await tx.delete(criterionScore)
      .where(and(
        eq(criterionScore.applicationId, applicationId),
        eq(criterionScore.organizationId, orgId),
      ))

    if (scoreValues.length > 0) {
      await tx.insert(criterionScore).values(scoreValues)
    }

    // Update application composite score
    await tx.update(application)
      .set({ score: compositeScore, updatedAt: new Date() })
      .where(eq(application.id, applicationId))

    // Record analysis run
    return tx.insert(analysisRun).values({
      organizationId: orgId,
      applicationId,
      status: 'completed',
      provider: resolved.provider,
      model: resolved.model,
      billingMode: resolved.billingMode,
      criteriaSnapshot: criteriaDefinitions as any,
      compositeScore,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      costUsdMicros,
      scoredById: session.user.id,
    }).returning()
  })

  captureAiGeneration({
    orgId, userId: session.user.id, applicationId, feature: 'application_analysis',
    provider: resolved.provider, model: resolved.model, billingMode: resolved.billingMode,
    promptTokens: result.usage.promptTokens, completionTokens: result.usage.completionTokens,
    costUsdMicros, latencyMs: Date.now() - startedAt, status: 'completed',
    traceId: run!.id,
  })

  recordActivity({
    organizationId: orgId,
    actorId: session.user.id,
    action: 'scored',
    resourceType: 'application',
    resourceId: applicationId,
    metadata: {
      compositeScore,
      model: resolved.model,
      criterionCount: result.scoring.evaluations.length,
    },
  })

  return {
    compositeScore,
    evaluations: result.scoring.evaluations,
    summary: result.scoring.summary,
    analysisRunId: run!.id,
    usage: result.usage,
  }
})
