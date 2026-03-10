export interface SystemTemplate {
  id: string
  name: string
  subject: string
  body: string
  description: string
}

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  {
    id: 'system-standard',
    name: 'Standard Interview Invitation',
    description: 'A professional and formal invitation suitable for most interview types.',
    subject: 'Interview Invitation: {{jobTitle}} at {{organizationName}}',
    body: `Dear {{candidateName}},

We are pleased to invite you to an interview for the {{jobTitle}} position at {{organizationName}}.

Interview Details:
- Date: {{interviewDate}}
- Time: {{interviewTime}}
- Duration: {{interviewDuration}} minutes
- Type: {{interviewType}}
- Location: {{interviewLocation}}

Interviewers: {{interviewers}}

Please confirm your availability by replying to this email. If you need to reschedule, let us know as soon as possible.

We look forward to speaking with you!

Best regards,
{{organizationName}}`,
  },
  {
    id: 'system-friendly',
    name: 'Friendly & Casual',
    description: 'A warm, conversational tone that puts candidates at ease.',
    subject: "Let's chat! Interview for {{jobTitle}}",
    body: `Hi {{candidateFirstName}},

Great news — we'd love to meet you for the {{jobTitle}} role at {{organizationName}}!

Here are the details:
- When: {{interviewDate}} at {{interviewTime}} ({{interviewDuration}} min)
- How: {{interviewType}}
- Where: {{interviewLocation}}

You'll be speaking with: {{interviewers}}

If this time doesn't work for you, just let us know and we'll find something that does.

Looking forward to it!

The {{organizationName}} Team`,
  },
  {
    id: 'system-technical',
    name: 'Technical Interview',
    description: 'Tailored for technical interviews with preparation tips for candidates.',
    subject: 'Technical Interview: {{jobTitle}} — {{organizationName}}',
    body: `Dear {{candidateName}},

Thank you for your interest in the {{jobTitle}} position at {{organizationName}}. We'd like to invite you to a technical interview.

Interview Details:
- Title: {{interviewTitle}}
- Date: {{interviewDate}}
- Time: {{interviewTime}}
- Duration: {{interviewDuration}} minutes
- Format: {{interviewType}}
- Location: {{interviewLocation}}

Your interviewer(s): {{interviewers}}

To help you prepare:
- Be ready to discuss your technical experience and problem-solving approach
- You may be asked to write or review code during the session
- Feel free to ask questions about our tech stack and development practices

Please confirm your attendance by replying to this email.

Best regards,
{{organizationName}}`,
  },
]

export const AVAILABLE_VARIABLES = [
  { key: '{{candidateName}}', desc: 'Full name' },
  { key: '{{candidateFirstName}}', desc: 'First name' },
  { key: '{{candidateLastName}}', desc: 'Last name' },
  { key: '{{candidateEmail}}', desc: 'Email address' },
  { key: '{{jobTitle}}', desc: 'Job title' },
  { key: '{{interviewTitle}}', desc: 'Interview title' },
  { key: '{{interviewDate}}', desc: 'Interview date' },
  { key: '{{interviewTime}}', desc: 'Interview time' },
  { key: '{{interviewDuration}}', desc: 'Duration (min)' },
  { key: '{{interviewType}}', desc: 'Interview type' },
  { key: '{{interviewLocation}}', desc: 'Location/link' },
  { key: '{{interviewers}}', desc: 'Interviewer names' },
  { key: '{{organizationName}}', desc: 'Your org name' },
] as const

export function renderTemplatePreview(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in variables ? variables[key]! : match
  })
}
