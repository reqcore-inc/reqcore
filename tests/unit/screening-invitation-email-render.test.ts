import { describe, it, expect } from 'vitest'
import { renderScreeningInvitationContent } from '../../server/utils/email'
import { DEFAULT_SCREENING_TEMPLATE } from '../../shared/screening-template'

function baseData(overrides: Partial<Parameters<typeof renderScreeningInvitationContent>[2]> = {}) {
  return {
    candidateName: 'Jane Doe',
    candidateFirstName: 'Jane',
    candidateLastName: 'Doe',
    candidateEmail: 'jane@example.com',
    jobTitle: 'Senior Engineer',
    organizationName: 'Acme Corp',
    senderName: 'Alex Recruiter',
    ...overrides,
  }
}

describe('renderScreeningInvitationContent', () => {
  it('renders the default screening template with known variables substituted', () => {
    const result = renderScreeningInvitationContent(
      DEFAULT_SCREENING_TEMPLATE.subject,
      DEFAULT_SCREENING_TEMPLATE.body,
      baseData(),
    )

    expect(result.subject).toBe('Next steps: Senior Engineer at Acme Corp')
    expect(result.text).toContain('Hi Jane,')
    expect(result.text).toContain('Senior Engineer')
    expect(result.text).toContain('Alex Recruiter')
    expect(result.html).toContain('Acme Corp')
  })

  it('escapes an XSS payload in candidateLastName and template body for the HTML part', () => {
    const data = baseData({ candidateLastName: '<script>alert(1)</script>' })
    const body = 'Hi {{candidateFirstName}} {{candidateLastName}}, see <img onerror=x src=x>.'

    const result = renderScreeningInvitationContent('Subject', body, data)

    expect(result.html).not.toContain('<script>alert(1)</script>')
    expect(result.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(result.html).not.toContain('<img onerror=x src=x>')
    expect(result.html).toContain('&lt;img onerror=x src=x&gt;')
  })

  it('keeps the plain-text part unescaped (no HTML entity encoding)', () => {
    const data = baseData({ candidateLastName: '<script>alert(1)</script>' })
    const body = 'Hi {{candidateLastName}}, welcome.'

    const result = renderScreeningInvitationContent('Subject', body, data)

    expect(result.text).toContain('<script>alert(1)</script>')
  })

  it('strips CR/LF from the rendered subject to prevent header injection', () => {
    const data = baseData({ jobTitle: 'Engineer\r\nBcc: attacker@evil.com' })
    const result = renderScreeningInvitationContent('Role: {{jobTitle}}', 'body', data)

    expect(result.subject).not.toMatch(/[\r\n]/)
    expect(result.subject).not.toContain('Bcc:')
  })

  it('falls back to DEFAULT_SCREENING_TEMPLATE content shape when template is unset by caller', () => {
    // Route-level fallback to DEFAULT_SCREENING_TEMPLATE is exercised by
    // getScreeningEmailTemplateForUser (see screening-email-template.test.ts);
    // this confirms the default template itself renders cleanly end to end.
    const result = renderScreeningInvitationContent(
      DEFAULT_SCREENING_TEMPLATE.subject,
      DEFAULT_SCREENING_TEMPLATE.body,
      baseData(),
    )

    expect(result.subject).not.toContain('{{')
    expect(result.text).not.toContain('{{')
  })
})
