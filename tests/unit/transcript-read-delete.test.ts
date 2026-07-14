import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * GET /api/applications/:id/transcript (list transcripts + analyses)
 * DELETE /api/applications/:id/transcript/:transcriptId
 *
 * Nitro auto-imports are stubbed the same way as tests/unit/transcript-paste.test.ts:
 * `vi.stubGlobal` + a minimal in-memory fake that answers by which table/args
 * were passed in.
 */

const { deleteFromS3 } = vi.hoisted(() => ({
  deleteFromS3: vi.fn(async () => undefined),
}))

async function loadGetHandler() {
  const mod = await import('../../server/api/applications/[id]/transcript/index.get')
  return mod.default
}

async function loadDeleteHandler() {
  const mod = await import('../../server/api/applications/[id]/transcript/[transcriptId].delete')
  return mod.default
}

function makeEvent(params: Record<string, string>) {
  return { context: { params } }
}

function createError(opts: Record<string, unknown>) {
  const err = new Error(String(opts.statusMessage ?? 'error'))
  Object.assign(err, opts)
  return err
}

function stubCommon() {
  vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
  vi.stubGlobal('getValidatedRouterParams', async (event: any, validator: any) => {
    try {
      return await validator(event.context.params)
    } catch (err) {
      throw createError({ statusCode: 400, statusMessage: 'Validation Error', data: err })
    }
  })
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('setResponseStatus', vi.fn())
  vi.stubGlobal('recordActivity', vi.fn())
  vi.stubGlobal('logWarn', vi.fn())
  vi.stubGlobal('logInfo', vi.fn())
  vi.stubGlobal('deleteFromS3', deleteFromS3)
}

afterEach(() => {
  vi.unstubAllGlobals()
  deleteFromS3.mockReset()
})

describe('GET /api/applications/:id/transcript', () => {
  beforeEach(() => {
    stubCommon()
    vi.stubGlobal('requirePermission', vi.fn(async () => ({
      user: { id: 'user-1' },
      session: { activeOrganizationId: 'org-1' },
    })))
  })

  it('404s for a cross-org application', async () => {
    const applicationFindFirst = vi.fn(async () => undefined)
    const transcriptFindMany = vi.fn(async () => [])
    vi.stubGlobal('db', {
      query: {
        application: { findFirst: applicationFindFirst },
        screeningTranscript: { findMany: transcriptFindMany },
      },
    })

    const handler = await loadGetHandler()

    await expect(handler(makeEvent({ id: 'app-in-other-org' }) as any))
      .rejects.toMatchObject({ statusCode: 404 })
    expect(transcriptFindMany).not.toHaveBeenCalled()
  })

  it('returns transcripts with nested analyses and no rawText field in list items', async () => {
    const applicationFindFirst = vi.fn(async () => ({ id: 'app-1' }))
    const createdAt = new Date('2026-07-14T00:00:00Z')
    const transcriptFindMany = vi.fn(async () => [
      {
        id: 'transcript-1',
        sourceType: 'upload',
        truncated: false,
        createdAt,
        documentId: 'doc-1',
        rawText: null,
        document: { originalFilename: 'call.pdf' },
        analyses: [
          {
            id: 'analysis-1',
            extractionMode: 'per_answer',
            recommendation: 'advance',
            confidence: 80,
            rationale: 'Strong answers',
            sectionScores: [{ topic: 'communication', score: 8 }],
            answerBreakdown: [{ question: 'Q1', answer: 'A1', evidence: 'quote', score: 8, confidence: 80 }],
            status: 'completed',
            createdAt,
          },
        ],
      },
      {
        id: 'transcript-2',
        sourceType: 'paste',
        truncated: false,
        createdAt,
        documentId: null,
        rawText: 'Q: ... A: ...',
        document: null,
        analyses: [],
      },
    ])
    vi.stubGlobal('db', {
      query: {
        application: { findFirst: applicationFindFirst },
        screeningTranscript: { findMany: transcriptFindMany },
      },
    })

    const handler = await loadGetHandler()
    const result = await handler(makeEvent({ id: 'app-1' }) as any)

    expect(applicationFindFirst).toHaveBeenCalled()
    expect(result).toHaveLength(2)
    for (const item of result as Record<string, unknown>[]) {
      expect(item).not.toHaveProperty('rawText')
    }
    expect(result[0]).toMatchObject({
      id: 'transcript-1',
      sourceType: 'upload',
      truncated: false,
      documentId: 'doc-1',
      originalFilename: 'call.pdf',
    })
    expect(result[0].analyses).toEqual([
      expect.objectContaining({
        id: 'analysis-1',
        extractionMode: 'per_answer',
        recommendation: 'advance',
        confidence: 80,
        rationale: 'Strong answers',
        status: 'completed',
      }),
    ])
    expect(result[1]).toMatchObject({
      id: 'transcript-2',
      sourceType: 'paste',
      originalFilename: null,
    })
  })
})

