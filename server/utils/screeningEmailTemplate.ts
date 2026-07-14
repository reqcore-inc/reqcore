import { and, eq } from 'drizzle-orm'
import { DEFAULT_SCREENING_TEMPLATE } from '~~/shared/screening-template'
import { screeningEmailTemplate } from '../database/schema'

export interface ScreeningEmailTemplateRow {
  subject: string
  body: string
}

export interface GetScreeningEmailTemplateResult extends ScreeningEmailTemplateRow {
  isDefault: boolean
}

/**
 * Fetch the current user's screening invitation template, scoped to
 * (organizationId, userId). Falls back to the shared default template
 * (isDefault:true) when the user hasn't customized their own row yet.
 */
export async function getScreeningEmailTemplateForUser(
  organizationId: string,
  userId: string,
): Promise<GetScreeningEmailTemplateResult> {
  const existing = await db.query.screeningEmailTemplate.findFirst({
    where: and(
      eq(screeningEmailTemplate.organizationId, organizationId),
      eq(screeningEmailTemplate.userId, userId),
    ),
    columns: { subject: true, body: true },
  })

  if (!existing) {
    return { ...DEFAULT_SCREENING_TEMPLATE, isDefault: true }
  }

  return { subject: existing.subject, body: existing.body, isDefault: false }
}

export interface UpsertScreeningEmailTemplateInput {
  organizationId: string
  userId: string
  subject: string
  body: string
}

/**
 * Create-or-update the screening invitation template for (organizationId, userId).
 * Scoped strictly to that unique pair — never touches another user's row.
 */
export async function upsertScreeningEmailTemplate(
  input: UpsertScreeningEmailTemplateInput,
): Promise<ScreeningEmailTemplateRow> {
  const [result] = await db
    .insert(screeningEmailTemplate)
    .values({
      organizationId: input.organizationId,
      userId: input.userId,
      subject: input.subject,
      body: input.body,
    })
    .onConflictDoUpdate({
      target: [screeningEmailTemplate.organizationId, screeningEmailTemplate.userId],
      set: {
        subject: input.subject,
        body: input.body,
        updatedAt: new Date(),
      },
    })
    .returning({
      subject: screeningEmailTemplate.subject,
      body: screeningEmailTemplate.body,
    })

  if (!result) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to save screening email template' })
  }

  return result
}
