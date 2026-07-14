import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * TA5.1 — meta-verification: coverage audit for the transcript-analysis
 * unit suite, plus the one genuine gap found (budget-429 boundary math
 * exercised through the real `assertPlatformBudget` function, not just the
 * error-mapping stub in transcript-analysis-run.test.ts).
 *
 * ── Coverage matrix (DoD item → existing test file(s) → covered?) ──────────
 *
 * | DoD item                                    | Test file(s)                                | Status  |
 * |----------------------------------------------|----------------------------------------------|---------|
 * | provider/plan resolution + BYOK fallback      | ai-provider-grandfathered.test.ts             | YES —   |
 * |   (grandfathered / free / byok paths)         |                                                | see (a) |
 * | budget-429 boundary (at-limit vs under-limit) | billing-limits.test.ts (pure constant math),  | PARTIAL |
 * |                                                | analysis-run-kind-filters.test.ts (source-    | → FIXED |
 * |                                                | shape: no kind filter), transcript-analysis-  | below,  |
 * |                                                | run.test.ts (429 HTTP mapping, budget module  | see (b) |
 * |                                                | fully mocked). NEW: this file exercises the   |         |
 * |                                                | real assertPlatformBudget() boundary.         |         |
 * | malformed/out-of-range AI JSON                | transcript-analysis-engine.test.ts            | YES     |
 * |   (clamping, invalid recommendation values)   | ('server-side clamping' describe block)       |         |
 * | prompt injection (real fixture 08)            | transcript-analysis-engine.test.ts            | YES —   |
 * |                                                | ('prompt construction' describe block reads   | see (c) |
 * |                                                | 08-prompt-injection-attempt.txt via readFixture)|        |
 * | org isolation (every new endpoint)            | transcript-paste.test.ts (POST paste),        | YES —   |
 * |                                                | transcript-upload.test.ts (POST upload),      | see (e) |
 * |                                                | transcript-read-delete.test.ts (GET list +    |         |
 * |                                                | DELETE), transcript-analysis-run.test.ts (RUN)|         |
 * | quarantine gate                               | transcript-paste/upload/analysis-run.test.ts  | YES     |
 * |                                                | (409 on quarantined candidate). GET/DELETE    |         |
 * |                                                | correctly do NOT call findActiveCandidate per |         |
 * |                                                | spec (quarantine only on upload/paste/run).   |         |
 * | parser fixtures (transcript-typed docs)       | resume-parser.test.ts (generic parseDocument),| N/A —   |
 * |                                                | transcript-upload.test.ts (mocks parseDocument)| see (d)|
 * | kind-filter regressions                       | analysis-run-kind-filters.test.ts,            | YES     |
 * |                                                | transcript-analysis-schema.test.ts,           |         |
 * |                                                | transcript-analysis-run.test.ts (kind written)|         |
 *
 * ── Findings detail ─────────────────────────────────────────────────────────
 *
 * (a) resolveAnalysisProvider() (server/utils/ai/resolveProvider.ts) is a
 *     single ORG-SCOPED function shared by scoring AND transcript-analysis
 *     runs — it has no feature/kind parameter, so its BYOK/grandfathered/
 *     platform-fallback branches are identical regardless of caller.
 *     ai-provider-grandfathered.test.ts already exercises all three branches
 *     directly against the real function. transcript-analysis-run.test.ts
 *     mocks it (correctly — that test is about the run *handler*, not the
 *     resolver), so duplicating the fallback-chain test with a
 *     transcript-flavored wrapper would just re-assert the same branches
 *     against the same function. Not a real gap — no test added here.
 *
 * (b) GENUINE GAP, FIXED BELOW: assertPlatformBudget() itself (the function
 *     the transcript run endpoint calls before invoking analyzeTranscript)
 *     had no direct unit test exercising its at-limit vs under-limit
 *     boundary against a mocked db — only (i) a pure-math test of the
 *     FREE_PLAN_ANALYSIS_LIMIT constant (billing-limits.test.ts, feature-
 *     agnostic), (ii) a source-shape assertion that its queries don't filter
 *     by `kind` (analysis-run-kind-filters.test.ts), and (iii) an error-
 *     mapping test with the whole budget module mocked out
 *     (transcript-analysis-run.test.ts). None of these actually called the
 *     real assertPlatformBudget() and checked it throws exactly at the
 *     boundary and not one run before it. Added below, in the
 *     billing-limits.test.ts boundary style, against the real function.
 *
 * (c) VERIFIED, not a gap: transcript-analysis-engine.test.ts's prompt-
 *     construction tests already `readFixture('08-prompt-injection-attempt.txt')`
 *     and assert the injected content lands inside the delimited prompt
 *     (not merged into `system`), plus a companion test asserting a
 *     malicious out-of-range mocked LLM response (confidence: 999,
 *     score: 999) is clamped, not trusted verbatim. This is the real
 *     fixture through the real prompt builder, not a synthetic string.
 *
 * (d) VERIFIED, not a gap: `parseDocument()` (server/utils/resume-parser.ts)
 *     branches purely on MIME type (pdf/docx/doc), not on document.type —
 *     there is no transcript-specific parsing code path to test. Spec
 *     confirms transcripts reuse "the existing document pipeline" verbatim
 *     (docs/spec/transcript-analysis.md, Data model section). Uploaded
 *     transcripts are typed `document.type = 'transcript'` purely for
 *     classification (erasure/DSAR/UI), not for parser dispatch.
 *     transcript-upload.test.ts already mocks parseDocument at the
 *     integration seam, matching the pattern every other document-consuming
 *     endpoint in this codebase uses. No transcript-specific parser test
 *     needed.
 *
 * (e) VERIFIED, not a gap: every new endpoint has an explicit cross-org 404
 *     test — paste (transcript-paste.test.ts:115), upload
 *     (transcript-upload.test.ts:161), GET list
 *     (transcript-read-delete.test.ts:67), DELETE
 *     (transcript-read-delete.test.ts:189 + :236, both application-scoped
 *     and transcript-scoped), RUN (transcript-analysis-run.test.ts:214).
 */

