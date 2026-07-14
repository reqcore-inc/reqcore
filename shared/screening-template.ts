/**
 * Screening invitation email template config.
 *
 * NOTE: This is intentionally kept separate from `shared/system-templates.ts`
 * (`SYSTEM_TEMPLATES`), which powers the interview template picker UI.
 * Screening variables/defaults must never be added to `SYSTEM_TEMPLATES` —
 * that list is interview-specific and rendering a screening template through
 * the interview picker would surface unresolved `{{...}}` tags (e.g.
 * `{{interviewDate}}`) that screening invitations don't have data for.
 */

/** Template variables available for screening invitation emails. */
export const SCREENING_TEMPLATE_VARIABLES = [
  'candidateName',
  'candidateFirstName',
  'candidateLastName',
  'candidateEmail',
  'jobTitle',
  'organizationName',
  'senderName',
] as const

export type ScreeningTemplateVariable = typeof SCREENING_TEMPLATE_VARIABLES[number]

export interface DefaultScreeningTemplate {
  subject: string
  body: string
}

/** Default subject/body used when an organization hasn't customized their screening invitation. */
export const DEFAULT_SCREENING_TEMPLATE: DefaultScreeningTemplate = {
  subject: 'Next steps: {{jobTitle}} at {{organizationName}}',
  body: `Hi {{candidateFirstName}},

Thank you for your interest in the {{jobTitle}} position at {{organizationName}}. We'd like to invite you to complete a short screening as the next step in our hiring process.

Please follow the instructions in this email to get started. If you have any questions, feel free to reply directly.

Best regards,
{{senderName}}`,
}
