import { eq, and, ne } from 'drizzle-orm'
import { application, job, pipelineStage } from '../../../../database/schema'
import { stageIdParamSchema, updateStageSchema } from '../../../../utils/schemas/pipeline'

/**
 * PATCH /api/jobs/:id/stages/:stageId
 * Rename / recolour / recategorise a stage, or make it the entry stage.
 *
 * Two invariants are maintained here:
 *  - exactly one stage per job carries `isEntry`
 *  - `application.statusCategory` (denormalised) matches its stage's category,
 *    so a category change rewrites every application currently in this stage.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { job: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id: jobId, stageId } = await getValidatedRouterParams(event, stageIdParamSchema.parse)
  const body = await readValidatedBody(event, updateStageSchema.parse)

  const existingJob = await db.query.job.findFirst({
    where: and(eq(job.id, jobId), eq(job.organizationId, orgId)),
    columns: { id: true },
  })
  if (!existingJob) {
    throw createError({ statusCode: 404, statusMessage: 'Job not found' })
  }

  const stage = await db.query.pipelineStage.findFirst({
    where: and(
      eq(pipelineStage.id, stageId),
      eq(pipelineStage.jobId, jobId),
      eq(pipelineStage.organizationId, orgId),
    ),
    columns: { id: true, name: true, category: true, isEntry: true },
  })
  if (!stage) {
    throw createError({ statusCode: 404, statusMessage: 'Stage not found' })
  }

  const updated = await db.transaction(async (tx) => {
    // Moving the entry flag: clear it everywhere else on this job first.
    if (body.isEntry) {
      await tx.update(pipelineStage)
        .set({ isEntry: false, updatedAt: new Date() })
        .where(and(
          eq(pipelineStage.jobId, jobId),
          eq(pipelineStage.organizationId, orgId),
          ne(pipelineStage.id, stageId),
        ))
    }

    const [row] = await tx.update(pipelineStage)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.isEntry ? { isEntry: true } : {}),
        updatedAt: new Date(),
      })
      .where(and(
        eq(pipelineStage.id, stageId),
        eq(pipelineStage.organizationId, orgId),
      ))
      .returning({
        id: pipelineStage.id,
        jobId: pipelineStage.jobId,
        name: pipelineStage.name,
        color: pipelineStage.color,
        category: pipelineStage.category,
        displayOrder: pipelineStage.displayOrder,
        isEntry: pipelineStage.isEntry,
      })

    // Keep the denormalised category on applications in this stage in sync.
    if (body.category !== undefined && body.category !== stage.category) {
      await tx.update(application)
        .set({ statusCategory: body.category, updatedAt: new Date() })
        .where(and(
          eq(application.statusId, stageId),
          eq(application.organizationId, orgId),
        ))
    }

    return row
  })

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Stage not found' })
  }

  recordActivity({
    organizationId: orgId,
    actorId: session.user.id,
    action: 'updated',
    resourceType: 'job',
    resourceId: jobId,
    metadata: { pipelineStageUpdated: updated.name },
  })

  return updated
})
