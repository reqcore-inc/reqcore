/// <reference path="../../.nuxt/types/nitro-imports.d.ts" />
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineEventHandler, getValidatedRouterParams, createError } from 'h3'
import { NoObjectGeneratedError } from 'ai'

/**
 * Build a real `NoObjectGeneratedError` with fully-populated constructor
 * props (the `ai` SDK's TS types mark `response`/`usage`/`finishReason` as
 * required, even though the runtime constructor doesn't enforce it) so the
 * mock construction here is a real TS error waiting to happen, not just a
 * vitest convenience. `inputTokens`/`outputTokens` let tests assert that a
 * failed attempt's token usage is still accounted for.
 */
function makeCountMismatchError(message: string, inputTokens = 0, outputTokens = 0): NoObjectGeneratedError {
  return new NoObjectGeneratedError({
    message,
    response: { id: 'resp-stub', timestamp: new Date('2026-01-01T00:00:00Z'), modelId: 'stub-model' },
    usage: {
      inputTokens,
      inputTokenDetails: { noCacheTokens: inputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 },
      outputTokens,
      outputTokenDetails: { textTokens: outputTokens, reasoningTokens: 0 },
      totalTokens: inputTokens + outputTokens,
    },
    finishReason: 'stop',
  })
}

/**
 * POST /api/applications/:id/screening-scenario — unit coverage.
 * Mirrors the mocking approach in screening-scenario-get.test.ts: h3 helpers
 * are stubbed as globals (Nitro auto-imports) before dynamically importing
 * the handler, while direct module imports (resolveProvider, budget,
 * pricing, observability, loadApplicationContext, rateLimit, and the AI
 * generation call itself) are mocked with `vi.mock` so no live AI/network
 * calls happen.
 */

const { loadApplicationContext } = vi.hoisted(() => ({ loadApplicationContext: vi.fn() }))
vi.mock('../../server/utils/loadApplicationContext', () => ({ loadApplicationContext }))

const { resolveAnalysisProvider } = vi.hoisted(() => ({ resolveAnalysisProvider: vi.fn() }))
vi.mock('../../server/utils/ai/resolveProvider', () => ({ resolveAnalysisProvider }))

const { assertPlatformBudget, MockBudgetExceededError, budgetErrorToHttp } = vi.hoisted(() => {
  class MockBudgetExceededError extends Error {
    scope: string
    constructor(scope: string, message: string) {
      super(message)
      this.name = 'BudgetExceededError'
      this.scope = scope
    }
  }
  return {
    assertPlatformBudget: vi.fn(),
    MockBudgetExceededError,
    budgetErrorToHttp: vi.fn((err: any) => ({
      statusCode: 429,
      statusMessage: err.message,
      data: { code: 'AI_BUDGET_EXCEEDED', scope: err.scope },
    })),
  }
})
vi.mock('../../server/utils/ai/budget', () => ({
  assertPlatformBudget,
  BudgetExceededError: MockBudgetExceededError,
  budgetErrorToHttp,
}))

const { computeCostUsdMicros } = vi.hoisted(() => ({ computeCostUsdMicros: vi.fn(() => 1234) }))
vi.mock('../../server/utils/ai/pricing', () => ({ computeCostUsdMicros }))

const { captureAiGeneration } = vi.hoisted(() => ({ captureAiGeneration: vi.fn() }))
vi.mock('../../server/utils/ai/observability', () => ({ captureAiGeneration }))

const { createRateLimiter } = vi.hoisted(() => ({ createRateLimiter: vi.fn(() => vi.fn(async () => {})) }))
vi.mock('../../server/utils/rateLimit', () => ({ createRateLimiter }))

const { generateScreeningScenario } = vi.hoisted(() => ({ generateScreeningScenario: vi.fn() }))
vi.mock('../../server/utils/ai/screeningScenario', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/utils/ai/screeningScenario')>()
  return { ...actual, generateScreeningScenario }
})

vi.stubGlobal('defineEventHandler', defineEventHandler)
vi.stubGlobal('getValidatedRouterParams', getValidatedRouterParams)
vi.stubGlobal('createError', createError)

let screeningScenarioPostHandler: (event: any) => Promise<any>

beforeAll(async () => {
  const mod = await import('../../server/api/applications/[id]/screening-scenario.post')
  screeningScenarioPostHandler = mod.default
})

