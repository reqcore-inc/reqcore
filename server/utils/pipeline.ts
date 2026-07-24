import { and, asc, eq } from 'drizzle-orm'
import { pipelineStage } from '../database/schema'
import type { StageCategory } from '~~/shared/pipeline'

export interface EntryStage {
  id: string
  category: StageCategory
}

/**
 * Resolve the stage a fresh application lands in for a job: the one flagged
 * `isEntry`. Falls back to the lowest `displayOrder` stage if — through some
 * inconsistency — no stage is flagged, so an application can always be created.
 * Returns null only when the job has no stages at all (should never happen; every
 * job is seeded with the default pipeline on creation).
 */
export async function getEntryStage(jobId: string, organizationId: string): Promise<EntryStage | null> {
  const stages = await db
    .select({ id: pipelineStage.id, category: pipelineStage.category, isEntry: pipelineStage.isEntry })
    .from(pipelineStage)
    .where(and(
      eq(pipelineStage.jobId, jobId),
      eq(pipelineStage.organizationId, organizationId),
    ))
    .orderBy(asc(pipelineStage.displayOrder))

  if (stages.length === 0) return null
  const entry = stages.find(s => s.isEntry) ?? stages[0]!
  return { id: entry.id, category: entry.category }
}
