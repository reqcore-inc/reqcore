import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import {
  application, screeningTranscript, document, scoringCriterion, analysisRun, transcriptAnalysis,
} from '../../../database/schema'
import type { CriterionDefinition } from '../../../utils/ai/scoring'
import { resolveAnalysisProvider } from '../../../utils/ai/resolveProvider'
import { assertPlatformBudget, BudgetExceededError, budgetErrorToHttp } from '../../../utils/ai/budget'
import { analyzeTranscript } from '../../../utils/ai/transcriptAnalysis'
import { computeCostUsdMicros } from '../../../utils/ai/pricing'
import { captureAiGeneration } from '../../../utils/ai/observability'
import { extractResumeText } from '../../../utils/resume-parser'
import { findActiveCandidate } from '../../../utils/candidate-retention'
import { createRateLimiter } from '../../../utils/rateLimit'

const paramsSchema = z.object({ id: z.string().min(1) })
const bodySchema = z.object({
  transcriptId: z.string().min(1),
})
const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20, message: 'Too many AI analysis requests. Please wait before retrying.' })

/**
 * POST /api/applications/:id/transcript-analysis
 *
 * Run AI analysis on a screening-call transcript already attached to an
 * application (see `POST /api/applications/:id/transcript` for the
 * paste/upload path). Mirrors `analyze.post.ts` closely: rate limit,
 * provider resolution, budget gate, run-row auditing, cost freezing,
 * observability (see docs/spec/transcript-analysis.md).
 *
 * Security:
 *   - Rate limited (20/min, same limiter shape as `analyze.post.ts`).
 *   - `scoring:['create']` permission (paste + run share a gate per spec).
 *   - Application org double-scoped (`and(eq(id), eq(organizationId))`).
 *   - Quarantine gate (`findActiveCandidate`) — no analysis of a candidate
 *     under GDPR retention hold.
 *   - Transcript org+application double-scoped, so a transcript id from
 *     another application/org 404s rather than leaking existence.
 */
