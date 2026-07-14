import { describe, it, expect } from 'vitest'
import { buildInterviewInvitationHtml } from '../../server/utils/email'
import type { InterviewEmailData } from '../../server/utils/email'

/**
 * Regression guard for the `buildBrandedEmailShell` extraction (screening
 * invitation feature): the interview invitation HTML must render byte-for-byte
 * identically to before the shared shell was pulled out of
 * `buildInterviewInvitationHtml`. If a future edit to the shared shell (for
 * screening invitations or any other email type) silently changes interview
 * output, this test fails.
 */
const CANONICAL_DATA: InterviewEmailData = {
  candidateName: 'Jane Doe',
  candidateFirstName: 'Jane',
  candidateLastName: 'Doe',
  candidateEmail: 'jane@example.com',
  jobTitle: 'Senior Engineer',
  interviewTitle: 'Technical Screen',
  interviewDate: 'Monday, January 5, 2026',
  interviewTime: '2:00 PM',
  interviewDuration: 45,
  interviewType: 'Video Call',
  interviewLocation: null,
  interviewers: null,
  organizationName: 'Acme Corp',
  responseUrls: {
    accepted: 'https://reqcore.com/respond/accept',
    declined: 'https://reqcore.com/respond/decline',
    tentative: 'https://reqcore.com/respond/tentative',
  },
}

describe('buildInterviewInvitationHtml — HTML shell regression', () => {
  it('renders the exact canonical HTML shell for a fixed input (with response buttons)', () => {
    const html = buildInterviewInvitationHtml(
      'Interview scheduled: Technical Screen',
      'Hi Jane,\n\nYou are scheduled for a Technical Screen.',
      CANONICAL_DATA,
    )

    expect(html).toMatchSnapshot()
  })

  it('preserves the max-width:560px shell (interview invitations use the wider layout for response buttons)', () => {
    const html = buildInterviewInvitationHtml('Subject', 'Body', CANONICAL_DATA)
    expect(html).toContain('max-width:560px')
  })

  it('preserves the organization name in both header and footer', () => {
    const html = buildInterviewInvitationHtml('Subject', 'Body', CANONICAL_DATA)
    const headerMatches = html.match(/Acme Corp/g) ?? []
    // Header <h1> + footer "Sent by ... via Reqcore" = at least 2 occurrences
    expect(headerMatches.length).toBeGreaterThanOrEqual(2)
  })

  it('renders without response buttons when responseUrls is omitted', () => {
    const dataWithoutUrls: InterviewEmailData = { ...CANONICAL_DATA, responseUrls: undefined }
    const html = buildInterviewInvitationHtml('Subject', 'Body', dataWithoutUrls)

    expect(html).not.toContain('Can you make it?')
    expect(html).toMatchSnapshot()
  })
})
