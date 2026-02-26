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

/** Schema for updating an existing application (status transitions, notes, score) */
export const updateApplicationSchema = z.object({
  status: z.enum(['new', 'screening', 'interview', 'offer', 'hired', 'rejected']).optional(),
  notes: z.string().max(5000).nullish(),
  score: z.number().int().min(0).max(100).nullish(),
})

/** Schema for application list query params */
export const applicationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  jobId: z.string().min(1).optional(),
  candidateId: z.string().min(1).optional(),
  status: z.enum(['new', 'screening', 'interview', 'offer', 'hired', 'rejected']).optional(),
  search: z.string().max(200).optional(),
})

/** Reusable schema for `:id` route params */
export const applicationIdParamSchema = z.object({
  id: z.string().min(1),
})

// ─────────────────────────────────────────────
// Status transition rules
// ─────────────────────────────────────────────

/**
 * Allowed status transitions for applications.
 * - `hired` is terminal — no forward transitions
 * - `rejected` can be re-opened back to `new`
 */
export const APPLICATION_STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ['screening', 'interview', 'rejected'],
  screening: ['interview', 'offer', 'rejected'],
  interview: ['offer', 'rejected'],
  offer: ['hired', 'rejected'],
  hired: [],
  rejected: ['new'],
}
