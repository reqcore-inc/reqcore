import { NoObjectGeneratedError } from 'ai'
import { screeningScenario } from '../../../database/schema'
import {
  screeningScenarioConfigSchema,
  generateScreeningScenario,
  type ScreeningScenarioInput,
} from '../../../utils/ai/screeningScenario'
import { resolveAnalysisProvider } from '../../../utils/ai/resolveProvider'
import { assertPlatformBudget, BudgetExceededError, budgetErrorToHttp } from '../../../utils/ai/budget'
import { computeCostUsdMicros } from '../../../utils/ai/pricing'
import { captureAiGeneration } from '../../../utils/ai/observability'
import { loadApplicationContext, type CriterionScoreEntry } from '../../../utils/loadApplicationContext'
import { createRateLimiter } from '../../../utils/rateLimit'
import { z } from 'zod'

const paramsSchema = z.object({ id: z.string().min(1) })
const bodySchema = screeningScenarioConfigSchema.extend({
  /** Optional override; falls back to the org's analysis default. */
  aiConfigId: z.string().min(1).nullable().optional(),
})

// Stricter than analyze's 20/min — generation is more expensive per call
// (larger prompts, more output tokens) and is triggered less frequently.
const limiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
  message: 'Too many screening scenario requests. Please wait before retrying.',
})

/** Job description / input snapshot excerpt length — keeps the audit
 *  snapshot compact and PII-light (no full CV text). */
const SNAPSHOT_EXCERPT_LENGTH = 500

/** Number of generation attempts before giving up on a question-count /
 *  schema mismatch. One retry with the same prompt, then fail. */
const MAX_GENERATION_ATTEMPTS = 2

/**
 * Join a persisted criterion score's evidence/strengths/gaps into the single
 * `reasoning` string expected by `ScreeningScenarioInput` — there is no 1:1
 * `reasoning` column on `criterion_score` (see the NOTE in screeningScenario.ts).
 */
function buildReasoning(c: CriterionScoreEntry): string | undefined {
  const parts: string[] = []
  if (c.evidence) parts.push(c.evidence)
  if (c.strengths && c.strengths.length > 0) parts.push(`Strengths: ${c.strengths.join(', ')}`)
  if (c.gaps && c.gaps.length > 0) parts.push(`Gaps: ${c.gaps.join(', ')}`)
  return parts.length > 0 ? parts.join(' ') : undefined
}

/**
 * Best-effort token usage pulled off a `NoObjectGeneratedError` — the AI SDK
 * populates `.usage` from the provider response even when schema validation
 * failed, so a rejected (over-budget) attempt still cost real tokens. Missing/
 * undefined fields count as 0 rather than dropping the whole attempt's usage.
 */
function usageFromError(err: unknown): { promptTokens: number; completionTokens: number } {
  if (!NoObjectGeneratedError.isInstance(err)) return { promptTokens: 0, completionTokens: 0 }
  const usage = (err as NoObjectGeneratedError).usage
  return {
    promptTokens: usage?.inputTokens ?? 0,
    completionTokens: usage?.outputTokens ?? 0,
  }
}

/**
 * Curate the client-facing shape of a `screening_scenario` row — mirrors the
 * GET endpoint's whitelist exactly (POST response === GET `latest` shape):
 * id/status/provider/model/config/questions/promptTokens/completionTokens/
 * errorMessage/createdAt. `organizationId`, `billingMode`, `costUsdMicros`,
 * `generatedById`, and `inputSnapshot` are internal/billing fields and never
 * reach the client. Raw provider/LLM error text is collapsed to a fixed
 * indicator, same as the GET endpoint.
 */
function toClientScenario(row: {
  id: string
  status: string
  provider: string | null
  model: string | null
  config: unknown
  questions: unknown
  promptTokens: number | null
  completionTokens: number | null
  errorMessage: string | null
  createdAt: Date
}) {
  return {
    id: row.id,
    status: row.status,
    provider: row.provider,
    model: row.model,
    config: row.config,
    questions: row.questions,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    errorMessage: row.errorMessage ? 'generation_failed' : null,
    createdAt: row.createdAt,
  }
}

