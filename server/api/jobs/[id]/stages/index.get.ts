import { eq, and, asc } from 'drizzle-orm'
import { job, pipelineStage } from '../../../../database/schema'
import { stageJobIdParamSchema } from '../../../../utils/schemas/pipeline'

/**
 * GET /api/jobs/:id/stages
 * The job's custom pipeline stages, in display order.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { job: ['read'] })
  const orgId = session.session.activeOrganizationId

  const { id: jobId } = await getValidatedRouterParams(event, stageJobIdParamSchema.parse)

  const existingJob = await db.query.job.findFirst({
    where: and(eq(job.id, jobId), eq(job.organizationId, orgId)),
    columns: { id: true },
  })
  if (!existingJob) {
    throw createError({ statusCode: 404, statusMessage: 'Job not found' })
  }

  const stages = await db
    .select({
      id: pipelineStage.id,
      jobId: pipelineStage.jobId,
      name: pipelineStage.name,
      color: pipelineStage.color,
      category: pipelineStage.category,
      displayOrder: pipelineStage.displayOrder,
      isEntry: pipelineStage.isEntry,
    })
    .from(pipelineStage)
    .where(and(
      eq(pipelineStage.jobId, jobId),
      eq(pipelineStage.organizationId, orgId),
    ))
    .orderBy(asc(pipelineStage.displayOrder))

  return { stages }
})
