import { eq, and, desc, sql, count, inArray, isNull } from 'drizzle-orm'
import { application, candidate, job, pipelineStage } from '../../database/schema'

/**
 * GET /api/dashboard/stats
 * Returns aggregated dashboard data for the current organization:
 * - Summary counts (open jobs, candidates, applications, unreviewed)
 * - Pipeline breakdown (application count per status)
 * - Jobs breakdown (job count per status)
 * - Recent applications (last 10 with candidate + job info)
 * - Top active jobs (open jobs sorted by application count, top 5)
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { job: ['read'], candidate: ['read'], application: ['read'] })
  const orgId = session.session.activeOrganizationId
  const activeCandidateIds = db.select({ id: candidate.id }).from(candidate).where(and(
    eq(candidate.organizationId, orgId),
    isNull(candidate.quarantinedAt),
  ))
  const activeApplicationCondition = and(
    eq(application.organizationId, orgId),
    inArray(application.candidateId, activeCandidateIds),
  )

  // ─────────────────────────────────────────────
  // Run all queries in parallel for performance
  // ─────────────────────────────────────────────
  const [
    openJobsCount,
    totalCandidatesCount,
    totalApplicationsCount,
    newApplicationsCount,
    pipelineRows,
    jobStatusRows,
    recentApplications,
    topJobs,
  ] = await Promise.all([
    // 1. Open jobs count
    db.$count(job, and(eq(job.organizationId, orgId), eq(job.status, 'open'))),

    // 2. Total candidates
    db.$count(candidate, and(eq(candidate.organizationId, orgId), isNull(candidate.quarantinedAt))),

    // 3. Total applications
    db.$count(application, activeApplicationCondition),

    // 4. New (unreviewed) applications — those still in an `applied`-category stage
    db.$count(application, and(activeApplicationCondition, eq(application.statusCategory, 'applied'))),

    // 5. Pipeline breakdown — application count per category (cross-job, so
    //    aggregated by the stage role rather than per custom stage)
    db
      .select({
        category: application.statusCategory,
        count: count().as('count'),
      })
      .from(application)
      .where(activeApplicationCondition)
      .groupBy(application.statusCategory),

    // 6. Jobs by status
    db
      .select({
        status: job.status,
        count: count().as('count'),
      })
      .from(job)
      .where(eq(job.organizationId, orgId))
      .groupBy(job.status),

    // 7. Recent applications (last 10) with candidate + job details
    db
      .select({
        id: application.id,
        statusName: pipelineStage.name,
        statusColor: pipelineStage.color,
        statusCategory: application.statusCategory,
        createdAt: application.createdAt,
        candidateId: application.candidateId,
        candidateFirstName: candidate.firstName,
        candidateLastName: candidate.lastName,
        candidateEmail: candidate.email,
        jobId: application.jobId,
        jobTitle: job.title,
      })
      .from(application)
      .innerJoin(candidate, eq(candidate.id, application.candidateId))
      .innerJoin(job, eq(job.id, application.jobId))
      .innerJoin(pipelineStage, eq(pipelineStage.id, application.statusId))
      .where(and(eq(application.organizationId, orgId), isNull(candidate.quarantinedAt)))
      .orderBy(desc(application.createdAt))
      .limit(10),

    // 8. Top 5 active (open) jobs by total application count + per-status breakdown
    db
      .select({
        id: job.id,
        title: job.title,
        slug: job.slug,
        status: job.status,
        createdAt: job.createdAt,
        applicationCount: count(application.id).as('application_count'),
        appliedCount: sql<number>`count(case when ${application.statusCategory} = 'applied' then 1 end)`.as('applied_count'),
        inProgressCount: sql<number>`count(case when ${application.statusCategory} = 'in_progress' then 1 end)`.as('in_progress_count'),
        hiredCount: sql<number>`count(case when ${application.statusCategory} = 'hired' then 1 end)`.as('hired_count'),
        rejectedCount: sql<number>`count(case when ${application.statusCategory} = 'rejected' then 1 end)`.as('rejected_count'),
      })
      .from(job)
      .leftJoin(application, and(
        eq(application.jobId, job.id),
        inArray(application.candidateId, activeCandidateIds),
      ))
      .where(and(eq(job.organizationId, orgId), eq(job.status, 'open')))
      .groupBy(job.id)
      .orderBy(sql`count(${application.id}) desc`)
      .limit(5),
  ])

  // ─────────────────────────────────────────────
  // Transform grouped rows into keyed objects
  // ─────────────────────────────────────────────
  const pipeline: Record<string, number> = {
    applied: 0,
    in_progress: 0,
    hired: 0,
    rejected: 0,
  }
  for (const row of pipelineRows) {
    pipeline[row.category] = row.count
  }

  const jobsByStatus: Record<string, number> = {
    draft: 0,
    open: 0,
    closed: 0,
    archived: 0,
  }
  for (const row of jobStatusRows) {
    jobsByStatus[row.status] = row.count
  }

  return {
    counts: {
      openJobs: openJobsCount,
      totalCandidates: totalCandidatesCount,
      totalApplications: totalApplicationsCount,
      newApplications: newApplicationsCount,
    },
    pipeline,
    jobsByStatus,
    recentApplications,
    topJobs,
  }
})
