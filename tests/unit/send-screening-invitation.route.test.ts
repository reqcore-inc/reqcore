import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Stub Nitro auto-imports BEFORE importing the route module ──────────────
// The route file only imports drizzle helpers, schema, and plain util
// modules (mocked below via vi.mock). Everything else (defineEventHandler,
// requirePermission, getValidatedRouterParams, db, createError,
// recordActivity) is a Nitro auto-import — stub it as a global, same
// pattern as tests/unit/rate-limit.test.ts.

const logErrorMock = vi.fn()
vi.stubGlobal('logInfo', vi.fn())
vi.stubGlobal('logWarn', vi.fn())
vi.stubGlobal('logError', logErrorMock)
vi.stubGlobal('logDebug', vi.fn())

vi.stubGlobal('env', { TRUSTED_PROXY_IP: undefined })
vi.stubGlobal('getRequestIP', () => '127.0.0.1')
vi.stubGlobal('setResponseHeaders', () => {})
vi.stubGlobal('setResponseHeader', () => {})
vi.stubGlobal('defineEventHandler', (handler: (...a: any[]) => any) => handler)
vi.stubGlobal('getValidatedRouterParams', async (_event: any, validator: (v: unknown) => unknown) => validator({ id: 'app-1' }))
vi.stubGlobal('createError', (opts: { statusCode: number, statusMessage?: string }) => {
  const err = new Error(opts.statusMessage ?? 'error') as Error & { statusCode: number, statusMessage?: string }
  err.statusCode = opts.statusCode
  err.statusMessage = opts.statusMessage
  return err
})

const recordActivityMock = vi.fn()
vi.stubGlobal('recordActivity', recordActivityMock)

let permissionDenied = false
const requirePermissionMock = vi.fn(async () => {
  if (permissionDenied) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
  }
  return {
    session: { activeOrganizationId: 'org-1' },
    user: { id: 'user-1', name: 'Alex Recruiter' },
  }
})
vi.stubGlobal('requirePermission', requirePermissionMock)

// ── In-memory "row" state shared across select-for-update + update calls ───
interface Row {
  status: 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
  screeningInvitationSentAt: Date | null
}

let row: Row | null = null
let findFirstResult: any = null
const updateSets: Record<string, unknown>[] = []
// When true, the *top-level* `db.update(...)` (used only for the post-send-failure
// rollback — the in-transaction claim update always uses `tx.update`) throws.
let topLevelUpdateShouldFail = false

function makeSelectChain() {
  return {
    from: () => ({
      where: () => ({
        for: async () => (row ? [{ status: row.status, screeningInvitationSentAt: row.screeningInvitationSentAt }] : []),
      }),
    }),
  }
}

function makeUpdateChain(options: { failOnWhere?: boolean } = {}) {
  return {
    set: (values: Record<string, unknown>) => ({
      where: async () => {
        if (options.failOnWhere) {
          throw new Error('connection reset')
        }
        updateSets.push(values)
        if (row) {
          if ('screeningInvitationSentAt' in values) row.screeningInvitationSentAt = values.screeningInvitationSentAt as Date | null
          if ('status' in values) row.status = values.status as Row['status']
        }
        return []
      },
    }),
  }
}

// Serializes concurrent `db.transaction()` calls one-at-a-time, simulating
// the row-level lock a real `SELECT ... FOR UPDATE` takes in Postgres: two
// concurrent requests against the same row can never interleave their
// read-decide-write steps, only run them back-to-back.
let txQueue: Promise<unknown> = Promise.resolve()

const dbMock = {
  query: {
    application: {
      findFirst: vi.fn(async () => findFirstResult),
    },
  },
  transaction: vi.fn((cb: (tx: any) => Promise<any>) => {
    const run = txQueue.then(() => cb({
      select: () => makeSelectChain(),
      update: () => makeUpdateChain(),
    }))
    txQueue = run.catch(() => undefined)
    return run
  }),
  update: vi.fn(() => makeUpdateChain({ failOnWhere: topLevelUpdateShouldFail })),
}
vi.stubGlobal('db', dbMock)

// ── Mock the plain util modules the route imports directly ─────────────────
// Typed with the real modules' exported function signatures (via `import
// type`, which pulls no runtime code) so the mock wrappers are checked
// against the actual call signature instead of an untyped `unknown[]` spread.
import type { getScreeningEmailTemplateForUser } from '../../server/utils/screeningEmailTemplate'
import type { sendScreeningInvitationEmail } from '../../server/utils/email'

const getScreeningEmailTemplateForUserMock = vi.fn<typeof getScreeningEmailTemplateForUser>(async () => ({
  subject: 'Next steps: {{jobTitle}} at {{organizationName}}',
  body: 'Hi {{candidateFirstName}}, from {{senderName}}.',
  isDefault: true,
}))
vi.mock('../../server/utils/screeningEmailTemplate', () => ({
  getScreeningEmailTemplateForUser: (...args: Parameters<typeof getScreeningEmailTemplateForUser>) =>
    getScreeningEmailTemplateForUserMock(...args),
}))

const sendScreeningInvitationEmailMock = vi.fn<typeof sendScreeningInvitationEmail>(async () => {})
vi.mock('../../server/utils/email', () => ({
  sendScreeningInvitationEmail: (...args: Parameters<typeof sendScreeningInvitationEmail>) =>
    sendScreeningInvitationEmailMock(...args),
}))