export default defineEventHandler(async (event) => {
  await limiter(event)
  const session = await requirePermission(event, { scoring: ['create'] })
  const orgId = session.session.activeOrganizationId
  const { id: applicationId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const { transcriptId } = await readValidatedBody(event, bodySchema.parse)

  // Fetch application with candidate + job — org double-scoped.
  const app = await db.query.application.findFirst({
    where: and(eq(application.id, applicationId), eq(application.organizationId, orgId)),
    with: {
      candidate: { columns: { id: true } },
      job: { columns: { id: true, title: true, description: true } },
    },
  })

  if (!app) {
    throw createError({ statusCode: 404, statusMessage: 'Application not found' })
  }

  // Quarantine gate — no new analysis for a candidate under retention hold.
  const activeCandidate = await findActiveCandidate(orgId, app.candidate.id)

  if (!activeCandidate) {
    throw createError({ statusCode: 409, statusMessage: 'Candidate is quarantined or not found' })
  }

  // Fetch transcript — org + application double-scoped.
  const transcript = await db.query.screeningTranscript.findFirst({
    where: and(
      eq(screeningTranscript.id, transcriptId),
      eq(screeningTranscript.applicationId, applicationId),
      eq(screeningTranscript.organizationId, orgId),
    ),
  })

  if (!transcript) {
    throw createError({ statusCode: 404, statusMessage: 'Transcript not found' })
  }

  // Resolve transcript text: rawText for paste; document.parsedContent for upload.
  let transcriptText: string | null = null
  if (transcript.sourceType === 'paste') {
    transcriptText = transcript.rawText
  } else if (transcript.documentId) {
    const transcriptDoc = await db.query.document.findFirst({
      where: and(eq(document.id, transcript.documentId), eq(document.organizationId, orgId)),
      columns: { parsedContent: true },
    })
    transcriptText = extractResumeText(transcriptDoc?.parsedContent)
  }

  if (!transcriptText) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Transcript has no extractable text. Try re-parsing the document.',
    })
  }

  // Resolve provider: org's own key (BYOK) → platform key (OpenRouter) → 422.
  const resolved = await resolveAnalysisProvider(orgId)

  // Money-safety gate: only platform-paid runs are budget-capped.
  if (resolved.billingMode === 'platform') {
    try {
      await assertPlatformBudget(orgId)
    } catch (err) {
      if (err instanceof BudgetExceededError) throw budgetErrorToHttp(err)
      throw createError({ statusCode: 503, statusMessage: 'AI budget check failed. Please try again later.' })
    }
  }

  if (!app.job.description) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Job description is required for AI analysis.',
    })
  }

  // Scoring criteria are optional for transcript analysis — the engine copes
  // with an empty array (section-level evaluation still runs).
  const criteria = await db.select().from(scoringCriterion)
    .where(and(
      eq(scoringCriterion.jobId, app.job.id),
      eq(scoringCriterion.organizationId, orgId),
    ))

  const criteriaDefinitions: CriterionDefinition[] = criteria.map((c: typeof scoringCriterion.$inferSelect) => ({
    key: c.key,
    name: c.name,
    description: c.description,
    category: c.category,
    maxScore: c.maxScore,
    weight: c.weight,
  }))

  // Candidate CV text — optional context, does not gate the run.
  const resumeDocs = await db.select({ parsedContent: document.parsedContent })
    .from(document)
    .where(and(
      eq(document.candidateId, app.candidate.id),
      eq(document.organizationId, orgId),
      eq(document.type, 'resume'),
    ))
  const resumeText = extractResumeText(resumeDocs[0]?.parsedContent)

  const startedAt = Date.now()
  let engineResult
  try {
    engineResult = await analyzeTranscript(resolved.providerConfig, {
      jobTitle: app.job.title,
      jobDescription: app.job.description,
      criteria: criteriaDefinitions,
      resumeText,
      // Not trivially available in this endpoint yet — graceful degradation.
      candidateProperties: null,
      // Screening-scenario feature has no schema yet (see spec's "Unknowns").
      scenario: null,
      transcriptText,
    })
  } catch (err: any) {
    // Record failed analysis run — companion audit row only, no transcript_analysis row.
    await db.insert(analysisRun).values({
      organizationId: orgId,
      applicationId,
      kind: 'transcript_analysis',
      status: 'failed',
      provider: resolved.provider,
      model: resolved.model,
      billingMode: resolved.billingMode,
      errorMessage: err?.message ?? 'Unknown error',
      scoredById: session.user.id,
    })

    captureAiGeneration({
      orgId, userId: session.user.id, applicationId, feature: 'transcript_analysis',
      provider: resolved.provider, model: resolved.model, billingMode: resolved.billingMode,
      promptTokens: 0, completionTokens: 0, costUsdMicros: null,
      latencyMs: Date.now() - startedAt, status: 'failed',
    })

    throw createError({
      statusCode: 502,
      statusMessage: `Transcript analysis failed: ${err?.message ?? 'Unknown error'}`,
    })
  }

  const { analysis, usage } = engineResult

  const costUsdMicros = computeCostUsdMicros(resolved.model, usage.promptTokens, usage.completionTokens)

  const [run, createdAnalysis] = await db.transaction(async (tx: any) => {
    const [insertedRun] = await tx.insert(analysisRun).values({
      organizationId: orgId,
      applicationId,
      kind: 'transcript_analysis',
      status: 'completed',
      provider: resolved.provider,
      model: resolved.model,
      billingMode: resolved.billingMode,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      costUsdMicros,
      scoredById: session.user.id,
    }).returning()

    const [insertedAnalysis] = await tx.insert(transcriptAnalysis).values({
      organizationId: orgId,
      transcriptId,
      applicationId,
      analysisRunId: insertedRun!.id,
      status: 'completed',
      answerBreakdown: analysis.answerBreakdown as any,
      sectionScores: analysis.sectionScores as any,
      extractionMode: analysis.extractionMode,
      recommendation: analysis.recommendation,
      confidence: analysis.confidence,
      rationale: analysis.rationale,
    }).returning()

    return [insertedRun, insertedAnalysis]
  })

  captureAiGeneration({
    orgId, userId: session.user.id, applicationId, feature: 'transcript_analysis',
    provider: resolved.provider, model: resolved.model, billingMode: resolved.billingMode,
    promptTokens: usage.promptTokens, completionTokens: usage.completionTokens,
    costUsdMicros, latencyMs: Date.now() - startedAt, status: 'completed',
    traceId: run!.id,
  })

  return {
    ...createdAnalysis!,
    analysisRunId: run!.id,
    usage,
  }
})