const { resolveOrgPlanId } = vi.hoisted(() => ({
  resolveOrgPlanId: vi.fn(),
}))
vi.mock('../../server/utils/billing/plan', () => ({ resolveOrgPlanId }))

import { assertPlatformBudget, BudgetExceededError, freeRunLimit, MONTHLY_BUDGET_USD } from '../../server/utils/ai/budget'

/**
 * Queue-based `db.select(...).from(...).where(...)` stub: each call to
 * `select()` consumes the next row-set in `queue`, mirroring the
 * call-order-dependent pattern already used in transcript-analysis-run.test.ts.
 */
function stubDbSelectQueue(queue: Array<{ total: string }>[]) {
  let callIndex = 0
  const select = vi.fn(() => {
    const idx = callIndex
    callIndex += 1
    const rows = queue[idx] ?? [{ total: '0' }]
    return {
      from: () => ({
        where: async () => rows,
      }),
    }
  })
  vi.stubGlobal('db', { select })
  return select
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('assertPlatformBudget — free-plan lifetime-run boundary (real function, not mocked)', () => {
  beforeEach(() => {
    resolveOrgPlanId.mockReset()
    resolveOrgPlanId.mockImplementation(async () => 'free')
  })

  it('does not throw one run under the limit', async () => {
    const limit = freeRunLimit()
    // Promise.all order for free plan: [countPlatformRuns, sumPlatformSpendMicros(day)]
    stubDbSelectQueue([[{ total: String(limit - 1) }], [{ total: '0' }]])

    await expect(assertPlatformBudget('org-under-limit')).resolves.toBeUndefined()
  })

  it('throws BudgetExceededError(org_free_limit) exactly at the limit — not one run early, not one run late', async () => {
    const limit = freeRunLimit()
    stubDbSelectQueue([[{ total: String(limit) }], [{ total: '0' }]])

    let caught: unknown
    try {
      await assertPlatformBudget('org-at-limit')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(BudgetExceededError)
    expect(caught).toMatchObject({ scope: 'org_free_limit' })
  })

  it('still throws for a count one run over the limit (already over, not just at)', async () => {
    const limit = freeRunLimit()
    stubDbSelectQueue([[{ total: String(limit + 1) }], [{ total: '0' }]])

    await expect(assertPlatformBudget('org-over-limit')).rejects.toMatchObject({ scope: 'org_free_limit' })
  })
})

describe('assertPlatformBudget — paid-plan monthly-spend boundary (real function, not mocked)', () => {
  beforeEach(() => {
    resolveOrgPlanId.mockReset()
    resolveOrgPlanId.mockImplementation(async () => 'solo')
  })

  it('does not throw when month-to-date spend is just under the monthly cap', async () => {
    const capUsd = MONTHLY_BUDGET_USD.solo!
    const underCapMicros = Math.floor((capUsd - 0.01) * 1_000_000)
    // Promise.all order for paid plan: [sumPlatformSpendMicros(month, orgId), sumPlatformSpendMicros(day)]
    stubDbSelectQueue([[{ total: String(underCapMicros) }], [{ total: '0' }]])

    await expect(assertPlatformBudget('org-solo-under-cap')).resolves.toBeUndefined()
  })

  it('throws BudgetExceededError(org_monthly) exactly at the monthly cap', async () => {
    const capUsd = MONTHLY_BUDGET_USD.solo!
    const atCapMicros = Math.round(capUsd * 1_000_000)
    stubDbSelectQueue([[{ total: String(atCapMicros) }], [{ total: '0' }]])

    await expect(assertPlatformBudget('org-solo-at-cap')).rejects.toMatchObject({ scope: 'org_monthly' })
  })
})

describe('assertPlatformBudget — kind-agnostic by construction (ties to analysis-run-kind-filters.test.ts finding (c))', () => {
  beforeEach(() => {
    resolveOrgPlanId.mockReset()
    resolveOrgPlanId.mockImplementation(async () => 'free')
  })

  it('a transcript-kind run counts toward the same free-run boundary as a scoring run — the gate has no kind predicate, so the boundary test above IS the transcript-run boundary test', async () => {
    // This test documents the link: countPlatformRuns/sumPlatformSpendMicros
    // (exercised above) have no `analysisRun.kind` filter (verified
    // structurally in analysis-run-kind-filters.test.ts), so the exact same
    // boundary math applies whether the (limit)th run was a scoring run or
    // a transcript_analysis run. There is no separate code path to test.
    const limit = freeRunLimit()
    stubDbSelectQueue([[{ total: String(limit) }], [{ total: '0' }]])

    await expect(assertPlatformBudget('org-transcript-kind-at-limit')).rejects.toMatchObject({
      scope: 'org_free_limit',
    })
  })
})
