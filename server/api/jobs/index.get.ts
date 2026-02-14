import { eq, and, desc } from 'drizzle-orm'
import { job } from '../../database/schema'
import { jobQuerySchema } from '../../utils/schemas/job'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId!

  const query = await getValidatedQuery(event, jobQuerySchema.parse)

  const offset = (query.page - 1) * query.limit
  const conditions = [eq(job.organizationId, orgId)]
  if (query.status) conditions.push(eq(job.status, query.status))

  const [data, total] = await Promise.all([
    db.query.job.findMany({
      where: and(...conditions),
      limit: query.limit,
      offset,
      orderBy: [desc(job.createdAt)],
    }),
    db.$count(job, and(...conditions)),
  ])

  return { data, total, page: query.page, limit: query.limit }
})
