import { eq, and, count } from 'drizzle-orm'
import { application, applicationRule, job, pipelineStage } from '../../../../database/schema'
import { stageIdParamSchema } from '../../../../utils/schemas/pipeline'

/**
 * DELETE /api/jobs/:id/stages/:stageId
 *
 * Refused when the stage would break the pipeline:
 *  - it still holds applications (move them first — the FK is `restrict`)
 *  - it is the entry stage (designate another entry first)
 *  - it is the job's last remaining stage
 *
 * Automation rules targeting the stage are deleted with it (FK cascade); the
 * count is reported back so the UI can warn before confirming.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { job: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id: jobId, stageId } = await getValidatedRouterParams(event, stageIdParamSchema.parse)

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
    columns: { id: true, name: true, isEntry: true },
  })
  if (!stage) {
    throw createError({ statusCode: 404, statusMessage: 'Stage not found' })
  }

  if (stage.isEntry) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Cannot delete the entry stage. Make another stage the entry point first.',
    })
  }

  const [totalStages, [appCount]] = await Promise.all([
    db.$count(pipelineStage, and(
      eq(pipelineStage.jobId, jobId),
      eq(pipelineStage.organizationId, orgId),
    )),
    db.select({ count: count() })
      .from(application)
      .where(and(
        eq(application.statusId, stageId),
        eq(application.organizationId, orgId),
      )),
  ])

  if (totalStages <= 1) {
    throw createError({ statusCode: 422, statusMessage: 'A job must keep at least one stage' })
  }

  const applicationsInStage = Number(appCount?.count ?? 0)
  if (applicationsInStage > 0) {
    throw createError({
      statusCode: 422,
      statusMessage: `${applicationsInStage} application${applicationsInStage === 1 ? '' : 's'} still in "${stage.name}". Move them to another stage first.`,
    })
  }

  const removedRules = await db.$count(applicationRule, and(
    eq(applicationRule.targetStageId, stageId),
    eq(applicationRule.organizationId, orgId),
  ))

  await db.delete(pipelineStage)
    .where(and(
      eq(pipelineStage.id, stageId),
      eq(pipelineStage.organizationId, orgId),
    ))

  recordActivity({
    organizationId: orgId,
    actorId: session.user.id,
    action: 'updated',
    resourceType: 'job',
    resourceId: jobId,
    metadata: { pipelineStageDeleted: stage.name, removedRules },
  })

  return { success: true, removedRules }
})
