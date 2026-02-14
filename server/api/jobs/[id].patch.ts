import { eq, and } from 'drizzle-orm'
import { job } from '../../database/schema'
import { idParamSchema, updateJobSchema, JOB_STATUS_TRANSITIONS } from '../../utils/schemas/job'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId!

  const { id } = await getValidatedRouterParams(event, idParamSchema.parse)
  const body = await readValidatedBody(event, updateJobSchema.parse)

  // Validate status transition if status is being changed
  if (body.status) {
    const existing = await db.query.job.findFirst({
      where: and(eq(job.id, id), eq(job.organizationId, orgId)),
      columns: { status: true },
    })

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Not found' })
    }

    const allowed = JOB_STATUS_TRANSITIONS[existing.status] ?? []
    if (!allowed.includes(body.status)) {
      throw createError({
        statusCode: 422,
        statusMessage: `Cannot transition from '${existing.status}' to '${body.status}'`,
      })
    }
  }

  const [updated] = await db.update(job)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(and(eq(job.id, id), eq(job.organizationId, orgId)))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  return updated
})
