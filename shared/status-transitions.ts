/**
 * ─────────────────────────────────────────────
 * Status transition rules — single source of truth
 * ─────────────────────────────────────────────
 *
 * Defines allowed state transitions for jobs and interviews.
 * Imported by both server (API validation) and client (UI rendering).
 *
 * If you need to add/remove a transition, change it HERE and both
 * sides stay in sync automatically.
 *
 * NOTE: applications are deliberately absent. Their statuses are per-job custom
 * pipeline stages (see shared/pipeline.ts), so moves are free-form — a fixed
 * graph can't describe user-defined stages. The only constraint enforced is that
 * the target stage belongs to the application's job.
 */

// ─── Job status transitions ────────────────────────────────────────
/**
 * Allowed status transitions for jobs.
 * `archived` can be reverted to `draft` or `open`.
 */
export const JOB_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['open', 'archived'],
  open: ['closed', 'archived'],
  closed: ['open', 'archived'],
  archived: ['draft', 'open'],
}

// ─── Interview status transitions ──────────────────────────────────
/**
 * Allowed status transitions for interviews.
 * `completed` is terminal — no forward transitions.
 * `cancelled` and `no_show` can be rescheduled back to `scheduled`.
 */
export const INTERVIEW_STATUS_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: ['scheduled'],
  no_show: ['scheduled'],
}