/**
 * POST /api/applications/:id/screening-scenario
 * Generate an AI screening-call interview script for a candidate/job pairing
 * and store it. Mirrors analyze.post.ts's provider-resolution / budget /
 * observability structure, but (unlike analyze) a missing/unparsed resume is
 * allowed — generation proceeds weighted to the job description, and the
 * prompt builder already renders the "no resume available" note.
 */
export default defineEventHandler(async (event) => {
  await limiter(event)
  const session = await requirePermission(event, { scoring: ['create'] })
  const orgId = session.session.activeOrganizationId
  const { id: applicationId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = bodySchema.parse(await readBody(event))

  // Load application + candidate + job + resume text + scores, org-scoped and
  // IDOR-guarded. This is the only application lookup this endpoint performs —
  // the org predicate reaching this call is what keeps cross-org access closed.
  const context = await loadApplicationContext(applicationId, orgId)

  if (!context) {
    throw createError({ statusCode: 404, statusMessage: 'Application not found' })
  }

  if (!context.jobDescription) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Job description is required to generate a screening scenario.',
    })
  }

  // Resolve provider: org's own key (BYOK) → platform key (OpenRouter) → 422.
  const resolved = await resolveAnalysisProvider(orgId, { preferId: body.aiConfigId ?? null })

  // Money-safety gate: only platform-paid runs are budget-capped.
  if (resolved.billingMode === 'platform') {
    try {
      await assertPlatformBudget(orgId)
    } catch (err) {
      if (err instanceof BudgetExceededError) throw budgetErrorToHttp(err)
      throw createError({ statusCode: 503, statusMessage: 'AI budget check failed. Please try again later.' })
    }
  }

  const scenarioConfig = { questionCount: body.questionCount, tone: body.tone }

  // Missing/empty score is allowed — nulls flow through to the prompt builder.
  const mappedCriterionScores = context.criterionScores.length > 0
    ? context.criterionScores.map(c => ({
        name: c.criterionKey,
        applicantScore: c.applicantScore,
        maxScore: c.maxScore,
        reasoning: buildReasoning(c),
      }))
    : null

  const scenarioInput: ScreeningScenarioInput = {
    jobTitle: context.jobTitle,
    jobDescription: context.jobDescription,
    candidateName: `${context.candidateFirstName} ${context.candidateLastName}`,
    resumeText: context.resumeText,
    compositeScore: context.compositeScore,
    criterionScores: mappedCriterionScores,
  }

  const startedAt = Date.now()

  async function recordFailure(errorMessage: string, promptTokens: number, completionTokens: number) {
    const hasUsage = promptTokens > 0 || completionTokens > 0
    const costUsdMicros = hasUsage ? computeCostUsdMicros(resolved.model, promptTokens, completionTokens) : null

    await db.insert(screeningScenario).values({
      organizationId: orgId,
      applicationId,
      status: 'failed',
      provider: resolved.provider,
      model: resolved.model,
      billingMode: resolved.billingMode,
      config: scenarioConfig,
      errorMessage,
      // Best-effort — an attempt that failed schema validation still cost
      // tokens (see usageFromError). 0 when no attempt reported usage.
      promptTokens: hasUsage ? promptTokens : null,
      completionTokens: hasUsage ? completionTokens : null,
      costUsdMicros,
      generatedById: session.user.id,
    })

    captureAiGeneration({
      orgId, userId: session.user.id, applicationId, feature: 'screening_scenario',
      provider: resolved.provider, model: resolved.model, billingMode: resolved.billingMode,
      promptTokens, completionTokens, costUsdMicros,
      latencyMs: Date.now() - startedAt, status: 'failed',
    })
  }

  // Re-run the money-safety gate before a retry — the first (failed) attempt
  // already spent tokens, so a platform-paid org could have crossed the
  // budget threshold between the initial check and the retry.
  async function assertBudgetForRetry() {
    if (resolved.billingMode !== 'platform') return
    try {
      await assertPlatformBudget(orgId)
    } catch (err) {
      if (err instanceof BudgetExceededError) throw budgetErrorToHttp(err)
      throw createError({ statusCode: 503, statusMessage: 'AI budget check failed. Please try again later.' })
    }
  }

  let generation: Awaited<ReturnType<typeof generateScreeningScenario>> | undefined
  let accumulatedPromptTokens = 0
  let accumulatedCompletionTokens = 0

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    try {
      generation = await generateScreeningScenario(resolved.providerConfig, scenarioConfig, scenarioInput)
      accumulatedPromptTokens += generation.usage.promptTokens
      accumulatedCompletionTokens += generation.usage.completionTokens
      break
    } catch (err: any) {
      // The AI SDK throws NoObjectGeneratedError when the model's output fails
      // schema validation — including our exact-count `.refine()` — which is
      // distinguishable from a provider/network error. Retry once for that
      // case only; any other error (or a second count mismatch) fails outright.
      const isCountMismatch = NoObjectGeneratedError.isInstance(err)
      const errUsage = usageFromError(err)
      accumulatedPromptTokens += errUsage.promptTokens
      accumulatedCompletionTokens += errUsage.completionTokens

      if (isCountMismatch && attempt < MAX_GENERATION_ATTEMPTS) {
        await assertBudgetForRetry()
        continue
      }

      const errorMessage = isCountMismatch
        ? `Model did not return the requested ${scenarioConfig.questionCount} questions after retry (schema validation: ${err?.message ?? 'unknown'})`
        : (err?.message ?? 'Unknown error')

      await recordFailure(errorMessage, accumulatedPromptTokens, accumulatedCompletionTokens)

      // Never forward raw provider/LLM error text in the thrown statusMessage —
      // same rule as toClientScenario()/the GET endpoint. The count-mismatch
      // branch is already a fixed, generic string (no interpolated err.message);
      // the fallback branch is collapsed here too. The detailed `errorMessage`
      // (including err.message) is persisted server-side only, via recordFailure
      // (screeningScenario.errorMessage) and captureAiGeneration above.
      throw createError({
        statusCode: 502,
        statusMessage: isCountMismatch
          ? `AI screening scenario generation failed: model did not return the requested ${scenarioConfig.questionCount} questions after retry.`
          : 'Screening scenario generation failed',
      })
    }
  }

  // Total usage across every attempt (including a failed first try before a
  // successful retry) is what actually reached the provider — that's the
  // number recorded and billed, not just the winning attempt's usage.
  const promptTokens = accumulatedPromptTokens
  const completionTokens = accumulatedCompletionTokens
  const costUsdMicros = computeCostUsdMicros(resolved.model, promptTokens, completionTokens)

  // Compact, PII-light audit snapshot — no full CV text.
  const inputSnapshot = {
    jobTitle: context.jobTitle,
    jobDescriptionExcerpt: context.jobDescription.slice(0, SNAPSHOT_EXCERPT_LENGTH),
    hasResume: context.resumeText !== null,
    compositeScore: context.compositeScore,
    criteriaNames: mappedCriterionScores?.map(c => c.name) ?? [],
  }

  const [inserted] = await db.insert(screeningScenario).values({
    organizationId: orgId,
    applicationId,
    status: 'completed',
    provider: resolved.provider,
    model: resolved.model,
    billingMode: resolved.billingMode,
    config: scenarioConfig,
    inputSnapshot,
    questions: generation!.scenario.questions,
    promptTokens,
    completionTokens,
    costUsdMicros,
    generatedById: session.user.id,
  }).returning()

  captureAiGeneration({
    orgId, userId: session.user.id, applicationId, feature: 'screening_scenario',
    provider: resolved.provider, model: resolved.model, billingMode: resolved.billingMode,
    promptTokens, completionTokens,
    costUsdMicros, latencyMs: Date.now() - startedAt, status: 'completed',
    traceId: inserted!.id,
  })

  return toClientScenario(inserted!)
})
