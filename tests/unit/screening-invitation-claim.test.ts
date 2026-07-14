import { describe, it, expect } from 'vitest'
import {
  evaluateScreeningInvitationClaim,
  SCREENING_INVITATION_COOLDOWN_MS,
} from '../../server/utils/screeningInvitationClaim'

const NOW = new Date('2026-07-14T12:00:00Z')

describe('evaluateScreeningInvitationClaim', () => {
  it('allows a first-time send and flags status advance when status is "new"', () => {
    const result = evaluateScreeningInvitationClaim({
      status: 'new',
      screeningInvitationSentAt: null,
      now: NOW,
    })

    expect(result).toEqual({ allowed: true, willAdvanceStatus: true })
  })

  it('allows a send for a non-"new" status but does not advance status', () => {
    const result = evaluateScreeningInvitationClaim({
      status: 'interview',
      screeningInvitationSentAt: null,
      now: NOW,
    })

    expect(result).toEqual({ allowed: true, willAdvanceStatus: false })
  })

  it('leaves a "rejected" application status unchanged (never auto-advances a non-"new" status)', () => {
    const result = evaluateScreeningInvitationClaim({
      status: 'rejected',
      screeningInvitationSentAt: null,
      now: NOW,
    })

    expect(result).toEqual({ allowed: true, willAdvanceStatus: false })
  })

  it('blocks a resend inside the 2-minute cooldown window', () => {
    const sentAt = new Date(NOW.getTime() - (SCREENING_INVITATION_COOLDOWN_MS - 1))
    const result = evaluateScreeningInvitationClaim({
      status: 'screening',
      screeningInvitationSentAt: sentAt,
      now: NOW,
    })

    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toBe('cooldown')
      expect(result.retryAfterMs).toBeGreaterThan(0)
    }
  })

  it('allows a resend exactly at the 2-minute boundary', () => {
    const sentAt = new Date(NOW.getTime() - SCREENING_INVITATION_COOLDOWN_MS)
    const result = evaluateScreeningInvitationClaim({
      status: 'screening',
      screeningInvitationSentAt: sentAt,
      now: NOW,
    })

    expect(result).toEqual({ allowed: true, willAdvanceStatus: false })
  })

  it('allows a resend just past the 2-minute boundary', () => {
    const sentAt = new Date(NOW.getTime() - (SCREENING_INVITATION_COOLDOWN_MS + 1000))
    const result = evaluateScreeningInvitationClaim({
      status: 'new',
      screeningInvitationSentAt: sentAt,
      now: NOW,
    })

    expect(result).toEqual({ allowed: true, willAdvanceStatus: true })
  })
})
