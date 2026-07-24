import { eq, and } from 'drizzle-orm'
import { job, pipelineStage } from '../../../../database/schema'
import { stageJobIdParamSchema, createStageSchema } from '../../../../utils/schemas/pipeline'

/** Hard cap so a pipeline stays navigable (and the UI bounded). */
const MAX_STAGES_PER_JOB = 30

/**
 * POST /api/jobs/:id/stages
 * Append a new stage to the end of the job's pipeline.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { job: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id: jobId } = await getValidatedRouterParams(event, stageJobIdParamSchema.parse)
  const body = await readValidatedBody(event, createStageSchema.parse)

  const existingJob = await db.query.job.findFirst({
    where: and(eq(job.id, jobId), eq(job.organizationId, orgId)),
    columns: { id: true },
  })
  if (!existingJob) {
    throw createError({ statusCode: 404, statusMessage: 'Job not found' })
  }

  const existing = await db
    .select({ id: pipelineStage.id, displayOrder: pipelineStage.displayOrder })
    .from(pipelineStage)
    .where(and(
      eq(pipelineStage.jobId, jobId),
      eq(pipelineStage.organizationId, orgId),
    ))

  if (existing.length >= MAX_STAGES_PER_JOB) {
    throw createError({
      statusCode: 422,
      statusMessage: `A job can have at most ${MAX_STAGES_PER_JOB} stages`,
    })
  }

  const nextOrder = existing.reduce((max, s) => Math.max(max, s.displayOrder), -1) + 1

  const [created] = await db.insert(pipelineStage).values({
    organizationId: orgId,
    jobId,
    name: body.name,
    color: body.color,
    category: body.category,
    displayOrder: nextOrder,
    // The first stage of an empty pipeline must be the entry point.
    isEntry: existing.length === 0,
  }).returning({
    id: pipelineStage.id,
    jobId: pipelineStage.jobId,
    name: pipelineStage.name,
    color: pipelineStage.color,
    category: pipelineStage.category,
    displayOrder: pipelineStage.displayOrder,
    isEntry: pipelineStage.isEntry,
  })

  recordActivity({
    organizationId: orgId,
    actorId: session.user.id,
    action: 'updated',
    resourceType: 'job',
    resourceId: jobId,
    metadata: { pipelineStageAdded: body.name },
  })

  setResponseStatus(event, 201)
  return created
})
