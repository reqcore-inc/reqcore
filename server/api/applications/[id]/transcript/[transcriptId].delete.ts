import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { document, screeningTranscript } from '../../../../database/schema'

const paramsSchema = z.object({ id: z.string().min(1), transcriptId: z.string().min(1) })

/**
 * DELETE /api/applications/:id/transcript/:transcriptId
 *
 * Delete a screening transcript from an application. If the transcript is
 * `sourceType: 'upload'`, the linked `document` row and its S3 object are
 * also deleted (reusing the same pattern as `server/api/documents/[id].delete.ts`
 * — S3 deletion is best-effort and logged, never blocking DB cleanup).
 * `transcript_analysis` rows are removed by the DB's `onDelete: 'cascade'`
 * FK (see `server/database/schema/app.ts`), not deleted explicitly here.
 *
 * Security:
 *   - Auth + `document:['delete']` permission required.
 *   - Transcript loaded org-scoped AND application-scoped
 *     (`and(eq(id), eq(organizationId), eq(applicationId))`), so a
 *     cross-org id or an id belonging to a different application 404s
 *     rather than leaking existence.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { document: ['delete'] })
  const orgId = session.session.activeOrganizationId
  const { id: applicationId, transcriptId } = await getValidatedRouterParams(event, paramsSchema.parse)

  // Query scoped by id AND organizationId AND applicationId — prevents IDOR
  // and cross-application access to a transcript on another application.
  const transcript = await db.query.screeningTranscript.findFirst({
    where: and(
      eq(screeningTranscript.id, transcriptId),
      eq(screeningTranscript.organizationId, orgId),
      eq(screeningTranscript.applicationId, applicationId),
    ),
    columns: {
      id: true,
      applicationId: true,
      sourceType: true,
      documentId: true,
    },
    with: {
      document: { columns: { id: true, storageKey: true } },
    },
  })

  if (!transcript) {
    throw createError({ statusCode: 404, statusMessage: 'Transcript not found' })
  }

  // Upload-sourced transcripts have a linked document — delete the S3
  // object and the document row. Paste-sourced transcripts have no
  // document/S3 to clean up.
  if (transcript.sourceType === 'upload' && transcript.document) {
    try {
      await deleteFromS3(transcript.document.storageKey)
    } catch (s3Error) {
      logWarn('transcript.s3_delete_failed', {
        storage_key: transcript.document.storageKey,
        error_message: s3Error instanceof Error ? s3Error.message : String(s3Error),
      })
      // Continue with DB deletion — orphaned S3 objects can be cleaned up later.
    }

    await db.delete(document)
      .where(and(
        eq(document.id, transcript.document.id),
        eq(document.organizationId, orgId),
      ))
  }

  // Delete the transcript row — cascades to transcript_analysis rows.
  await db.delete(screeningTranscript)
    .where(and(
      eq(screeningTranscript.id, transcript.id),
      eq(screeningTranscript.organizationId, orgId),
    ))

  recordActivity({
    organizationId: orgId,
    actorId: session.user.id,
    action: 'deleted',
    resourceType: 'document',
    resourceId: transcript.id,
    metadata: { applicationId, sourceType: transcript.sourceType },
  })

  setResponseStatus(event, 204)
  return null
})
