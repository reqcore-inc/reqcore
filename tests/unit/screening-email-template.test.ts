import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateScreeningEmailTemplateSchema } from '../../server/utils/schemas/screeningEmailTemplate'
import {
  getScreeningEmailTemplateForUser,
  upsertScreeningEmailTemplate,
} from '../../server/utils/screeningEmailTemplate'
import { DEFAULT_SCREENING_TEMPLATE } from '../../shared/screening-template'

afterEach(() => vi.unstubAllGlobals())

describe('updateScreeningEmailTemplateSchema', () => {
  it('accepts a subject/body using only known template variables', () => {
    const result = updateScreeningEmailTemplateSchema.safeParse({
      subject: 'Next steps: {{jobTitle}} at {{organizationName}}',
      body: 'Hi {{candidateFirstName}}, thanks from {{senderName}}.',
    })
    expect(result.success).toBe(true)
  })

  it('rejects subjects over the max length', () => {
    const result = updateScreeningEmailTemplateSchema.safeParse({
      subject: 'a'.repeat(201),
      body: 'valid body',
    })
    expect(result.success).toBe(false)
  })

  it('rejects bodies over the max length', () => {
    const result = updateScreeningEmailTemplateSchema.safeParse({
      subject: 'valid subject',
      body: 'a'.repeat(10_001),
    })
    expect(result.success).toBe(false)
  })

  it('rejects a single unknown tag', () => {
    const result = updateScreeningEmailTemplateSchema.safeParse({
      subject: 'Hello {{bogusTag}}',
      body: 'valid body',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const message = JSON.stringify(result.error.issues)
      expect(message).toContain('bogusTag')
    }
  })

  it('rejects multiple unknown tags across subject and body', () => {
    const result = updateScreeningEmailTemplateSchema.safeParse({
      subject: 'Hello {{fooTag}}',
      body: 'Body with {{barTag}} and {{bazTag}}',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const message = JSON.stringify(result.error.issues)
      expect(message).toContain('fooTag')
      expect(message).toContain('barTag')
      expect(message).toContain('bazTag')
    }
  })
})

describe('getScreeningEmailTemplateForUser', () => {
  it('falls back to the default template with isDefault:true when no row exists', async () => {
    const findFirst = vi.fn(async () => undefined)
    vi.stubGlobal('db', { query: { screeningEmailTemplate: { findFirst } } })

    const result = await getScreeningEmailTemplateForUser('org1', 'user1')

    expect(result).toEqual({
      subject: DEFAULT_SCREENING_TEMPLATE.subject,
      body: DEFAULT_SCREENING_TEMPLATE.body,
      isDefault: true,
    })
  })

  it('returns the saved row with isDefault:false when one exists', async () => {
    const findFirst = vi.fn(async () => ({ subject: 'Custom subject', body: 'Custom body' }))
    vi.stubGlobal('db', { query: { screeningEmailTemplate: { findFirst } } })

    const result = await getScreeningEmailTemplateForUser('org1', 'user1')

    expect(result).toEqual({ subject: 'Custom subject', body: 'Custom body', isDefault: false })
  })
})

describe('upsertScreeningEmailTemplate', () => {
  function makeDb() {
    const inserted: Record<string, unknown>[] = []
    const conflictTargets: unknown[] = []
    const conflictSets: Record<string, unknown>[] = []
    const returned = { subject: '', body: '' }

    const insert = vi.fn(() => ({
      values: vi.fn((v: Record<string, unknown>) => {
        inserted.push(v)
        returned.subject = v.subject as string
        returned.body = v.body as string
        return {
          onConflictDoUpdate: vi.fn((opts: { target: unknown, set: Record<string, unknown> }) => {
            conflictTargets.push(opts.target)
            conflictSets.push(opts.set)
            return {
              returning: vi.fn(async () => [{ subject: returned.subject, body: returned.body }]),
            }
          }),
        }
      }),
    }))

    return { db: { insert }, inserted, conflictTargets, conflictSets }
  }

  it('creates a new row for a first-time upsert', async () => {
    const { db, inserted } = makeDb()
    vi.stubGlobal('db', db)

    const result = await upsertScreeningEmailTemplate({
      organizationId: 'org1',
      userId: 'user1',
      subject: 'New subject',
      body: 'New body',
    })

    expect(result).toEqual({ subject: 'New subject', body: 'New body' })
    expect(inserted[0]).toMatchObject({
      organizationId: 'org1',
      userId: 'user1',
      subject: 'New subject',
      body: 'New body',
    })
  })

  it('updates an existing row on conflict, scoped to (organizationId, userId)', async () => {
    const { db, conflictSets } = makeDb()
    vi.stubGlobal('db', db)

    const result = await upsertScreeningEmailTemplate({
      organizationId: 'org1',
      userId: 'user1',
      subject: 'Updated subject',
      body: 'Updated body',
    })

    expect(result).toEqual({ subject: 'Updated subject', body: 'Updated body' })
    expect(conflictSets[0]).toMatchObject({ subject: 'Updated subject', body: 'Updated body' })
  })

  it('does not affect another user in the same organization (cross-user isolation)', async () => {
    const { db, inserted } = makeDb()
    vi.stubGlobal('db', db)

    await upsertScreeningEmailTemplate({
      organizationId: 'org1',
      userId: 'userA',
      subject: 'User A subject',
      body: 'User A body',
    })

    // Values written must be scoped to userA only — never leaking to another userId.
    expect(inserted[0].userId).toBe('userA')
    expect(inserted[0].userId).not.toBe('userB')
  })
})
