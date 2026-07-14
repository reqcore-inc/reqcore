import { z } from 'zod'
import { SCREENING_TEMPLATE_VARIABLES } from '~~/shared/screening-template'
import { extractTemplateTags, TEMPLATE_TAG_LIKE_PATTERN } from '~~/shared/template-renderer'
import { MAX_BODY_LENGTH, MAX_SUBJECT_LENGTH } from './emailTemplate'

// ─────────────────────────────────────────────
// Screening email template validation schema
// ─────────────────────────────────────────────

/** A well-formed `{{tag}}` placeholder — matches the canonical renderer pattern exactly. */
const WELL_FORMED_TAG_PATTERN = /^\{\{\w+\}\}$/

/**
 * Returns the `{{...}}`-looking placeholders in `text` that are invalid, i.e.
 * that would NOT be substituted by `renderTemplate` (shared/template-renderer.ts)
 * and would therefore leak into the candidate's email unresolved. This covers:
 *  - well-formed `{{tag}}` placeholders referencing a variable outside
 *    SCREENING_TEMPLATE_VARIABLES (unknown tag), and
 *  - malformed `{{...}}`-looking blocks that don't match the renderer's
 *    canonical `{{tag}}` pattern at all (e.g. `{{ jobTitle }}` with inner
 *    whitespace) — the renderer's regex requires no whitespace inside braces,
 *    so these are never replaced and would render literally.
 *
 * Deliberately reuses `extractTemplateTags`/`TEMPLATE_TAG_LIKE_PATTERN` from
 * shared/template-renderer.ts instead of a hand-rolled regex, so validation
 * can never drift from what the renderer actually substitutes.
 */
export function findUnknownScreeningTemplateTags(text: string): string[] {
  const allowed = new Set<string>(SCREENING_TEMPLATE_VARIABLES)
  const invalid = new Set<string>()

  for (const tag of extractTemplateTags(text)) {
    if (!allowed.has(tag)) {
      invalid.add(`{{${tag}}}`)
    }
  }

  for (const match of text.matchAll(TEMPLATE_TAG_LIKE_PATTERN)) {
    const raw = match[0]
    if (!WELL_FORMED_TAG_PATTERN.test(raw)) {
      invalid.add(raw)
    }
  }

  return [...invalid]
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
      message: `Unknown template variable(s): ${unknownSubjectTags.join(', ')}`,
    })
  }

  const unknownBodyTags = findUnknownScreeningTemplateTags(data.body)
  if (unknownBodyTags.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['body'],
      message: `Unknown template variable(s): ${unknownBodyTags.join(', ')}`,
    })
  }
})
