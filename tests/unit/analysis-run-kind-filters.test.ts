/**
 * TA1.2 — regression coverage for `analysis_run.kind` reader classification
 * (see docs/research/ta0.1-analysis-run-readers.md).
 *
 * Scoring-only readers must filter to `kind = 'application_scoring'` so a
 * transcript-analysis run never surfaces as "the latest scoring run" or
 * inflates scoring-volume dashboards. The budget gate (and its billing-usage
 * mirror) and the DSAR export must NOT filter by kind — they intentionally
 * count/include both kinds, which is what closes the AI-spend budget-bypass
 * blocker for transcript runs (a transcript run must still consume the same
 * free-tier lifetime allowance / org monthly budget / global daily cap).
 *
 * These are source-shape assertions (same seam as
 * tests/unit/posthog-cookieless.test.ts and
 * tests/unit/transcript-analysis-engine.test.ts) rather than live-db tests,
 * since this codebase has no db-query-mocking harness — the query builder
 * itself is exercised at the route-handler/integration level elsewhere.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')

const KIND_FILTER = /eq\(\s*analysisRun\.kind\s*,\s*['"]application_scoring['"]\s*\)/

describe('(a) scoring-stats reader — ee/server/api/ai-analysis/stats.get.ts', () => {
  const content = read('ee/server/api/ai-analysis/stats.get.ts')

  // Split the Promise.all array on each numbered query comment so every
  // one of the 7 queries is checked individually — a transcript-kind run
  // row must not appear in any of totalRuns / completedRuns / failedRuns /
  // tokenUsage / dailyRuns / recentRuns / modelBreakdown.
  const queryLabels = [
    'Total runs',
    'Completed runs',
    'Failed runs',
    'Total token usage',
    'Daily runs',
    'Recent runs',
    'Per-model breakdown',
  ]

  const segments = content.split(/\/\/ \d+\.\s+/).slice(1)

  it('has exactly 7 numbered queries in the Promise.all', () => {
    expect(segments.length).toBe(7)
  })

  queryLabels.forEach((label, i) => {
    it(`query ${i + 1} (${label}) filters to kind = 'application_scoring'`, () => {
      const segment = segments[i]
      expect(segment).toBeDefined()
      expect(segment).toMatch(KIND_FILTER)
    })
  })

  it('filters on kind at least 7 times total (one per query, not clustered in one)', () => {
    const matches = content.match(new RegExp(KIND_FILTER, 'g')) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(7)
  })
})

describe('(b) scores endpoint latest-run selection — server/api/applications/[id]/scores.get.ts', () => {
  const content = read('server/api/applications/[id]/scores.get.ts')

  it('filters the latest analysis run to kind = application_scoring', () => {
    // Isolate the "Fetch latest analysis run" query block so we know the
    // filter is attached to the right query, not just present anywhere
    // in the file.
    const marker = content.indexOf('Fetch latest analysis run')
    expect(marker).toBeGreaterThan(-1)
    const block = content.slice(marker, content.indexOf('return {', marker))
    expect(block).toMatch(KIND_FILTER)
  })

  it('would otherwise let a newer transcript_analysis row shadow the latest scoring run (documents the bug this closes)', () => {
    // Simulated ORDER BY createdAt DESC LIMIT 1 semantics: without the kind
    // predicate, a newer transcript run would be selected as "latestRun"
    // even though it has no compositeScore/provider semantics matching a
    // scoring run.
    const rows = [
      { id: 'scoring-1', kind: 'application_scoring', createdAt: 1 },
      { id: 'transcript-1', kind: 'transcript_analysis', createdAt: 2 },
    ]
    const unfiltered = [...rows].sort((a, b) => b.createdAt - a.createdAt)[0]
    expect(unfiltered.kind).toBe('transcript_analysis') // the bug, if unfiltered

    const filtered = [...rows]
      .filter(r => r.kind === 'application_scoring')
      .sort((a, b) => b.createdAt - a.createdAt)[0]
    expect(filtered.kind).toBe('application_scoring') // what scores.get.ts must produce
  })
})

describe('(c) budget gate counts BOTH kinds — server/utils/ai/budget.ts', () => {
  const content = read('server/utils/ai/budget.ts')

  it('countPlatformRuns has no kind filter (counts transcript_analysis rows too)', () => {
    const marker = content.indexOf('async function countPlatformRuns')
    expect(marker).toBeGreaterThan(-1)
    const nextFn = content.indexOf('async function sumPlatformSpendMicros')
    const block = content.slice(marker, nextFn)
    expect(block).not.toMatch(/analysisRun\.kind/)
  })

  it('sumPlatformSpendMicros has no kind filter (spend from transcript_analysis rows counts toward budget)', () => {
    const marker = content.indexOf('async function sumPlatformSpendMicros')
    expect(marker).toBeGreaterThan(-1)
    const nextFn = content.indexOf('function startOfUtcMonth')
    const block = content.slice(marker, nextFn)
    expect(block).not.toMatch(/analysisRun\.kind/)
  })

  it('demonstrates the budget-bypass blocker is closed: an unfiltered lifetime count includes a transcript_analysis row', () => {
    const rows = [
      { kind: 'application_scoring', billingMode: 'platform', status: 'completed' },
      { kind: 'transcript_analysis', billingMode: 'platform', status: 'completed' },
    ]
    // countPlatformRuns' actual where-clause only filters on billingMode +
    // organizationId + status — never kind — so both rows above are counted.
    const countedByGate = rows.filter(r => r.billingMode === 'platform' && r.status === 'completed')
    expect(countedByGate.length).toBe(2)
    expect(countedByGate.some(r => r.kind === 'transcript_analysis')).toBe(true)
  })
})

describe('(c) billing usage meter mirrors the budget gate — server/utils/billing/usage.ts', () => {
  const content = read('server/utils/billing/usage.ts')

  it('countPlatformRuns has no kind filter, staying in lockstep with budget.ts', () => {
    const marker = content.indexOf('async function countPlatformRuns')
    expect(marker).toBeGreaterThan(-1)
    const nextFn = content.indexOf('export async function getOrgUsage')
    const block = content.slice(marker, nextFn)
    expect(block).not.toMatch(/analysisRun\.kind/)
  })
})

describe('(c) DSAR export includes both kinds — server/api/candidates/[id]/export.get.ts', () => {
  const content = read('server/api/candidates/[id]/export.get.ts')

  it('does not filter analysisRuns relation by kind', () => {
    expect(content).toMatch(/analysisRuns:\s*true/)
    expect(content).not.toMatch(/analysisRun\.kind/)
  })
})