describe('DELETE /api/applications/:id/transcript/:transcriptId', () => {
  beforeEach(() => {
    stubCommon()
    vi.stubGlobal('requirePermission', vi.fn(async () => ({
      user: { id: 'user-1' },
      session: { activeOrganizationId: 'org-1' },
    })))
  })

  function stubDb({ transcript, deleteWhereCapture }: {
    transcript?: Record<string, unknown> | undefined
    deleteWhereCapture?: (args: unknown) => void
  }) {
    const transcriptFindFirst = vi.fn(async () => transcript)
    const deleteWhere = vi.fn(async (args: unknown) => {
      deleteWhereCapture?.(args)
      return undefined
    })
    const deleteFn = vi.fn(() => ({ where: deleteWhere }))
    vi.stubGlobal('db', {
      query: {
        screeningTranscript: { findFirst: transcriptFindFirst },
      },
      delete: deleteFn,
    })
    return { transcriptFindFirst, deleteFn, deleteWhere }
  }

  it('404s for a cross-org/wrong-application transcriptId', async () => {
    stubDb({ transcript: undefined })
    const handler = await loadDeleteHandler()

    await expect(handler(makeEvent({ id: 'app-1', transcriptId: 'transcript-in-other-org' }) as any))
      .rejects.toMatchObject({ statusCode: 404 })
    expect(deleteFromS3).not.toHaveBeenCalled()
  })

  it('deletes an upload-sourced transcript: calls S3 delete and removes the document row', async () => {
    const { deleteFn } = stubDb({
      transcript: {
        id: 'transcript-1',
        applicationId: 'app-1',
        sourceType: 'upload',
        documentId: 'doc-1',
        document: { id: 'doc-1', storageKey: 'org-1/cand-1/doc-1.pdf' },
      },
    })
    const handler = await loadDeleteHandler()

    await handler(makeEvent({ id: 'app-1', transcriptId: 'transcript-1' }) as any)

    expect(deleteFromS3).toHaveBeenCalledWith('org-1/cand-1/doc-1.pdf')
    // one delete() call for the document row, one for the transcript row
    expect(deleteFn).toHaveBeenCalledTimes(2)
  })

  it('deletes a paste-sourced transcript without touching S3', async () => {
    const { deleteFn } = stubDb({
      transcript: {
        id: 'transcript-2',
        applicationId: 'app-1',
        sourceType: 'paste',
        documentId: null,
        document: null,
      },
    })
    const handler = await loadDeleteHandler()

    await handler(makeEvent({ id: 'app-1', transcriptId: 'transcript-2' }) as any)

    expect(deleteFromS3).not.toHaveBeenCalled()
    // only one delete() call for the transcript row
    expect(deleteFn).toHaveBeenCalledTimes(1)
  })

  it('404s when transcriptId belongs to a different application (application-scoped)', async () => {
    // findFirst is queried with an AND that includes applicationId; simulate the
    // scoped query returning undefined because the transcript belongs elsewhere.
    stubDb({ transcript: undefined })
    const handler = await loadDeleteHandler()

    await expect(handler(makeEvent({ id: 'app-1', transcriptId: 'transcript-in-other-application' }) as any))
      .rejects.toMatchObject({ statusCode: 404 })
  })
})
