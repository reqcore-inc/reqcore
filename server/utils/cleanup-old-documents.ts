import { env } from './env'
import { and, eq, lt } from 'drizzle-orm'
import { document } from '../database/schema'
import { deleteFromS3 } from './s3'
import { db } from './db'
import { logInfo, logError } from './logger'

/**
 * Deletes documents whose expiration date has passed from MinIO and the database.
 * Executed automatically via Nitro scheduled task.
 *
 * GDPR: Resumes and cover letters are personal data with configurable retention.
 * Default retention: 2 years from creation (can be extended by administrators).
 * Documents are deleted when their expirationDate is in the past.
 * Can be disabled by setting GDPR_CLEANUP_ENABLED=false in environment variables.
 */
export async function cleanupOldDocuments(): Promise<{ deletedCount: number; errors: Array<{ storageKey: string; error: string }> }> {
  // Skip cleanup if feature is disabled via environment variable
  if (!env.GDPR_CLEANUP_ENABLED) {
    logInfo('cleanup_old_documents.skipped', {
      reason: 'GDPR_CLEANUP_ENABLED is not set to "true"',
    })
    return { deletedCount: 0, errors: [] }
  }

  const NOW = new Date()
  const errors: Array<{ storageKey: string; error: string }> = []
  let deletedCount = 0

  // Find all documents with expired expiration date (system-wide task - all organizations)
  const expiredDocuments = await db.query.document.findMany({
    where: lt(document.expirationDate, NOW),
    columns: {
      id: true,
      storageKey: true,
      organizationId: true,
      candidateId: true,
      expirationDate: true,
    },
  })

  logInfo('cleanup_old_documents.start', {
    expired_documents_count: expiredDocuments.length,
    current_date: NOW.toISOString(),
  })

  // Delete each expired document
  for (const doc of expiredDocuments) {
    try {
      // Delete from MinIO/S3 first
      await deleteFromS3(doc.storageKey)

      // Delete from database
      await db.delete(document)
        .where(and(
          eq(document.id, doc.id),
          eq(document.organizationId, doc.organizationId),
        ))

      logInfo('cleanup_old_documents.deleted', {
        document_id: doc.id,
        storage_key: doc.storageKey,
        organization_id: doc.organizationId,
        expired_at: doc.expirationDate?.toISOString(),
      })
      deletedCount++
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      errors.push({ storageKey: doc.storageKey, error: errorMessage })
      logError('cleanup_old_documents.failed', {
        document_id: doc.id,
        storage_key: doc.storageKey,
        error_message: errorMessage,
      })
    }
  }

  logInfo('cleanup_old_documents.complete', {
    deleted_count: deletedCount,
    errors_count: errors.length,
  })

  return { deletedCount, errors }
}
