/// <reference path="../../.nuxt/types/nitro-imports.d.ts" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Coverage for the platform-billed AI budget gate metering ALL platform
 * generation surfaces (analysisRun AND screeningScenario), not just
 * analysisRun. See server/utils/ai/budget.ts.
 *
 * `assertPlatformBudget` is the only exported entry point that exercises the
 * private `countPlatformRuns` / `sumPlatformSpendMicros` helpers, so these
 * tests drive the gate through it and assert on the *query call arguments*
 * reaching both tables (universal rule: assert on call args, not just stub
 * return values).
 */

vi.mock('../../server/utils/billing/plan', () => ({
  resolveOrgPlanId: vi.fn(),
}))

import { resolveOrgPlanId } from '../../server/utils/billing/plan'
import { analysisRun, screeningScenario, job } from '../../server/database/schema'
import { assertPlatformBudget, BudgetExceededError } from '../../server/utils/ai/budget'
import { getOrgUsage } from '../../server/utils/billing/usage'

const mockResolveOrgPlanId = vi.mocked(resolveOrgPlanId)

type TableName = 'analysisRun' | 'screeningScenario' | 'job' | 'unknown'

/**
 * Walk a drizzle `and(eq(...), ...)` AST and pull out the table each `eq`/
 * `gte` predicate targets, keyed by identity against the tables we care
 * about. Lets us assert a query's `.from(table)` actually paired with a
 * `.where(...)` predicate scoped to that same table.
 */
function tableOfSelect(fromArg: unknown): TableName {
  if (fromArg === analysisRun) return 'analysisRun'
  if (fromArg === screeningScenario) return 'screeningScenario'
  if (fromArg === job) return 'job'
  return 'unknown'
}

/**
 * Stub the auto-imported `db` global with a row-injecting `select` mock.
 * `rowsByTable` supplies the aggregate row (`{ total: string }`) returned for
 * each table's query — callers control what count/sum comes back per table
 * so tests can assert both tables were actually queried (not just one).
 */
function stubDb(rowsByTable: {
  analysisRun?: { total: string }
  screeningScenario?: { total: string }
  job?: { total: string }
}) {
  const whereCallsByTable: Record<TableName, unknown[]> = {
    analysisRun: [],
    screeningScenario: [],
    job: [],
    unknown: [],
  }
  const fromCalls: string[] = []

  const rowFor = (table: TableName) => {
    if (table === 'analysisRun') return rowsByTable.analysisRun
    if (table === 'screeningScenario') return rowsByTable.screeningScenario
    if (table === 'job') return rowsByTable.job
    return undefined
  }

  const select = vi.fn((_cols: any) => ({
    from: (fromArg: unknown) => {
      const table = tableOfSelect(fromArg)
      fromCalls.push(table)
      return {
        where: (pred: unknown) => {
          whereCallsByTable[table]!.push(pred)
          const row = rowFor(table)
          return Promise.resolve(row ? [row] : [])
        },
      }
    },
  }))

  vi.stubGlobal('db', { select })

  return { select, fromCalls, whereCallsByTable }
}

/**
 * Walk drizzle's SQL AST (`queryChunks`) to pull out literal bound values
 * (`Param` nodes), mirroring the technique used in
 * tests/unit/screening-scenario-get.test.ts — needed because Drizzle's
 * `and(eq(...), ...)` builders have circular table<->column refs that break
 * JSON.stringify.
 */
function extractBoundParamValues(node: any, depth = 0): unknown[] {
  if (!node || depth > 20) return []
  const values: unknown[] = []
  if (node?.constructor?.name === 'Param') {
    values.push(node.value)
  }
  if (Array.isArray(node?.queryChunks)) {
    for (const chunk of node.queryChunks) {
      values.push(...extractBoundParamValues(chunk, depth + 1))
    }
  }
  return values
}

beforeEach(() => {
  process.env.AI_FREE_PLAN_RUN_LIMIT = '5'
  mockResolveOrgPlanId.mockReset()
})

