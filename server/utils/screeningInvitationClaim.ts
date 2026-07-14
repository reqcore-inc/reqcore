/**
 * Pure decision logic for the screening-invitation "atomic claim":
 * given the current DB row state, decide whether a send is allowed right
 * now (cooldown check) and whether the application status should
 * auto-advance from `new` → `screening`.
 *
 * Deliberately dependency-free (no db/env access) so it is directly
 * unit-testable. The route wraps this in a `db.transaction` +
 * `SELECT ... FOR UPDATE` to make the read-decide-write sequence atomic
 * across concurrent requests (TOCTOU-safe) — this module only owns the
 * decision, not the locking.
 */

export type ScreeningApplicationStatus =
  | 'new'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected'

export const SCREENING_INVITATION_COOLDOWN_MS = 2 * 60 * 1000

export interface EvaluateScreeningInvitationClaimInput {
  status: ScreeningApplicationStatus
  screeningInvitationSentAt: Date | null
  now: Date
}

export type EvaluateScreeningInvitationClaimResult =
  | { allowed: true, willAdvanceStatus: boolean }
  | { allowed: false, reason: 'cooldown', retryAfterMs: number }

/**
 * `screeningInvitationSentAt` cooldown boundary is inclusive: exactly
 * `SCREENING_INVITATION_COOLDOWN_MS` elapsed is allowed (matches the
 * interview invitation cooldown's `elapsed < cooldownMs` blocking rule).
 */
export function evaluateScreeningInvitationClaim(
  input: EvaluateScreeningInvitationClaimInput,
): EvaluateScreeningInvitationClaimResult {
  const { status, screeningInvitationSentAt, now } = input

  if (screeningInvitationSentAt) {
    const elapsed = now.getTime() - new Date(screeningInvitationSentAt).getTime()
    if (elapsed < SCREENING_INVITATION_COOLDOWN_MS) {
      return { allowed: false, reason: 'cooldown', retryAfterMs: SCREENING_INVITATION_COOLDOWN_MS - elapsed }
    }
  }

  return { allowed: true, willAdvanceStatus: status === 'new' }
}
