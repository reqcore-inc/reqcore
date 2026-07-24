import { z } from 'zod'

// ─────────────────────────────────────────────
// Application validation schemas — shared across API routes
// ─────────────────────────────────────────────

/** Schema for creating a new application (recruiter links candidate → job) */
export const createApplicationSchema = z.object({
  candidateId: z.string().min(1, 'Candidate is required'),
  jobId: z.string().min(1, 'Job is required'),
  notes: z.string().max(5000).optional(),
})

/**
 * Schema for updating an existing application (stage move, notes, score).
 * `statusId` references a pipeline stage; the handler verifies it belongs to the
 * application's job.
 */
export const updateApplicationSchema = z.object({
  statusId: z.string().min(1).optional(),
  notes: z.string().max(5000).nullish(),
  score: z.number().int().min(0).max(100).nullish(),
})

/** Schema for application list query params */
export const applicationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  jobId: z.string().min(1).optional(),
  candidateId: z.string().min(1).optional(),
  /** Filter by a specific stage id, or by category role. */
  statusId: z.string().min(1).optional(),
  statusCategory: z.enum(['applied', 'in_progress', 'hired', 'rejected']).optional(),
  search: z.string().trim().max(200).optional(),
  score: z.enum(['high', 'medium', 'low', 'none']).optional(),
  interview: z.enum(['has-interview', 'no-interview']).optional(),
  sort: z.enum(['date-desc', 'date-asc', 'name-asc', 'name-desc', 'score-desc', 'score-asc', 'updated-desc']).default('date-desc'),
  /** JSON-encoded array of { propertyDefinitionId, op, value } filters */
  propertyFilters: z.string().optional(),
})

/** Reusable schema for `:id` route params */
export const applicationIdParamSchema = z.object({
  id: z.string().min(1),
})

// Application stage moves are free-form across a job's custom pipeline; there is
// no fixed transition graph. See shared/pipeline.ts.