afterEach(() => {
  vi.unstubAllGlobals()
  // `vi.unstubAllGlobals()` clears every global stub, including the h3
  // helpers this file owns AND tests/setup.ts's logger stubs (logInfo/
  // logWarn/logError/logDebug), which run once before this whole file and
  // would otherwise stay wiped for the rest of the file's tests.
  vi.stubGlobal('defineEventHandler', defineEventHandler)
  vi.stubGlobal('getValidatedRouterParams', getValidatedRouterParams)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('logInfo', vi.fn())
  vi.stubGlobal('logWarn', vi.fn())
  vi.stubGlobal('logError', vi.fn())
  vi.stubGlobal('logDebug', vi.fn())
  loadApplicationContext.mockReset()
  resolveAnalysisProvider.mockReset()
  assertPlatformBudget.mockReset()
  budgetErrorToHttp.mockClear()
  computeCostUsdMicros.mockReset().mockReturnValue(1234)
  captureAiGeneration.mockClear()
  generateScreeningScenario.mockReset()
})

const BASE_CONTEXT = {
  applicationId: 'app-1',
  organizationId: 'org-1',
  jobId: 'job-1',
  jobTitle: 'Senior Backend Engineer',
  jobDescription: 'Build and scale our Node.js APIs.',
  candidateId: 'cand-1',
  candidateFirstName: 'Jane',
  candidateLastName: 'Doe',
  notes: null,
  coverLetterText: null,
  resumeDocumentId: 'doc-1',
  resumeText: 'Jane has 6 years of Node.js experience.',
  compositeScore: 82,
  criterionScores: [
    {
      criterionKey: 'technical-skills',
      maxScore: 10,
      applicantScore: 8,
      confidence: 90,
      evidence: 'Strong Node.js background.',
      strengths: ['Node.js', 'PostgreSQL'],
      gaps: ['No Kubernetes experience'],
    },
  ],
}

const BASE_RESOLVED = {
  providerConfig: { provider: 'openrouter', model: 'gpt-4.1-mini', apiKeyEncrypted: 'enc', baseUrl: null, maxTokens: 4096 },
  billingMode: 'byok' as const,
  provider: 'openrouter',
  model: 'gpt-4.1-mini',
}

const VALID_BODY = { questionCount: 8, tone: 'balanced' as const }

function makeInsertMock(returningRow: any = { id: 'scn-1' }) {
  const insertCalls: any[] = []
  const insert = vi.fn(() => ({
    values: vi.fn((vals: any) => {
      insertCalls.push(vals)
      return {
        returning: vi.fn(async () => [{ ...vals, ...returningRow }]),
        then: (resolve: any) => resolve(undefined),
      }
    }),
  }))
  return { insert, insertCalls }
}

function makeEvent(applicationId: string, body: any = VALID_BODY) {
  vi.stubGlobal('readBody', vi.fn(async () => body))
  return { context: { params: { id: applicationId } }, headers: new Headers() } as any
}

function stubSession(orgId = 'org-1', userId = 'user-1') {
  vi.stubGlobal('requirePermission', vi.fn(async () => ({
    session: { activeOrganizationId: orgId },
    user: { id: userId },
  })))
}

