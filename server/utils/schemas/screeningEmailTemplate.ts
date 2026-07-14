import { z } from 'zod'
import { SCREENING_TEMPLATE_VARIABLES } from '~~/shared/screening-template'
import { MAX_BODY_LENGTH, MAX_SUBJECT_LENGTH } from './emailTemplate'

// ─────────────────────────────────────────────
// Screening email template validation schema
// ─────────────────────────────────────────────

const TEMPLATE_TAG_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/** Returns the set of `{{tag}}` placeholders in `text` that are not in SCREENING_TEMPLATE_VARIABLES. */
export function findUnknownScreeningTemplateTags(text: string): string[] {
  const allowed = new Set<string>(SCREENING_TEMPLATE_VARIABLES)
  const unknown = new Set<string>()

  for (const match of text.matchAll(TEMPLATE_TAG_PATTERN)) {
    const tag = match[1]
    if (tag && !allowed.has(tag)) {
      unknown.add(tag)
    }
  }

  return [...unknown]
}

/** Schema for updating the current user's screening invitation email template. */
export const updateScreeningEmailTemplateSchema = z.object({
  subject: z.string().min(1, 'Subject line is required').max(MAX_SUBJECT_LENGTH),
  body: z.string().min(1, 'Email body is required').max(MAX_BODY_LENGTH),
}).superRefine((data, ctx) => {
  const unknownSubjectTags = findUnknownScreeningTemplateTags(data.subject)
  if (unknownSubjectTags.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['subject'],
      message: `Unknown template variable(s): ${unknownSubjectTags.map(t => `{{${t}}}`).join(', ')}`,
    })
  }

  const unknownBodyTags = findUnknownScreeningTemplateTags(data.body)
  if (unknownBodyTags.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['body'],
      message: `Unknown template variable(s): ${unknownBodyTags.map(t => `{{${t}}}`).join(', ')}`,
    })
  }
})
