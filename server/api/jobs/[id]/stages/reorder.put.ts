import { eq, and } from 'drizzle-orm'
import { job, pipelineStage } from '../../../../database/schema'
import { stageJobIdParamSchema, reorderStagesSchema } from '../../../../utils/schemas/pipeline'

/**
 * PUT /api/jobs/:id/stages/reorder
 * Persist a new stage order (drag-and-drop in the pipeline editor).
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { job: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id: jobId } = await getValidatedRouterParams(event, stageJobIdParamSchema.parse)
  const body = await readValidatedBody(event, reorderStagesSchema.parse)

  const existingJob = await db.query.job.findFirst({
    where: and(eq(job.id, jobId), eq(job.organizationId, orgId)),
    columns: { id: true },
  })
  if (!existingJob) {
    throw createError({ statusCode: 404, statusMessage: 'Job not found' })
  }

  // Scoped to this job + org, so unknown ids simply match no rows.
  await db.transaction(async (tx) => {
    for (const { id, displayOrder } of body.order) {
      await tx.update(pipelineStage)
        .set({ displayOrder, updatedAt: new Date() })
        .where(and(
          eq(pipelineStage.id, id),
          eq(pipelineStage.jobId, jobId),
          eq(pipelineStage.organizationId, orgId),
        ))
    }
  })

  return { success: true }
})