afterEach(() => {
  // budget.ts never logs, so unlike screening-scenario-get.test.ts's
  // stubGlobals, there's no logInfo/logWarn/logError/logDebug global to
  // re-stub here.
  vi.unstubAllGlobals()
  delete process.env.AI_FREE_PLAN_RUN_LIMIT
  delete process.env.AI_DAILY_SPEND_CAP_USD
})

describe('countPlatformRuns metering (free-tier lifetime gate)', () => {
  it('blocks the next run once analysisRun + screeningScenario completed platform rows reach the cap (3 + 2 = 5)', async () => {
    mockResolveOrgPlanId.mockResolvedValue('free')
    const { fromCalls, whereCallsByTable } = stubDb({
      analysisRun: { total: '3' },
      screeningScenario: { total: '2' },
    })

    await expect(assertPlatformBudget('org-1')).rejects.toThrow(BudgetExceededError)

    // Both tables must actually have been queried — not just one.
    expect(fromCalls).toContain('analysisRun')
    expect(fromCalls).toContain('screeningScenario')
    // The org predicate must have reached both count queries.
    for (const table of ['analysisRun', 'screeningScenario'] as const) {
      const preds = whereCallsByTable[table]!
      expect(preds.length).toBeGreaterThan(0)
      expect(extractBoundParamValues(preds[0])).toContain('org-1')
    }
  })

  it('allows the run when the combined completed-platform count is under the cap', async () => {
    mockResolveOrgPlanId.mockResolvedValue('free')
    stubDb({
      analysisRun: { total: '2' },
      screeningScenario: { total: '1' },
    })

    await expect(assertPlatformBudget('org-2')).resolves.toBeUndefined()
  })

  it('does not count byok or non-completed screeningScenario rows toward the cap', async () => {
    mockResolveOrgPlanId.mockResolvedValue('free')
    // The SQL WHERE clause (billingMode='platform' AND status='completed')
    // is what excludes byok/failed rows at the DB layer — the mock's "row"
    // simulates that filtered aggregate already applied. 4 analysis + 0
    // scenario (because the 2 scenario rows in the fixture are byok/failed
    // and therefore excluded by the predicate) stays under the cap of 5.
    const { whereCallsByTable } = stubDb({
      analysisRun: { total: '4' },
      screeningScenario: { total: '0' },
    })

    await expect(assertPlatformBudget('org-3')).resolves.toBeUndefined()

    // Assert the filter itself — not just the stubbed totals — actually
    // scopes to platform+completed for both tables. Without this, dropping
    // the billingMode/status predicates from the real query would still
    // pass this test as long as the stub returned pre-filtered numbers.
    for (const table of ['analysisRun', 'screeningScenario'] as const) {
      const preds = whereCallsByTable[table]!
      expect(preds.length).toBeGreaterThan(0)
      const values = extractBoundParamValues(preds[0])
      expect(values).toContain('platform')
      expect(values).toContain('completed')
    }
  })
})

