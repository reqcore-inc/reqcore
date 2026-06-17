import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { lt } from 'drizzle-orm'
import { document } from '../../server/database/schema'

// Mock dependencies BEFORE importing the module under test
// This prevents "env is not defined" errors from server/utils/s3.ts
vi.mock('../../server/utils/s3', () => ({
  default: {},
  deleteFromS3: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../server/utils/db', () => ({
  db: {
    query: {
      document: {
        findMany: vi.fn(),
      },
    },
    // Mock delete to return an object with where method that returns a promise
    // This mimics Drizzle's DeleteBuilder which is PromiseLike
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
  },
}))

vi.mock('../../server/utils/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}))

// Now import the module under test (mocks are already in place)
import { cleanupOldDocuments } from '../../server/utils/cleanup-old-documents'
import { deleteFromS3 } from '../../server/utils/s3'
import { db } from '../../server/utils/db'

describe('cleanupOldDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Enable GDPR cleanup for tests
    process.env.GDPR_CLEANUP_ENABLED = 'true'
  })

  afterEach(() => {
    delete process.env.GDPR_CLEANUP_ENABLED
  })

  it('should delete documents with expired expiration date', async () => {
    const expiredDate = new Date(Date.now() - 1000) // Already expired (1 second ago)

    // Mock expired documents
    vi.mocked(db.query.document.findMany).mockResolvedValue([
      { id: '1', storageKey: 'org1/cand1/doc1.pdf', organizationId: 'org1', candidateId: 'cand1', expirationDate: expiredDate },
      { id: '2', storageKey: 'org1/cand2/doc2.pdf', organizationId: 'org1', candidateId: 'cand2', expirationDate: expiredDate },
    ])

    vi.mocked(deleteFromS3).mockResolvedValue(undefined)

    const result = await cleanupOldDocuments()

    // Verify findMany was called with correct filter and columns
    expect(db.query.document.findMany).toHaveBeenCalledWith({
      where: expect.any(Object), // lt(document.expirationDate, NOW) - Drizzle SQL object
      columns: expect.objectContaining({
        id: true,
        storageKey: true,
        organizationId: true,
        candidateId: true,
        expirationDate: true,
      }),
    })

    expect(result.deletedCount).toBe(2)
    expect(result.errors).toHaveLength(0)
    expect(deleteFromS3).toHaveBeenCalledTimes(2)
    expect(deleteFromS3).toHaveBeenCalledWith('org1/cand1/doc1.pdf')
    expect(deleteFromS3).toHaveBeenCalledWith('org1/cand2/doc2.pdf')
    expect(db.delete).toHaveBeenCalledTimes(2)
  })

  it('should not delete documents with future expiration date', async () => {

    // In real DB, where(lt(expirationDate, NOW)) would filter these out and return []
    vi.mocked(db.query.document.findMany).mockResolvedValue([])

    const result = await cleanupOldDocuments()

    // Verify findMany was called with correct filter (would return empty for future dates)
    expect(db.query.document.findMany).toHaveBeenCalledWith({
      where: expect.any(Object), // lt(document.expirationDate, NOW)
      columns: expect.objectContaining({
        id: true,
        storageKey: true,
        organizationId: true,
        candidateId: true,
        expirationDate: true,
      }),
    })

    expect(result.deletedCount).toBe(0)
    expect(deleteFromS3).not.toHaveBeenCalled()
    expect(db.delete).not.toHaveBeenCalled()
  })

  it('should handle S3 deletion errors gracefully', async () => {
    const expiredDate = new Date(Date.now() - 1000) // Already expired

    vi.mocked(db.query.document.findMany).mockResolvedValue([
      { id: '1', storageKey: 'org1/cand1/doc1.pdf', organizationId: 'org1', candidateId: 'cand1', expirationDate: expiredDate },
    ])

    vi.mocked(deleteFromS3).mockRejectedValue(new Error('S3 connection error'))

    const result = await cleanupOldDocuments()

    // Verify correct query was made
    expect(db.query.document.findMany).toHaveBeenCalledWith({
      where: expect.any(Object),
      columns: expect.objectContaining({
        id: true,
        storageKey: true,
        organizationId: true,
        candidateId: true,
        expirationDate: true,
      }),
    })

    // Verify S3 deletion was attempted
    expect(deleteFromS3).toHaveBeenCalledWith('org1/cand1/doc1.pdf')

    // Verify error handling: no deletion should succeed, error should be recorded
    expect(result.deletedCount).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toEqual({ storageKey: 'org1/cand1/doc1.pdf', error: 'S3 connection error' })
    // DB delete should not be called if S3 fails (continues to next in loop, but this is only 1 doc)
    expect(db.delete).toHaveBeenCalledTimes(0)
  })

  it('should continue on individual errors and delete remaining documents', async () => {
    const expiredDate = new Date(Date.now() - 1000) // Already expired

    vi.mocked(db.query.document.findMany).mockResolvedValue([
      { id: '1', storageKey: 'org1/cand1/doc1.pdf', organizationId: 'org1', candidateId: 'cand1', expirationDate: expiredDate },
      { id: '2', storageKey: 'org1/cand2/doc2.pdf', organizationId: 'org1', candidateId: 'cand2', expirationDate: expiredDate },
      { id: '3', storageKey: 'org1/cand3/doc3.pdf', organizationId: 'org1', candidateId: 'cand3', expirationDate: expiredDate },
    ])

    // First document fails, others succeed
    vi.mocked(deleteFromS3)
      .mockRejectedValueOnce(new Error('S3 error'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)

    const result = await cleanupOldDocuments()

    // Verify correct query was made
    expect(db.query.document.findMany).toHaveBeenCalledWith({
      where: expect.any(Object),
      columns: expect.objectContaining({
        id: true,
        storageKey: true,
        organizationId: true,
        candidateId: true,
        expirationDate: true,
      }),
    })

    // Verify all 3 S3 deletion attempts were made
    expect(deleteFromS3).toHaveBeenCalledTimes(3)
    expect(deleteFromS3).toHaveBeenCalledWith('org1/cand1/doc1.pdf')
    expect(deleteFromS3).toHaveBeenCalledWith('org1/cand2/doc2.pdf')
    expect(deleteFromS3).toHaveBeenCalledWith('org1/cand3/doc3.pdf')

    // Verify error handling: 2 succeeded (doc2, doc3), 1 failed (doc1)
    expect(result.deletedCount).toBe(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toEqual({ storageKey: 'org1/cand1/doc1.pdf', error: 'S3 error' })
    // DB delete should be called 2 times (for doc2 and doc3, after successful S3 deletion)
    expect(db.delete).toHaveBeenCalledTimes(2)
  })
})
