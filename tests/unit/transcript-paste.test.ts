import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * POST /api/applications/:id/transcript (paste path).
 *
 * Nitro auto-imports (defineEventHandler, requirePermission,
 * getValidatedRouterParams, readValidatedBody, db, createError,
 * setResponseStatus) are stubbed the same way the rest of the suite does it
 * (see tests/unit/candidate-retention.test.ts, billing-plan-resolution.test.ts):
 * `vi.stubGlobal` + a minimal in-memory fake that answers by which table/args
 * were passed in.
 */

const { findActiveCandidate } = vi.hoisted(() => ({
  findActiveCandidate: vi.fn(),
}))
vi.mock('../../server/utils/candidate-retention', () => ({ findActiveCandidate }))

async function loadHandler() {
  const mod = await import('../../server/api/applications/[id]/transcript/index.post')
  return mod.default
}

interface Scenario {
  application?: { id: string, candidateId: string } | undefined
  activeCandidate?: { id: string } | undefined
  insertedReturn?: { id: string, createdAt: Date, sourceType: string }[]
}

function stubEnvironment(scenario: Scenario) {
  const applicationFindFirst = vi.fn(async () => scenario.application)
  const returning = vi.fn(async () => scenario.insertedReturn ?? [])
  const values = vi.fn(() => ({ returning }))
  const insert = vi.fn(() => ({ values }))

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
  // Mirror h3's validateData: a thrown validator error (e.g. ZodError) is
  // converted into a 400 H3Error, same as real getValidatedRouterParams /
  // readValidatedBody behavior.
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
  vi.stubGlobal('recordActivity', vi.fn())
  vi.stubGlobal('db', {
    query: {
      application: { findFirst: applicationFindFirst },
    },
    insert,
  })

  findActiveCandidate.mockReset()
  findActiveCandidate.mockImplementation(async () => scenario.activeCandidate)

  return { applicationFindFirst, insert, values, returning }
}

function makeEvent(id: string, body: unknown) {
  return { context: { params: { id } }, __body: body }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('POST /api/applications/:id/transcript (paste)', () => {
  beforeEach(() => {
    vi.stubGlobal('logInfo', vi.fn())
  })

  it('rejects an over-cap paste (200_001 chars) with 400', async () => {
    stubEnvironment({
      application: { id: 'app-1', candidateId: 'cand-1' },
      activeCandidate: { id: 'cand-1' },
    })
    const handler = await loadHandler()
    const overCap = 'a'.repeat(200_001)

    await expect(handler(makeEvent('app-1', { text: overCap }) as any))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects an empty string paste with 400', async () => {
    stubEnvironment({
      application: { id: 'app-1', candidateId: 'cand-1' },
      activeCandidate: { id: 'cand-1' },
    })
    const handler = await loadHandler()

    await expect(handler(makeEvent('app-1', { text: '' }) as any))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('404s for a cross-org application (not found by the scoped query)', async () => {
    stubEnvironment({
      application: undefined,
      activeCandidate: { id: 'cand-1' },
    })
    const handler = await loadHandler()

    await expect(handler(makeEvent('app-in-other-org', { text: 'hello there' }) as any))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejects a quarantined candidate', async () => {
    stubEnvironment({
      application: { id: 'app-1', candidateId: 'cand-quarantined' },
      activeCandidate: undefined,
    })
    const handler = await loadHandler()

    await expect(handler(makeEvent('app-1', { text: 'hello there' }) as any))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('persists rawText with sourceType paste on the happy path', async () => {
    const createdAt = new Date('2026-07-14T00:00:00Z')
    const { insert, values } = stubEnvironment({
      application: { id: 'app-1', candidateId: 'cand-1' },
      activeCandidate: { id: 'cand-1' },
      insertedReturn: [{ id: 'transcript-1', createdAt, sourceType: 'paste' }],
    })
    const handler = await loadHandler()

    const result = await handler(makeEvent('app-1', { text: 'Q: Tell me about yourself. A: ...' }) as any)

    expect(result).toEqual({ id: 'transcript-1', createdAt, sourceType: 'paste' })
    expect(insert).toHaveBeenCalledTimes(1)
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      applicationId: 'app-1',
      sourceType: 'paste',
      documentId: null,
      rawText: 'Q: Tell me about yourself. A: ...',
      truncated: false,
      createdById: 'user-1',
    }))
  })
})
