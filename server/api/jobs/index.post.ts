import { job } from '../../database/schema'
import { createJobSchema } from '../../utils/schemas/job'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId!

  const body = await readValidatedBody(event, createJobSchema.parse)

  const [created] = await db.insert(job).values({
    organizationId: orgId,
    title: body.title,
    description: body.description,
    location: body.location,
    type: body.type,
  }).returning()

  setResponseStatus(event, 201)
  return created
})
