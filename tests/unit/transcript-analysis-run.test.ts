import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * POST /api/applications/:id/transcript-analysis (run endpoint, TA3.2).
 *
 * Mirrors the endpoint-test stub harness used by
 * tests/unit/transcript-paste.test.ts and the mock-module approach used by
 * tests/unit/ai-provider-grandfathered.test.ts: Nitro auto-imports are
 * stubbed via `vi.stubGlobal`, and the AI engine/provider/budget modules are
 * mocked so no real LLM call ever happens.
 */

const { findActiveCandidate } = vi.hoisted(() => ({
  findActiveCandidate: vi.fn(),
}))
vi.mock('../../server/utils/candidate-retention', () => ({ findActiveCandidate }))

const { resolveAnalysisProvider } = vi.hoisted(() => ({
  resolveAnalysisProvider: vi.fn(),
}))
vi.mock('../../server/utils/ai/resolveProvider', () => ({ resolveAnalysisProvider }))

const { assertPlatformBudget, BudgetExceededError, budgetErrorToHttp } = vi.hoisted(() => {
  class BudgetExceededError extends Error {
    scope: string
    constructor(scope: string, message: string) {
      super(message)
      this.scope = scope
      this.name = 'BudgetExceededError'
    }
  }
  return {
    assertPlatformBudget: vi.fn(),
    BudgetExceededError,
    budgetErrorToHttp: vi.fn((err: InstanceType<typeof BudgetExceededError>) => {
      const e = new Error(err.message)
      Object.assign(e, { statusCode: 429, statusMessage: err.message, data: { code: 'AI_BUDGET_EXCEEDED', scope: err.scope } })
      return e
    }),
  }
})
vi.mock('../../server/utils/ai/budget', () => ({ assertPlatformBudget, BudgetExceededError, budgetErrorToHttp }))

const { analyzeTranscript } = vi.hoisted(() => ({
  analyzeTranscript: vi.fn(),
}))
vi.mock('../../server/utils/ai/transcriptAnalysis', () => ({ analyzeTranscript }))

const { computeCostUsdMicros } = vi.hoisted(() => ({
  computeCostUsdMicros: vi.fn(() => 1234),
}))
vi.mock('../../server/utils/ai/pricing', () => ({ computeCostUsdMicros }))

const { captureAiGeneration } = vi.hoisted(() => ({
  captureAiGeneration: vi.fn(),
}))
vi.mock('../../server/utils/ai/observability', () => ({ captureAiGeneration }))

async function loadHandler() {
  const mod = await import('../../server/api/applications/[id]/transcript-analysis.post')
  return mod.default
}

interface Scenario {
  application?: { id: string, candidate: { id: string }, job: { id: string, title: string, description: string | null } } | undefined
  activeCandidate?: { id: string } | undefined
  transcript?: { id: string, applicationId: string, sourceType: 'paste' | 'upload', documentId: string | null, rawText: string | null } | undefined
  transcriptDocument?: { id: string, parsedContent: unknown } | undefined
  criteria?: unknown[]
  resumeDocument?: { parsedContent: unknown } | undefined
  resolvedProvider?: { provider: string, model: string, billingMode: 'platform' | 'byok', providerConfig: unknown }
  insertedRunReturn?: { id: string }[]
  insertedAnalysisReturn?: Record<string, unknown>[]
}

