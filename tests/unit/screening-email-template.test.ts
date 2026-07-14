import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateScreeningEmailTemplateSchema } from '../../server/utils/schemas/screeningEmailTemplate'
import {
  getScreeningEmailTemplateForUser,
  upsertScreeningEmailTemplate,
} from '../../server/utils/screeningEmailTemplate'
import { screeningEmailTemplate } from '../../server/database/schema'
import { DEFAULT_SCREENING_TEMPLATE } from '../../shared/screening-template'
import { renderTemplate } from '../../shared/template-renderer'

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

  it('rejects a tag with inner whitespace ({{ jobTitle }}) because the renderer never substitutes it', () => {
    // Regression guard: the validator's tag pattern must match shared/template-renderer.ts's
    // canonical pattern exactly. A hand-rolled second regex that tolerates inner whitespace
    // would let `{{ jobTitle }}` pass validation while renderTemplate() leaves it untouched,
    // leaking a literal `{{ jobTitle }}` into the candidate's email.
    const subject = 'Next steps: {{ jobTitle }} at {{organizationName}}'

    const result = updateScreeningEmailTemplateSchema.safeParse({
      subject,
      body: 'valid body',
    })
    expect(result.success).toBe(false)

    // Prove the failure mode this guards against: renderTemplate leaves the malformed
    // tag untouched (unresolved) even though `jobTitle` itself is a known variable name.
    const rendered = renderTemplate(subject, { jobTitle: 'Engineer', organizationName: 'Acme' })
    expect(rendered).toContain('{{ jobTitle }}')
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
    const { db, inserted, conflictTargets } = makeDb()
    vi.stubGlobal('db', db)

    await upsertScreeningEmailTemplate({
      organizationId: 'org1',
      userId: 'userA',
      subject: 'User A subject',
      body: 'User A body',
    })

    // The row written is scoped to userA, not some other user in the same org.
    expect(inserted[0]).toMatchObject({ organizationId: 'org1', userId: 'userA' })

    // The upsert's conflict target is the composite (organizationId, userId) unique
    // index — proving the ON CONFLICT clause can only ever match/update userA's own
    // row, never another user's row in the same organization (userB, userC, ...).
    expect(conflictTargets[0]).toEqual([
      screeningEmailTemplate.organizationId,
      screeningEmailTemplate.userId,
    ])
  })
})