describe('POST /api/applications/:id/screening-scenario', () => {
  it('rejects questionCount below 5', async () => {
    stubSession()
    const { insert } = makeInsertMock()
    vi.stubGlobal('db', { insert })
    loadApplicationContext.mockResolvedValue(BASE_CONTEXT)
    resolveAnalysisProvider.mockResolvedValue(BASE_RESOLVED)

    await expect(screeningScenarioPostHandler(makeEvent('app-1', { questionCount: 4, tone: 'balanced' })))
      .rejects.toThrow()
  })

  it('rejects questionCount above 15', async () => {
    stubSession()
    const { insert } = makeInsertMock()
    vi.stubGlobal('db', { insert })
    loadApplicationContext.mockResolvedValue(BASE_CONTEXT)
    resolveAnalysisProvider.mockResolvedValue(BASE_RESOLVED)

    await expect(screeningScenarioPostHandler(makeEvent('app-1', { questionCount: 16, tone: 'balanced' })))
      .rejects.toThrow()
  })

  it('rejects an invalid tone', async () => {
    stubSession()
    const { insert } = makeInsertMock()
    vi.stubGlobal('db', { insert })
    loadApplicationContext.mockResolvedValue(BASE_CONTEXT)
    resolveAnalysisProvider.mockResolvedValue(BASE_RESOLVED)

    await expect(screeningScenarioPostHandler(makeEvent('app-1', { questionCount: 8, tone: 'excited' })))
      .rejects.toThrow()
  })

  it('returns 404 when the application belongs to a different organization (IDOR guard)', async () => {
    stubSession('org-victim')
    const { insert } = makeInsertMock()
    vi.stubGlobal('db', { insert })
    loadApplicationContext.mockResolvedValue(null)

    await expect(screeningScenarioPostHandler(makeEvent('app-1'))).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Application not found',
    })

    // Assert the org id actually reached the IDOR-guarded context loader as a
    // call argument, not just that the mock was configured to return null.
    expect(loadApplicationContext).toHaveBeenCalledWith('app-1', 'org-victim')
  })

  it('returns 422 when the job has no description', async () => {
    stubSession()
    const { insert } = makeInsertMock()
    vi.stubGlobal('db', { insert })
    loadApplicationContext.mockResolvedValue({ ...BASE_CONTEXT, jobDescription: null })

    await expect(screeningScenarioPostHandler(makeEvent('app-1'))).rejects.toMatchObject({
      statusCode: 422,
    })
  })

  it('proceeds when resumeText is null (missing resume is allowed)', async () => {
    stubSession()
    const { insert, insertCalls } = makeInsertMock()
    vi.stubGlobal('db', { insert })
    loadApplicationContext.mockResolvedValue({ ...BASE_CONTEXT, resumeText: null, resumeDocumentId: null })
    resolveAnalysisProvider.mockResolvedValue(BASE_RESOLVED)
    generateScreeningScenario.mockResolvedValue({
      scenario: { questions: [{ category: 'Motivation', question: 'Why this role?', rationale: 'Checks fit.' }] },
      usage: { promptTokens: 100, completionTokens: 50 },
    })

    const result = await screeningScenarioPostHandler(makeEvent('app-1'))

    expect(result).toBeTruthy()
    expect(generateScreeningScenario).toHaveBeenCalledTimes(1)
    const scenarioInput = generateScreeningScenario.mock.calls[0][2]
    expect(scenarioInput.resumeText).toBeNull()
    expect(insertCalls[0].status).toBe('completed')
  })

  it('maps a budget-exceeded error via budgetErrorToHttp', async () => {
    stubSession()
    const { insert } = makeInsertMock()
    vi.stubGlobal('db', { insert })
    loadApplicationContext.mockResolvedValue(BASE_CONTEXT)
    resolveAnalysisProvider.mockResolvedValue({ ...BASE_RESOLVED, billingMode: 'platform' })
    assertPlatformBudget.mockRejectedValue(new MockBudgetExceededError('org_monthly', 'Monthly AI budget reached'))

    await expect(screeningScenarioPostHandler(makeEvent('app-1'))).rejects.toMatchObject({
      statusCode: 429,
      data: { code: 'AI_BUDGET_EXCEEDED', scope: 'org_monthly' },
    })
    expect(budgetErrorToHttp).toHaveBeenCalledTimes(1)
  })

  it('inserts a failed row and returns 502 on a generation/network failure (no retry)', async () => {
    stubSession()
    const { insert, insertCalls } = makeInsertMock()
    vi.stubGlobal('db', { insert })
    loadApplicationContext.mockResolvedValue(BASE_CONTEXT)
    resolveAnalysisProvider.mockResolvedValue(BASE_RESOLVED)
    generateScreeningScenario.mockRejectedValue(new Error('upstream connection reset'))

    await expect(screeningScenarioPostHandler(makeEvent('app-1'))).rejects.toMatchObject({
      statusCode: 502,
      // Raw provider/LLM error text must never reach the client — the
      // thrown statusMessage collapses to a fixed, generic string. The
      // detailed message (with the raw err.message) is persisted
      // server-side only, asserted below via insertCalls[0].errorMessage.
      statusMessage: 'Screening scenario generation failed',
    })

    expect(generateScreeningScenario).toHaveBeenCalledTimes(1)
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0].status).toBe('failed')
    expect(insertCalls[0].errorMessage).toContain('upstream connection reset')
    expect(captureAiGeneration).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }))
  })

  it('retries once on a question-count mismatch, then fails with a failed row + 502', async () => {
    stubSession()
    const { insert, insertCalls } = makeInsertMock()
    vi.stubGlobal('db', { insert })
    loadApplicationContext.mockResolvedValue(BASE_CONTEXT)
    resolveAnalysisProvider.mockResolvedValue(BASE_RESOLVED)
    generateScreeningScenario
      .mockRejectedValueOnce(makeCountMismatchError('Expected exactly 8 questions', 40, 20))
      .mockRejectedValueOnce(makeCountMismatchError('Expected exactly 8 questions', 30, 15))

    await expect(screeningScenarioPostHandler(makeEvent('app-1'))).rejects.toMatchObject({
      statusCode: 502,
      // Already a fixed, generic string (no interpolated err.message) —
      // confirmed unchanged, not re-collapsed to the fallback copy.
      statusMessage: 'AI screening scenario generation failed: model did not return the requested 8 questions after retry.',
    })

    expect(generateScreeningScenario).toHaveBeenCalledTimes(2)
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0].status).toBe('failed')
    expect(insertCalls[0].errorMessage.toLowerCase()).toContain('question')
    // Both failed attempts cost real tokens — accumulated across both, not
    // dropped just because neither attempt produced a usable object.
    expect(insertCalls[0].promptTokens).toBe(70)
    expect(insertCalls[0].completionTokens).toBe(35)
    expect(insertCalls[0].costUsdMicros).toBe(1234)
  })

  it('does not accumulate/record token usage for a plain network failure (no NoObjectGeneratedError usage available)', async () => {
    stubSession()
    const { insert, insertCalls } = makeInsertMock()
    vi.stubGlobal('db', { insert })
    loadApplicationContext.mockResolvedValue(BASE_CONTEXT)
    resolveAnalysisProvider.mockResolvedValue(BASE_RESOLVED)
    generateScreeningScenario.mockRejectedValue(new Error('upstream connection reset'))

    await expect(screeningScenarioPostHandler(makeEvent('app-1'))).rejects.toMatchObject({ statusCode: 502 })

    expect(insertCalls[0].promptTokens).toBeNull()
    expect(insertCalls[0].completionTokens).toBeNull()
    expect(insertCalls[0].costUsdMicros).toBeNull()
  })

  it('re-checks the platform budget before retrying a count mismatch, and succeeds on the second attempt', async () => {
    stubSession()
    const { insert, insertCalls } = makeInsertMock({ id: 'scn-retry-ok' })
    vi.stubGlobal('db', { insert })
    loadApplicationContext.mockResolvedValue(BASE_CONTEXT)
    resolveAnalysisProvider.mockResolvedValue({ ...BASE_RESOLVED, billingMode: 'platform' })
    assertPlatformBudget.mockResolvedValue(undefined)
    generateScreeningScenario
      .mockRejectedValueOnce(makeCountMismatchError('Expected exactly 8 questions', 40, 20))
      .mockResolvedValueOnce({
        scenario: { questions: [{ category: 'Motivation', question: 'Why this role?', rationale: 'Checks fit.' }] },
        usage: { promptTokens: 60, completionTokens: 30 },
      })

    const result = await screeningScenarioPostHandler(makeEvent('app-1'))

    expect(result).toBeTruthy()
    expect(generateScreeningScenario).toHaveBeenCalledTimes(2)
    // Initial pre-generation check + one re-check before the retry.
    expect(assertPlatformBudget).toHaveBeenCalledTimes(2)
    // Successful row records usage from BOTH attempts (the failed first try
    // spent real tokens too), not just the winning retry's usage.
    expect(insertCalls[0].promptTokens).toBe(100)
    expect(insertCalls[0].completionTokens).toBe(50)
  })

  it('maps a budget-exceeded error raised during the pre-retry re-check (no second generation call)', async () => {
    stubSession()
    const { insert } = makeInsertMock()
    vi.stubGlobal('db', { insert })
    loadApplicationContext.mockResolvedValue(BASE_CONTEXT)
    resolveAnalysisProvider.mockResolvedValue({ ...BASE_RESOLVED, billingMode: 'platform' })
    assertPlatformBudget
      .mockResolvedValueOnce(undefined) // initial pre-generation check passes
      .mockRejectedValueOnce(new MockBudgetExceededError('org_monthly', 'Monthly AI budget reached')) // re-check before retry fails
    generateScreeningScenario.mockRejectedValue(makeCountMismatchError('Expected exactly 8 questions', 40, 20))

    await expect(screeningScenarioPostHandler(makeEvent('app-1'))).rejects.toMatchObject({
      statusCode: 429,
      data: { code: 'AI_BUDGET_EXCEEDED', scope: 'org_monthly' },
    })

    // Only the first attempt ran — the retry never happened because the
    // re-check failed before generateScreeningScenario was called again.
    expect(generateScreeningScenario).toHaveBeenCalledTimes(1)
    expect(assertPlatformBudget).toHaveBeenCalledTimes(2)
  })

  it('inserts a completed row with mapped reasoning + cost fields on success', async () => {
    stubSession()
    const { insert, insertCalls } = makeInsertMock({ id: 'scn-99' })
    vi.stubGlobal('db', { insert })
    loadApplicationContext.mockResolvedValue(BASE_CONTEXT)
    resolveAnalysisProvider.mockResolvedValue(BASE_RESOLVED)
    generateScreeningScenario.mockResolvedValue({
      scenario: {
        questions: Array.from({ length: 8 }, (_, i) => ({
          category: 'Technical Depth',
          question: `Question ${i}`,
          rationale: 'Because reasons.',
        })),
      },
      usage: { promptTokens: 200, completionTokens: 120 },
    })

    const result = await screeningScenarioPostHandler(makeEvent('app-1'))

    expect(generateScreeningScenario).toHaveBeenCalledTimes(1)
    const scenarioInput = generateScreeningScenario.mock.calls[0][2]
    expect(scenarioInput.criterionScores).toEqual([
      { name: 'technical-skills', applicantScore: 8, maxScore: 10, reasoning: expect.stringContaining('Strong Node.js background.') },
    ])
    expect(scenarioInput.criterionScores[0].reasoning).toContain('Strengths')
    expect(scenarioInput.criterionScores[0].reasoning).toContain('Gaps')

    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0].status).toBe('completed')
    expect(insertCalls[0].promptTokens).toBe(200)
    expect(insertCalls[0].completionTokens).toBe(120)
    expect(insertCalls[0].costUsdMicros).toBe(1234)
    expect(insertCalls[0].questions).toHaveLength(8)
    expect(insertCalls[0].generatedById).toBe('user-1')
    expect(result.id).toBe('scn-99')
    expect(captureAiGeneration).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }))
  })

  it('returns a curated response matching the GET endpoint whitelist exactly — no billing/internal fields', async () => {
    stubSession()
    const { insert } = makeInsertMock({ id: 'scn-shape' })
    vi.stubGlobal('db', { insert })
    loadApplicationContext.mockResolvedValue(BASE_CONTEXT)
    resolveAnalysisProvider.mockResolvedValue(BASE_RESOLVED)
    generateScreeningScenario.mockResolvedValue({
      scenario: {
        questions: [{ category: 'Technical Depth', question: 'Q1', rationale: 'Because reasons.' }],
      },
      usage: { promptTokens: 200, completionTokens: 120 },
    })

    const result = await screeningScenarioPostHandler(makeEvent('app-1'))

    // Whitelisted fields present — matching the GET endpoint's shape exactly.
    expect(Object.keys(result).sort()).toEqual([
      'completionTokens',
      'config',
      'createdAt',
      'errorMessage',
      'id',
      'model',
      'provider',
      'promptTokens',
      'questions',
      'status',
    ].sort())

    // Internal/billing fields are never forwarded to the client.
    expect(result).not.toHaveProperty('organizationId')
    expect(result).not.toHaveProperty('applicationId')
    expect(result).not.toHaveProperty('billingMode')
    expect(result).not.toHaveProperty('costUsdMicros')
    expect(result).not.toHaveProperty('generatedById')
    expect(result).not.toHaveProperty('inputSnapshot')

    // A completed row has no error — collapses to null, same as GET.
    expect(result.errorMessage).toBeNull()
  })
})