function stubEnvironment(scenario: Scenario) {
  const applicationFindFirst = vi.fn(async () => scenario.application)
  const transcriptFindFirst = vi.fn(async () => scenario.transcript)
  const documentFindFirst = vi.fn(async () => scenario.transcriptDocument)

  const selectResults: unknown[][] = []
  // First select() call in the handler = scoringCriterion, second (optional) = resume document.
  const criteriaRows = scenario.criteria ?? []
  const resumeRows = scenario.resumeDocument ? [scenario.resumeDocument] : []
  selectResults.push(criteriaRows, resumeRows)

  let selectCallCount = 0
  const select = vi.fn(() => {
    const idx = selectCallCount
    selectCallCount += 1
    const rows = selectResults[idx] ?? []
    return {
      from: () => ({
        where: async () => rows,
      }),
    }
  })

  const runReturning = vi.fn(async () => scenario.insertedRunReturn ?? [{ id: 'run-1' }])
  const runValues = vi.fn(() => ({ returning: runReturning }))
  const analysisReturning = vi.fn(async () => scenario.insertedAnalysisReturn ?? [{ id: 'analysis-1' }])
  const analysisValues = vi.fn(() => ({ returning: analysisReturning }))

  // Top-level insert (used for the FAILED-run audit row path, outside a transaction)
  const topLevelInsertValues = vi.fn(() => ({ returning: runReturning }))
  const insert = vi.fn((table: unknown) => ({ values: (table === 'analysisRun-marker' ? topLevelInsertValues : topLevelInsertValues) }))

  // Transaction: db.transaction(async (tx) => { tx.insert(analysisRun)...; tx.insert(transcriptAnalysis)... })
  let txInsertCallCount = 0
  const transaction = vi.fn(async (cb: (tx: unknown) => unknown) => {
    const tx = {
      insert: vi.fn(() => {
        const callIdx = txInsertCallCount
        txInsertCallCount += 1
        // First tx insert = analysisRun, second = transcriptAnalysis
        return { values: callIdx === 0 ? runValues : analysisValues }
      }),
    }
    return cb(tx)
  })

  vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
  vi.stubGlobal('requirePermission', vi.fn(async () => ({
    user: { id: 'user-1' },
    session: { activeOrganizationId: 'org-1' },
  })))
  const createError = (opts: Record<string, unknown>) => {
    const err = new Error(String(opts.statusMessage ?? 'error'))
    Object.assign(err, opts)
    return err
  }
  vi.stubGlobal('getValidatedRouterParams', async (event: any, validator: any) => {
    try {
      return await validator(event.context.params)
    } catch (err) {
      throw createError({ statusCode: 400, statusMessage: 'Validation Error', data: err })
    }
  })
  vi.stubGlobal('readValidatedBody', async (event: any, validator: any) => {
    try {
      return await validator(event.__body)
    } catch (err) {
      throw createError({ statusCode: 400, statusMessage: 'Validation Error', data: err })
    }
  })
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('setResponseStatus', vi.fn())
  vi.stubGlobal('setResponseHeaders', vi.fn())
  vi.stubGlobal('setResponseHeader', vi.fn())
  vi.stubGlobal('getRequestIP', vi.fn(() => '127.0.0.1'))
  vi.stubGlobal('getHeader', vi.fn(() => undefined))
  vi.stubGlobal('recordActivity', vi.fn())
  vi.stubGlobal('env', { TRUSTED_PROXY_IP: undefined })
  vi.stubGlobal('db', {
    query: {
      application: { findFirst: applicationFindFirst },
      screeningTranscript: { findFirst: transcriptFindFirst },
      document: { findFirst: documentFindFirst },
    },
    select,
    insert,
    transaction,
  })

  findActiveCandidate.mockReset()
  findActiveCandidate.mockImplementation(async () => scenario.activeCandidate)

  resolveAnalysisProvider.mockReset()
  resolveAnalysisProvider.mockImplementation(async () => scenario.resolvedProvider ?? {
    provider: 'openrouter',
    model: 'openai/gpt-4.1-mini',
    billingMode: 'byok',
    providerConfig: {},
  })

  assertPlatformBudget.mockReset()
  assertPlatformBudget.mockImplementation(async () => undefined)

  analyzeTranscript.mockReset()
  captureAiGeneration.mockReset()
  computeCostUsdMicros.mockClear()

  return { applicationFindFirst, transcriptFindFirst, documentFindFirst, select, insert, transaction, runValues, analysisValues, topLevelInsertValues }
}

function makeEvent(id: string, body: unknown) {
  return { context: { params: { id } }, __body: body, node: { req: { socket: {} } } }
}

const BASE_APP = {
  id: 'app-1',
  candidate: { id: 'cand-1' },
  job: { id: 'job-1', title: 'Software Engineer', description: 'Build things.' },
}

