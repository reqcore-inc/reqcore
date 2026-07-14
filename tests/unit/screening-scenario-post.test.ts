import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineEventHandler, getValidatedRouterParams, createError } from 'h3'
import { NoObjectGeneratedError } from 'ai'

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
  vi.stubGlobal('defineEventHandler', defineEventHandler)
  vi.stubGlobal('getValidatedRouterParams', getValidatedRouterParams)
  vi.stubGlobal('createError', createError)
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
    generateScreeningScenario.mockRejectedValue(
      new NoObjectGeneratedError({ message: 'Expected exactly 8 questions' }),
    )

    await expect(screeningScenarioPostHandler(makeEvent('app-1'))).rejects.toMatchObject({
      statusCode: 502,
    })

    expect(generateScreeningScenario).toHaveBeenCalledTimes(2)
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0].status).toBe('failed')
    expect(insertCalls[0].errorMessage.toLowerCase()).toContain('question')
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
})