describe('sumPlatformSpendMicros metering (monthly + global caps)', () => {
  it('includes screeningScenario.costUsdMicros in the org-scoped monthly sum', async () => {
    mockResolveOrgPlanId.mockResolvedValue('solo') // $20/mo cap
    const { whereCallsByTable } = stubDb({
      // analysisRun: $15, screeningScenario: $6 -> combined $21 >= $20 cap
      analysisRun: { total: '15000000' },
      screeningScenario: { total: '6000000' },
    })

    await expect(assertPlatformBudget('org-4')).rejects.toThrow(BudgetExceededError)

    for (const table of ['analysisRun', 'screeningScenario'] as const) {
      const preds = whereCallsByTable[table]!
      expect(preds.length).toBeGreaterThan(0)
      expect(extractBoundParamValues(preds[0])).toContain('org-4')
    }
  })

  it('stays under the monthly cap when the combined analysisRun + screeningScenario spend is below it', async () => {
    mockResolveOrgPlanId.mockResolvedValue('solo') // $20/mo cap
    stubDb({
      analysisRun: { total: '10000000' }, // $10
      screeningScenario: { total: '5000000' }, // $5 -> combined $15 < $20
    })

    await expect(assertPlatformBudget('org-5')).resolves.toBeUndefined()
  })

  it('includes screeningScenario spend in the global daily kill-switch sum (org-agnostic query)', async () => {
    mockResolveOrgPlanId.mockResolvedValue('solo')
    process.env.AI_DAILY_SPEND_CAP_USD = '10'
    const { whereCallsByTable } = stubDb({
      analysisRun: { total: '6000000' }, // $6
      screeningScenario: { total: '5000000' }, // $5 -> combined $11 >= $10 daily cap
    })

    await expect(assertPlatformBudget('org-6')).rejects.toThrow(BudgetExceededError)

    // Each table is queried twice (org-scoped monthly + org-agnostic daily).
    // The global (org-agnostic) daily query must not scope by org — assert
    // at least one of the two predicates per table omits the org id.
    for (const table of ['analysisRun', 'screeningScenario'] as const) {
      const preds = whereCallsByTable[table]!
      expect(preds.length).toBe(2)
      const hasOrgAgnosticPredicate = preds.some(
        pred => !extractBoundParamValues(pred).includes('org-6'),
      )
      expect(hasOrgAgnosticPredicate).toBe(true)
    }
  })

  it('respects the `since` date filter (bound value present in the where predicate for both tables)', async () => {
    mockResolveOrgPlanId.mockResolvedValue('solo')
    const { whereCallsByTable } = stubDb({
      analysisRun: { total: '0' },
      screeningScenario: { total: '0' },
    })

    await assertPlatformBudget('org-7')

    for (const table of ['analysisRun', 'screeningScenario'] as const) {
      const preds = whereCallsByTable[table]!
      expect(preds.length).toBeGreaterThan(0)
      const values = extractBoundParamValues(preds[0])
      expect(values.some(v => v instanceof Date)).toBe(true)
    }
  })
})

describe('getOrgUsage aiAnalysis meter (billing UI) stays in sync with the enforcement gate', () => {
  it('sums analysisRun + screeningScenario completed platform rows into aiAnalysis.used (matching the free-tier gate count)', async () => {
    mockResolveOrgPlanId.mockResolvedValue('free')
    const { fromCalls, whereCallsByTable } = stubDb({
      analysisRun: { total: '3' },
      screeningScenario: { total: '2' },
      job: { total: '1' },
    })

    const usage = await getOrgUsage('org-usage-1')

    // The UI meter must reflect the SAME combined count the enforcement gate
    // uses (3 + 2 = 5) — this is the exact desync bug the reviewer flagged:
    // usage.ts previously had its own countPlatformRuns that only summed
    // analysisRun (would have reported 3, not 5).
    expect(usage.aiAnalysis.used).toBe(5)
    expect(usage.tier).toBe('free')

    expect(fromCalls).toContain('analysisRun')
    expect(fromCalls).toContain('screeningScenario')
    for (const table of ['analysisRun', 'screeningScenario'] as const) {
      const preds = whereCallsByTable[table]!
      expect(preds.length).toBeGreaterThan(0)
      expect(extractBoundParamValues(preds[0])).toContain('org-usage-1')
    }
  })

  it('reuses the shared countPlatformRuns from budget.ts rather than a local duplicate', async () => {
    // Import both modules' exports and assert usage.ts's getOrgUsage is
    // wired to the exact same function budget.ts's enforcement gate uses —
    // guards against usage.ts re-introducing its own private copy.
    const budgetModule = await import('../../server/utils/ai/budget')
    const usageModuleSource = await import('node:fs/promises').then(fs =>
      fs.readFile(new URL('../../server/utils/billing/usage.ts', import.meta.url), 'utf-8'),
    )
    expect(typeof budgetModule.countPlatformRuns).toBe('function')
    expect(usageModuleSource).toContain("import { countPlatformRuns, freeRunLimit } from '../ai/budget'")
    expect(usageModuleSource).not.toMatch(/async function countPlatformRuns/)
  })
})