const BASE_TRANSCRIPT_PASTE = {
  id: 'transcript-1',
  applicationId: 'app-1',
  sourceType: 'paste' as const,
  documentId: null,
  rawText: 'Q: Tell me about yourself. A: I am a software engineer.',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('POST /api/applications/:id/transcript-analysis', () => {
  beforeEach(() => {
    vi.stubGlobal('logInfo', vi.fn())
    vi.stubGlobal('logWarn', vi.fn())
  })

  it('404s for a cross-org application', async () => {
    stubEnvironment({
      application: undefined,
      activeCandidate: { id: 'cand-1' },
      transcript: BASE_TRANSCRIPT_PASTE,
    })
    const handler = await loadHandler()

    await expect(handler(makeEvent('app-other-org', { transcriptId: 'transcript-1' }) as any))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejects a quarantined candidate with 409', async () => {
    stubEnvironment({
      application: BASE_APP,
      activeCandidate: undefined,
      transcript: BASE_TRANSCRIPT_PASTE,
    })
    const handler = await loadHandler()

    await expect(handler(makeEvent('app-1', { transcriptId: 'transcript-1' }) as any))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('404s for an unknown transcriptId', async () => {
    stubEnvironment({
      application: BASE_APP,
      activeCandidate: { id: 'cand-1' },
      transcript: undefined,
    })
    const handler = await loadHandler()

    await expect(handler(makeEvent('app-1', { transcriptId: 'transcript-does-not-exist' }) as any))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('maps BudgetExceededError to 429 for platform billing mode', async () => {
    stubEnvironment({
      application: BASE_APP,
      activeCandidate: { id: 'cand-1' },
      transcript: BASE_TRANSCRIPT_PASTE,
      resolvedProvider: {
        provider: 'openrouter', model: 'openai/gpt-4.1-mini', billingMode: 'platform', providerConfig: {},
      },
    })
    assertPlatformBudget.mockImplementation(async () => {
      throw new BudgetExceededError('org_monthly', 'Monthly AI budget reached')
    })
    const handler = await loadHandler()

    await expect(handler(makeEvent('app-1', { transcriptId: 'transcript-1' }) as any))
      .rejects.toMatchObject({ statusCode: 429 })
    expect(analyzeTranscript).not.toHaveBeenCalled()
  })

  it('skips assertPlatformBudget for BYOK billing mode', async () => {
    const { insert } = stubEnvironment({
      application: BASE_APP,
      activeCandidate: { id: 'cand-1' },
      transcript: BASE_TRANSCRIPT_PASTE,
      resolvedProvider: {
        provider: 'anthropic', model: 'claude-sonnet-4-20250514', billingMode: 'byok', providerConfig: {},
      },
    })
    analyzeTranscript.mockImplementation(async () => ({
      analysis: {
        answerBreakdown: null,
        sectionScores: [{ section: 'Communication', score: 8, maxScore: 10, evidence: 'evidence', summary: 'summary' }],
        extractionMode: 'section_level',
        pairingConfidence: 30,
        recommendation: 'advance',
        confidence: 80,
        rationale: 'Solid answers.',
      },
      truncated: false,
      usage: { promptTokens: 100, completionTokens: 50 },
    }))
    const handler = await loadHandler()

    await handler(makeEvent('app-1', { transcriptId: 'transcript-1' }) as any)

    expect(assertPlatformBudget).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled() // no failed-run row on the success path
  })

  it('on engine failure: writes a FAILED analysis_run row (kind=transcript_analysis) and no transcript_analysis row', async () => {
    const { insert, transaction, topLevelInsertValues } = stubEnvironment({
      application: BASE_APP,
      activeCandidate: { id: 'cand-1' },
      transcript: BASE_TRANSCRIPT_PASTE,
      resolvedProvider: {
        provider: 'openrouter', model: 'openai/gpt-4.1-mini', billingMode: 'byok', providerConfig: {},
      },
    })
    analyzeTranscript.mockImplementation(async () => {
      throw new Error('Malformed AI JSON output')
    })
    const handler = await loadHandler()

    await expect(handler(makeEvent('app-1', { transcriptId: 'transcript-1' }) as any))
      .rejects.toMatchObject({ statusCode: 502 })

    // Failed run row inserted directly (not via the success transaction) —
    // no transcript_analysis row is ever attempted on this path.
    expect(insert).toHaveBeenCalledTimes(1)
    expect(transaction).not.toHaveBeenCalled()
    expect(topLevelInsertValues).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      applicationId: 'app-1',
      kind: 'transcript_analysis',
      status: 'failed',
      errorMessage: 'Malformed AI JSON output',
    }))
  })

  it('happy path: writes cost/billing/token fields and links transcript_analysis to the analysis_run row', async () => {
    const { transaction, runValues, analysisValues } = stubEnvironment({
      application: BASE_APP,
      activeCandidate: { id: 'cand-1' },
      transcript: BASE_TRANSCRIPT_PASTE,
      resolvedProvider: {
        provider: 'openrouter', model: 'openai/gpt-4.1-mini', billingMode: 'byok', providerConfig: {},
      },
      insertedRunReturn: [{ id: 'run-42' }],
      insertedAnalysisReturn: [{ id: 'analysis-1', recommendation: 'advance', confidence: 85 }],
    })
    analyzeTranscript.mockImplementation(async () => ({
      analysis: {
        answerBreakdown: [{ question: 'Q1', answer: 'A1', evidence: 'evidence', score: 8, confidence: 90, strengths: ['clear'], gaps: [] }],
        sectionScores: [{ section: 'Communication', score: 8, maxScore: 10, evidence: 'evidence', summary: 'summary' }],
        extractionMode: 'per_answer',
        pairingConfidence: 90,
        recommendation: 'advance',
        confidence: 85,
        rationale: 'Strong candidate.',
      },
      truncated: false,
      usage: { promptTokens: 200, completionTokens: 75 },
    }))
    const handler = await loadHandler()

    const result = await handler(makeEvent('app-1', { transcriptId: 'transcript-1' }) as any)

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(runValues).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      applicationId: 'app-1',
      kind: 'transcript_analysis',
      status: 'completed',
      provider: 'openrouter',
      model: 'openai/gpt-4.1-mini',
      billingMode: 'byok',
      promptTokens: 200,
      completionTokens: 75,
      costUsdMicros: 1234,
      scoredById: 'user-1',
    }))
    expect(analysisValues).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      transcriptId: 'transcript-1',
      applicationId: 'app-1',
      analysisRunId: 'run-42',
      status: 'completed',
      extractionMode: 'per_answer',
      recommendation: 'advance',
      confidence: 85,
      rationale: 'Strong candidate.',
    }))
    expect(captureAiGeneration).toHaveBeenCalledWith(expect.objectContaining({
      feature: 'transcript_analysis',
      billingMode: 'byok',
      status: 'completed',
    }))
    expect(result).toMatchObject({ recommendation: 'advance', analysisRunId: 'run-42' })
  })
})
