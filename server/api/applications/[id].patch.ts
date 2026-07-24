import { eq, and, inArray, isNull } from 'drizzle-orm'
import { application, candidate, pipelineStage } from '../../database/schema'
import { applicationIdParamSchema, updateApplicationSchema } from '../../utils/schemas/application'
import type { StageCategory } from '~~/shared/pipeline'

/**
 * PATCH /api/applications/:id
 * Move an application to a pipeline stage, and/or update notes and score.
 *
 * Stage moves are free-form across the job's custom pipeline — there is no fixed
 * transition graph. The target stage must belong to the application's own job.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { application: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id } = await getValidatedRouterParams(event, applicationIdParamSchema.parse)
  const body = await readValidatedBody(event, updateApplicationSchema.parse)
  const activeCandidateIds = db.select({ id: candidate.id }).from(candidate).where(and(
    eq(candidate.organizationId, orgId),
    isNull(candidate.quarantinedAt),
  ))

  // Fetch current application (with its current stage) to attribute the change.
  const current = await db.query.application.findFirst({
    where: and(
      eq(application.id, id),
      eq(application.organizationId, orgId),
      inArray(application.candidateId, activeCandidateIds),
    ),
    columns: { id: true, statusId: true, jobId: true },
    with: { stage: { columns: { id: true, name: true, category: true } } },
  })

  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  // Resolve + validate the target stage when a move is requested.
  const isMove = !!body.statusId && body.statusId !== current.statusId
  let targetStage: { id: string, name: string, category: StageCategory } | undefined
  if (body.statusId) {
    const stage = await db.query.pipelineStage.findFirst({
      where: and(
        eq(pipelineStage.id, body.statusId),
        eq(pipelineStage.organizationId, orgId),
      ),
      columns: { id: true, name: true, category: true, jobId: true },
    })
    if (!stage || stage.jobId !== current.jobId) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Target stage does not belong to this application\'s job',
      })
    }
    targetStage = stage
  }

  const [updated] = await db.update(application)
    .set({
      ...(targetStage ? { statusId: targetStage.id, statusCategory: targetStage.category } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.score !== undefined ? { score: body.score } : {}),
      // A manual move clears any automation-rule attribution.
      ...(isMove ? { autoRule: null } : {}),
      updatedAt: new Date(),
    })
    .where(and(
      eq(application.id, id),
      eq(application.organizationId, orgId),
      inArray(application.candidateId, activeCandidateIds),
    ))
    .returning({
      id: application.id,
      candidateId: application.candidateId,
      jobId: application.jobId,
      statusId: application.statusId,
      statusCategory: application.statusCategory,
      score: application.score,
      notes: application.notes,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    })

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  recordActivity({
    organizationId: orgId,
    actorId: session.user.id,
    action: isMove ? 'status_changed' : 'updated',
    resourceType: 'application',
    resourceId: id,
    metadata: isMove
      ? { from: current.stage.name, to: targetStage!.name, fromStageId: current.statusId, toStageId: targetStage!.id }
      : undefined,
  })

  // Track to PostHog for per-user debugging and funnel analytics
  if (isMove) {
    trackEvent(event, session, 'application status_changed', {
      application_id: id,
      job_id: updated.jobId,
      from_status: current.stage.name,
      to_status: targetStage!.name,
    })

    logApiRequest(event, session, 'application.status_changed', {
      application_id: id,
      job_id: updated.jobId,
      from_status: current.stage.name,
      to_status: targetStage!.name,
    })
  }

  return updated
})
