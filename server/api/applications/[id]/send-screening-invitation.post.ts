import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { application } from '../../../database/schema'
import { applicationIdParamSchema } from '../../../utils/schemas/application'
import { getScreeningEmailTemplateForUser } from '../../../utils/screeningEmailTemplate'
import { sendScreeningInvitationEmail } from '../../../utils/email'
import { createRateLimiter } from '../../../utils/rateLimit'
import { evaluateScreeningInvitationClaim } from '../../../utils/screeningInvitationClaim'

const candidateEmailSchema = z.string().min(1, 'Candidate has no email on file').email('Candidate email address is invalid')

const limiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
  message: 'Too many screening invitation requests. Please wait before retrying.',
})

/**
 * POST /api/applications/:id/send-screening-invitation
 *
 * Sends a screening invitation email to the candidate attached to this
 * application, using the sender's saved screening template (falling back to
 * `DEFAULT_SCREENING_TEMPLATE` via `getScreeningEmailTemplateForUser`).
 * Auto-advances the application from `new` → `screening` on first send only
 * — later-stage statuses (interview, offer, hired, rejected) are never
 * touched.
 *
 * Concurrency/TOCTOU safety: the 2-minute resend cooldown and the
 * status-advance decision are both evaluated and applied inside a single
 * `db.transaction` that row-locks the application via `SELECT ... FOR
 * UPDATE`, so two concurrent requests for the same application can never
 * both "win" the claim. If the email send itself fails after the claim is
 * taken, the claim (sentAt + any status advance) is rolled back so the
 * candidate isn't silently stuck in a cooldown/advanced state for an email
 * that was never actually sent.
 */
export default defineEventHandler(async (event) => {
  await limiter(event)
  const session = await requirePermission(event, { application: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id } = await getValidatedRouterParams(event, applicationIdParamSchema.parse)

  // Org-scoped fetch — candidate/job/organization must never be resolved by
  // a client-supplied id alone; they are only reached through this
  // (id, organizationId)-scoped application row.
  const app = await db.query.application.findFirst({
    where: and(eq(application.id, id), eq(application.organizationId, orgId)),
    with: {
      candidate: true,
      job: { columns: { title: true } },
      organization: { columns: { name: true } },
    },
  })

  if (!app || !app.candidate || !app.job || !app.organization) {
    throw createError({ statusCode: 404, statusMessage: 'Application not found' })
  }

  const emailCheck = candidateEmailSchema.safeParse(app.candidate.email)
  if (!emailCheck.success) {
    throw createError({ statusCode: 400, statusMessage: 'Candidate does not have a valid email address' })
  }

  const now = new Date()

  const claim = await db.transaction(async (tx) => {
    const [current] = await tx.select({
      status: application.status,
      screeningInvitationSentAt: application.screeningInvitationSentAt,
    })
      .from(application)
      .where(and(eq(application.id, id), eq(application.organizationId, orgId)))
      .for('update')

    if (!current) {
      return { allowed: false as const, reason: 'not-found' as const }
    }

    const decision = evaluateScreeningInvitationClaim({
      status: current.status,
      screeningInvitationSentAt: current.screeningInvitationSentAt,
      now,
    })

    if (!decision.allowed) {
      return decision
    }

    await tx.update(application)
      .set({
        screeningInvitationSentAt: now,
        ...(decision.willAdvanceStatus ? { status: 'screening' as const } : {}),
        updatedAt: now,
      })
      .where(and(eq(application.id, id), eq(application.organizationId, orgId)))

    return {
      allowed: true as const,
      willAdvanceStatus: decision.willAdvanceStatus,
      previousSentAt: current.screeningInvitationSentAt,
      previousStatus: current.status,
    }
  })

  if (!claim.allowed) {
    if (claim.reason === 'not-found') {
      throw createError({ statusCode: 404, statusMessage: 'Application not found' })
    }
    throw createError({ statusCode: 429, statusMessage: 'Screening invitation was already sent recently. Please wait before resending.' })
  }

  const template = await getScreeningEmailTemplateForUser(orgId, session.user.id)

  try {
    await sendScreeningInvitationEmail({
      subject: template.subject,
      body: template.body,
      data: {
        candidateName: `${app.candidate.firstName} ${app.candidate.lastName}`,
        candidateFirstName: app.candidate.firstName,
        candidateLastName: app.candidate.lastName,
        candidateEmail: app.candidate.email,
        jobTitle: app.job.title,
        organizationName: app.organization.name,
        senderName: session.user.name,
      },
    })
  }
  catch {
    // Roll back the claim so a transient send failure doesn't burn the
    // candidate's cooldown window or leave the status silently advanced
    // for an invitation that was never actually delivered. The rollback
    // itself is best-effort: if it also fails (e.g. a second DB outage),
    // log it under its own error category so it's distinguishable from the
    // original send failure in monitoring, but still surface the original
    // 502 to the client rather than an unrelated rollback error.
    try {
      await db.update(application)
        .set({
          screeningInvitationSentAt: claim.previousSentAt,
          ...(claim.willAdvanceStatus ? { status: claim.previousStatus } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(application.id, id), eq(application.organizationId, orgId)))
    }
    catch (rollbackErr) {
      logError('email.screening_invitation_rollback_failed', {
        application_id: id,
        organization_id: orgId,
        error_message: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
      })
    }

    throw createError({ statusCode: 502, statusMessage: 'Failed to send screening invitation email' })
  }

  recordActivity({
    organizationId: orgId,
    actorId: session.user.id,
    action: 'updated',
    resourceType: 'application',
    resourceId: id,
    metadata: {
      action: 'screening_invitation_sent',
      candidateEmail: app.candidate.email,
      statusAdvanced: claim.willAdvanceStatus,
    },
  })

  if (claim.willAdvanceStatus) {
    recordActivity({
      organizationId: orgId,
      actorId: session.user.id,
      action: 'status_changed',
      resourceType: 'application',
      resourceId: id,
      metadata: { from: claim.previousStatus, to: 'screening' },
    })
  }

  return {
    sent: true,
    sentAt: now,
    statusAdvanced: claim.willAdvanceStatus,
  }
})
