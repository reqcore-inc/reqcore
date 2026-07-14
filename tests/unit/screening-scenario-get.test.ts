/// <reference path="../../.nuxt/types/nitro-imports.d.ts" />
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineEventHandler, getValidatedRouterParams, createError } from 'h3'

// This test imports the API route handler module directly (outside the Nitro
// runtime), so the h3 helpers Nitro normally auto-imports as globals must be
// stubbed with the real h3 implementations *before* the module is imported.
// `vi.stubGlobal` isn't hoisted the way `vi.mock` is, so we stub first and
// then dynamically import the handler in `beforeAll`.
vi.stubGlobal('defineEventHandler', defineEventHandler)
vi.stubGlobal('getValidatedRouterParams', getValidatedRouterParams)
vi.stubGlobal('createError', createError)

let screeningScenarioGetHandler: (event: any) => Promise<any>

beforeAll(async () => {
  const mod = await import('../../server/api/applications/[id]/screening-scenario.get')
  screeningScenarioGetHandler = mod.default
})

afterEach(() => {
  vi.unstubAllGlobals()
  // `vi.unstubAllGlobals()` clears every global stub, including the h3
  // helpers this file owns AND tests/setup.ts's logger stubs (logInfo/
  // logWarn/logError/logDebug), which run once before this whole file and
  // would otherwise stay wiped for the rest of the file's tests. Re-stub
  // both sets so later tests in this file (and anything they exercise
  // transitively) still see working globals.
  vi.stubGlobal('defineEventHandler', defineEventHandler)
  vi.stubGlobal('getValidatedRouterParams', getValidatedRouterParams)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('logInfo', vi.fn())
  vi.stubGlobal('logWarn', vi.fn())
  vi.stubGlobal('logError', vi.fn())
  vi.stubGlobal('logDebug', vi.fn())
})

function stubGlobals(opts: {
  app: { id: string } | null
  rows?: any[]
  orgId?: string
}) {
  const orgId = opts.orgId ?? 'org-1'
  const findFirst = vi.fn(async (_query?: { where?: unknown }) => opts.app)
  // Track the args passed into `where(...)` so we can assert the org
  // predicate actually reached the query, not just that the mock returns
  // canned data (universal rule: assert on call arguments, not just stubs).
  const whereArgs: unknown[] = []
  const select = vi.fn((_cols: any) => ({
    from: () => ({
      where: (arg: unknown) => {
        whereArgs.push(arg)
        return {
          orderBy: () => ({
            limit: async () => opts.rows ?? [],
          }),
        }
      },
    }),
  }))

  vi.stubGlobal('requirePermission', vi.fn(async () => ({
    session: { activeOrganizationId: orgId },
    user: { id: 'user-1' },
  })))
  vi.stubGlobal('db', {
    query: { application: { findFirst } },
    select,
  })

  return { findFirst, select, whereArgs, orgId }
}

function makeEvent(applicationId: string) {
  return { context: { params: { id: applicationId } }, headers: new Headers() } as any
}

/**
 * Drizzle's `and(eq(...), eq(...))` builders return a `SQL` AST with circular
 * `table` <-> `column` references, so `JSON.stringify` throws. Walk the AST's
 * `queryChunks` to pull out the literal bound values (`Param` nodes) instead —
 * this lets tests assert the org predicate's *value* actually reached the
 * query, not just that a mock was configured to return canned data.
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

describe('GET /api/applications/:id/screening-scenario', () => {
  it('returns 404 when the application belongs to a different organization (IDOR guard)', async () => {
    const { findFirst } = stubGlobals({ app: null, orgId: 'org-victim' })

    await expect(screeningScenarioGetHandler(makeEvent('app-1'))).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Application not found',
    })

    // Assert the org predicate actually reached the application lookup query,
    // not just that the mock was configured to return null.
    const callArg = findFirst.mock.calls[0]?.[0]
    const boundValues = extractBoundParamValues(callArg?.where)
    expect(boundValues).toContain('org-victim')
  })

  it('returns 404 when the application does not exist at all', async () => {
    stubGlobals({ app: null })

    await expect(screeningScenarioGetHandler(makeEvent('missing-app'))).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('returns { latest: null, history: [] } when no scenarios exist', async () => {
    stubGlobals({ app: { id: 'app-1' }, rows: [] })

    const result = await screeningScenarioGetHandler(makeEvent('app-1'))

    expect(result).toEqual({ latest: null, history: [] })
  })

  it('asserts the org predicate reaches the screening_scenario query', async () => {
    const { whereArgs, orgId } = stubGlobals({ app: { id: 'app-1' }, rows: [], orgId: 'org-42' })

    await screeningScenarioGetHandler(makeEvent('app-1'))

    expect(whereArgs).toHaveLength(1)
    expect(extractBoundParamValues(whereArgs[0])).toContain(orgId)
  })

  it('returns the newest row as latest, with history ordered newest-first', async () => {
    const rows = [
      { id: 'scn-2', createdAt: new Date('2026-07-10T00:00:00Z'), status: 'completed', errorMessage: null },
      { id: 'scn-1', createdAt: new Date('2026-07-01T00:00:00Z'), status: 'completed', errorMessage: null },
    ]
    stubGlobals({ app: { id: 'app-1' }, rows })

    const result = await screeningScenarioGetHandler(makeEvent('app-1'))

    expect(result.latest).toEqual(rows[0])
    expect(result.history).toEqual(rows)
    expect(result.history[0].id).toBe('scn-2')
    expect(result.history[1].id).toBe('scn-1')
  })

  it('never forwards raw provider/LLM error text — collapses errorMessage to a fixed indicator', async () => {
    const rows = [
      { id: 'scn-1', createdAt: new Date('2026-07-10T00:00:00Z'), status: 'failed', errorMessage: 'upstream 500: leaked provider stack trace with API key sk-xxx' },
    ]
    stubGlobals({ app: { id: 'app-1' }, rows })

    const result = await screeningScenarioGetHandler(makeEvent('app-1'))

    expect(result.history[0].errorMessage).toBe('generation_failed')
    expect(result.history[0].errorMessage).not.toContain('sk-xxx')
    expect(result.latest.errorMessage).toBe('generation_failed')
  })

  it('never exposes costUsdMicros or generatedById to scoring:read callers', async () => {
    const rows = [
      { id: 'scn-1', createdAt: new Date(), status: 'completed', errorMessage: null },
    ]
    stubGlobals({ app: { id: 'app-1' }, rows })

    const result = await screeningScenarioGetHandler(makeEvent('app-1'))

    expect(result.history[0]).not.toHaveProperty('costUsdMicros')
    expect(result.history[0]).not.toHaveProperty('generatedById')
  })
})