const { default: handler } = await import('../../server/api/applications/[id]/send-screening-invitation.post')

function makeEvent() {
  return {} as any
}

function makeApp(overrides: Partial<{
  status: Row['status']
  screeningInvitationSentAt: Date | null
  candidateEmail: string | null
  organizationId: string
}> = {}) {
  const status = overrides.status ?? 'new'
  const screeningInvitationSentAt = overrides.screeningInvitationSentAt ?? null
  row = { status, screeningInvitationSentAt }
  return {
    id: 'app-1',
    organizationId: overrides.organizationId ?? 'org-1',
    status,
    screeningInvitationSentAt,
    candidate: {
      firstName: 'Jane',
      lastName: 'Doe',
      email: overrides.candidateEmail === undefined ? 'jane@example.com' : overrides.candidateEmail,
    },
    job: { title: 'Senior Engineer' },
    organization: { name: 'Acme Corp' },
  }
}

beforeEach(() => {
  permissionDenied = false
  row = null
  findFirstResult = null
  updateSets.length = 0
  topLevelUpdateShouldFail = false
  recordActivityMock.mockClear()
  sendScreeningInvitationEmailMock.mockClear()
  sendScreeningInvitationEmailMock.mockResolvedValue(undefined)
  getScreeningEmailTemplateForUserMock.mockClear()
  logErrorMock.mockClear()
})

describe('POST /api/applications/:id/send-screening-invitation', () => {
  it('rejects with 403 when the caller lacks the application:update permission', async () => {
    permissionDenied = true
    findFirstResult = makeApp()

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 403 })
  })

  it('rejects with 404 when the application does not exist in the caller\'s org (cross-org isolation)', async () => {
    findFirstResult = null

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejects with 400 when the candidate has no email on file', async () => {
    findFirstResult = makeApp({ candidateEmail: '' })

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects with 400 when the candidate email is malformed', async () => {
    findFirstResult = makeApp({ candidateEmail: 'not-an-email' })

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('sends successfully and advances status from "new" to "screening"', async () => {
    findFirstResult = makeApp({ status: 'new' })

    const result = await handler(makeEvent())

    expect(result).toMatchObject({ sent: true, statusAdvanced: true })
    expect(row!.status).toBe('screening')
    expect(sendScreeningInvitationEmailMock).toHaveBeenCalledTimes(1)
    expect(recordActivityMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'status_changed' }))
  })

  it('does not change status when it is already "interview"', async () => {
    findFirstResult = makeApp({ status: 'interview' })

    const result = await handler(makeEvent())

    expect(result).toMatchObject({ sent: true, statusAdvanced: false })
    expect(row!.status).toBe('interview')
  })

  it('does not change status when it is "rejected"', async () => {
    findFirstResult = makeApp({ status: 'rejected' })

    const result = await handler(makeEvent())

    expect(result).toMatchObject({ sent: true, statusAdvanced: false })
    expect(row!.status).toBe('rejected')
  })

  it('rejects with 429 when resending inside the 2-minute cooldown', async () => {
    findFirstResult = makeApp({ status: 'screening', screeningInvitationSentAt: new Date(Date.now() - 30_000) })

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 429 })
    expect(sendScreeningInvitationEmailMock).not.toHaveBeenCalled()
  })

  it('allows a resend once the cooldown has elapsed', async () => {
    findFirstResult = makeApp({ status: 'screening', screeningInvitationSentAt: new Date(Date.now() - 3 * 60_000) })

    const result = await handler(makeEvent())

    expect(result).toMatchObject({ sent: true })
  })

  it('only claims once across two concurrent requests for the same application', async () => {
    findFirstResult = makeApp({ status: 'new' })

    const [first, second] = await Promise.allSettled([handler(makeEvent()), handler(makeEvent())])

    const results = [first, second]
    const fulfilled = results.filter(r => r.status === 'fulfilled')
    const rejected = results.filter(r => r.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ statusCode: 429 })
    expect(sendScreeningInvitationEmailMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to DEFAULT_SCREENING_TEMPLATE when the sender has no saved template', async () => {
    findFirstResult = makeApp({ status: 'new' })

    await handler(makeEvent())

    expect(getScreeningEmailTemplateForUserMock).toHaveBeenCalledWith('org-1', 'user-1')
  })

  it('rolls back the claim (sentAt and status) when the email send fails', async () => {
    findFirstResult = makeApp({ status: 'new' })
    sendScreeningInvitationEmailMock.mockRejectedValueOnce(new Error('smtp down'))

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 502 })

    expect(row!.status).toBe('new')
    expect(row!.screeningInvitationSentAt).toBeNull()
  })

  it('still surfaces the original 502 (not a rollback error) when the rollback UPDATE itself also fails', async () => {
    findFirstResult = makeApp({ status: 'new' })
    sendScreeningInvitationEmailMock.mockRejectedValueOnce(new Error('smtp down'))
    topLevelUpdateShouldFail = true

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 502 })

    // The rollback failure itself must be logged under its own error category
    // so it's distinguishable from the original send failure in monitoring —
    // the client still only ever sees the original 502.
    expect(logErrorMock).toHaveBeenCalledWith(
      'email.screening_invitation_rollback_failed',
      expect.objectContaining({ error_message: expect.stringContaining('connection reset') }),
    )
  })
})
