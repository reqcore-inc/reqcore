import { eq, and, desc, count, inArray, isNull } from 'drizzle-orm'
import { job, application, candidate } from '../../database/schema'
import { jobQuerySchema } from '../../utils/schemas/job'

// Cross-job list mini-bar aggregates by stage category (each job has its own
// custom stages, so the compact bar shows the funnel by role).
interface PipelineCounts {
  applied: number
  in_progress: number
  hired: number
  rejected: number
}

const emptyPipeline = (): PipelineCounts => ({ applied: 0, in_progress: 0, hired: 0, rejected: 0 })

export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { job: ['read'] })
  const orgId = session.session.activeOrganizationId

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
      columns: {
        id: true,
        title: true,
        slug: true,
        description: true,
        location: true,
        type: true,
        status: true,
        experienceLevel: true,
        remoteStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.$count(job, and(...conditions)),
  ])

  // Fetch pipeline counts (application status breakdown) for returned jobs
  const jobIds = data.map((j) => j.id)
  let pipelineMap: Record<string, PipelineCounts> = {}

  if (jobIds.length > 0) {
    const activeCandidateIds = db.select({ id: candidate.id }).from(candidate).where(and(
      eq(candidate.organizationId, orgId),
      isNull(candidate.quarantinedAt),
    ))
    const pipelineRows = await db
      .select({
        jobId: application.jobId,
        category: application.statusCategory,
        count: count().as('count'),
      })
      .from(application)
      .where(and(
        eq(application.organizationId, orgId),
        inArray(application.jobId, jobIds),
        inArray(application.candidateId, activeCandidateIds),
      ))
      .groupBy(application.jobId, application.statusCategory)

    for (const row of pipelineRows) {
      const entry = (pipelineMap[row.jobId] ??= emptyPipeline())
      entry[row.category as keyof PipelineCounts] = row.count
    }
  }

  const enrichedData = data.map((j) => ({
    ...j,
    pipeline: pipelineMap[j.id] ?? emptyPipeline(),
  }))

  return { data: enrichedData, total, page: query.page, limit: query.limit }
})
