import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { fileTypeFromBuffer } = vi.hoisted(() => ({
  fileTypeFromBuffer: vi.fn(),
}))
vi.mock('file-type', () => ({ fileTypeFromBuffer }))

const { parseDocument } = vi.hoisted(() => ({
  parseDocument: vi.fn(async () => ({ text: 'transcript text', sections: [], metadata: {} })),
}))
vi.mock('../../server/utils/resume-parser', () => ({ parseDocument }))

const { findActiveCandidate } = vi.hoisted(() => ({
  findActiveCandidate: vi.fn(async () => ({ id: 'candidate-1' })),
}))
vi.mock('../../server/utils/candidate-retention', () => ({ findActiveCandidate }))

const PDF_MAGIC = Buffer.from('%PDF-1.4\n')

function makeEvent() {
  return {} as any
}

// Static `import` is hoisted above any `vi.stubGlobal` call, but
// `defineEventHandler` must exist as a global before Nitro's default export
// is evaluated — so the handler module is loaded dynamically after the stub.
let handler: (event: unknown) => Promise<unknown>

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
  const mod = await import('../../server/api/applications/[id]/transcript/upload.post')
  handler = mod.default as (event: unknown) => Promise<unknown>
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('POST /api/applications/:id/transcript/upload', () => {
  let requirePermission: ReturnType<typeof vi.fn>
  let getValidatedRouterParams: ReturnType<typeof vi.fn>
  let readMultipartFormData: ReturnType<typeof vi.fn>
  let setResponseStatus: ReturnType<typeof vi.fn>
  let uploadToS3: ReturnType<typeof vi.fn>
  let deleteFromS3: ReturnType<typeof vi.fn>
  let recordActivity: ReturnType<typeof vi.fn>
  let dbFindFirst: ReturnType<typeof vi.fn>
  let dbCount: ReturnType<typeof vi.fn>
  let dbTransaction: ReturnType<typeof vi.fn>
  let insertDocumentReturning: ReturnType<typeof vi.fn>
  let insertTranscriptReturning: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
    vi.stubGlobal('createError', (opts: { statusCode: number, statusMessage: string }) =>
      Object.assign(new Error(opts.statusMessage), { statusCode: opts.statusCode, statusMessage: opts.statusMessage }))
    vi.stubGlobal('logWarn', vi.fn())
    vi.stubGlobal('logInfo', vi.fn())
    vi.stubGlobal('logError', vi.fn())

    requirePermission = vi.fn(async () => ({
      session: { activeOrganizationId: 'org-1' },
      user: { id: 'user-1' },
    }))
    vi.stubGlobal('requirePermission', requirePermission)

    getValidatedRouterParams = vi.fn(async () => ({ id: 'application-1' }))
    vi.stubGlobal('getValidatedRouterParams', getValidatedRouterParams)

    readMultipartFormData = vi.fn(async () => ([
      { name: 'file', filename: 'transcript.pdf', data: PDF_MAGIC },
    ]))
    vi.stubGlobal('readMultipartFormData', readMultipartFormData)

    setResponseStatus = vi.fn()
    vi.stubGlobal('setResponseStatus', setResponseStatus)

    uploadToS3 = vi.fn(async () => undefined)
    vi.stubGlobal('uploadToS3', uploadToS3)

    deleteFromS3 = vi.fn(async () => undefined)
    vi.stubGlobal('deleteFromS3', deleteFromS3)

    recordActivity = vi.fn(async () => undefined)
    vi.stubGlobal('recordActivity', recordActivity)

    dbFindFirst = vi.fn(async () => ({ id: 'application-1', candidateId: 'candidate-1' }))
    dbCount = vi.fn(async () => 0)

    insertDocumentReturning = vi.fn(async () => ([{
      id: 'document-1',
      type: 'transcript',
      originalFilename: 'transcript.pdf',
      mimeType: 'application/pdf',
      sizeBytes: PDF_MAGIC.length,
      createdAt: new Date('2026-07-14T00:00:00Z'),
    }]))
    insertTranscriptReturning = vi.fn(async () => ([{
      id: 'transcript-1',
      applicationId: 'application-1',
      documentId: 'document-1',
      sourceType: 'upload',
      createdAt: new Date('2026-07-14T00:00:00Z'),
    }]))

    const makeInsertChain = (returningFn: ReturnType<typeof vi.fn>) => ({
      values: vi.fn(() => ({ returning: returningFn })),
    })

    dbTransaction = vi.fn(async (cb: (tx: unknown) => unknown) => {
      let documentInsertCalled = false
      const tx = {
        insert: vi.fn(() => {
          if (!documentInsertCalled) {
            documentInsertCalled = true
            return makeInsertChain(insertDocumentReturning)
          }
          return makeInsertChain(insertTranscriptReturning)
        }),
      }
      return cb(tx)
    })

    vi.stubGlobal('db', {
      query: { application: { findFirst: dbFindFirst } },
      $count: dbCount,
      transaction: dbTransaction,
    })

    fileTypeFromBuffer.mockResolvedValue({ mime: 'application/pdf', ext: 'pdf' })
  })

  it('rejects an invalid MIME type', async () => {
    fileTypeFromBuffer.mockResolvedValue(undefined)
    readMultipartFormData.mockResolvedValue([
      { name: 'file', filename: 'transcript.exe', data: Buffer.from('not a real document') },
    ])

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
    expect(uploadToS3).not.toHaveBeenCalled()
  })

  it('rejects an oversized file', async () => {
    const bigBuffer = Buffer.alloc(10 * 1024 * 1024 + 1)
    readMultipartFormData.mockResolvedValue([
      { name: 'file', filename: 'transcript.pdf', data: bigBuffer },
    ])

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 413 })
    expect(fileTypeFromBuffer).not.toHaveBeenCalled()
  })

  it('rejects a quarantined candidate', async () => {
    findActiveCandidate.mockResolvedValueOnce(undefined)

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 409 })
    expect(uploadToS3).not.toHaveBeenCalled()
  })

  it('returns 404 for a cross-org application', async () => {
    dbFindFirst.mockResolvedValueOnce(undefined)

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 404 })
    expect(findActiveCandidate).not.toHaveBeenCalled()
  })

  it('creates a document (type=transcript) and a screening_transcript row linked to both the application and document on the happy path', async () => {
    const result = await handler(makeEvent()) as any

    expect(dbFindFirst).toHaveBeenCalledTimes(1)
    expect(findActiveCandidate).toHaveBeenCalledWith('org-1', 'candidate-1')
    expect(uploadToS3).toHaveBeenCalledTimes(1)
    expect(insertDocumentReturning).toHaveBeenCalledTimes(1)
    expect(insertTranscriptReturning).toHaveBeenCalledTimes(1)
    expect(setResponseStatus).toHaveBeenCalledWith(expect.anything(), 201)

    expect(result.document).toMatchObject({ id: 'document-1', type: 'transcript' })
    expect(result.transcript).toMatchObject({
      id: 'transcript-1',
      applicationId: 'application-1',
      documentId: 'document-1',
      sourceType: 'upload',
    })
  })
})
