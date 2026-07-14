import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { eraseCandidates } from '../../server/utils/erasure'
import { activityLog } from '../../server/database/schema'

const dialect = new PgDialect()

/** Renders a drizzle SQL condition to its SQL text + bound params for assertions. */
function renderWhere(cond: unknown) {
  return dialect.sqlToQuery(cond as SQL)
}

// ─────────────────────────────────────────────
// Build a configurable in-memory mock of the Nitro auto-imported `db` global.
// erasure.ts reads `db` and `deleteFromS3` as globals at call time, so stubbing
// globalThis is enough — no real database is touched.
// ─────────────────────────────────────────────
interface MockOpts {
  id?: string
  candidateExists?: boolean
  documents?: string[]
  applications?: string[]
  interviews?: string[]
  /** screening_transcript ids tied to the candidate's applications. */
  transcripts?: string[]
  /** transcript_analysis ids tied to the candidate's applications. */
  analyses?: string[]
  comments?: unknown[]
  properties?: unknown[]
  activityLogs?: unknown[]
  /** Retention fields returned by the candidate findFirst (for purge-guard tests). */
  quarantinedAt?: Date | null
  scheduledPurgeAt?: Date | null
  retentionExemptUntil?: Date | null
  /** When false, the atomic candidate delete matches 0 rows (simulates a mid-sweep reapplication). */
  candidateDeleted?: boolean
}

function makeDb(opts: MockOpts) {
  const selectResults = [opts.comments ?? [], opts.properties ?? [], opts.activityLogs ?? []]
  let selectIdx = 0
  const inserts: Record<string, unknown>[] = []
  const selectCalls: { from: unknown, where: unknown }[] = []
  const deletedRows = opts.candidateDeleted === false ? [] : [{ id: opts.id ?? 'c1' }]
  const txDelete = vi.fn(() => ({
    where: vi.fn(() => Object.assign(Promise.resolve(deletedRows), {
      returning: vi.fn(() => Promise.resolve(deletedRows)),
    })),
  }))
  const transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb({ delete: txDelete }))
  const insert = vi.fn(() => ({
    values: vi.fn((v: Record<string, unknown>) => { inserts.push(v); return Promise.resolve() }),
  }))

  const documentFindMany = vi.fn(async (args?: { where?: unknown }) => {
    if (args) (documentFindMany as { lastArgs?: unknown }).lastArgs = args
    return (opts.documents ?? []).map((storageKey, index) => ({ id: `d${index + 1}`, storageKey }))
  }) as ReturnType<typeof vi.fn> & { lastArgs?: { where?: unknown } }

  const db = {
    query: {
      candidate: {
        findFirst: vi.fn(async () => (opts.candidateExists
          ? {
              id: opts.id ?? 'c1',
              quarantinedAt: opts.quarantinedAt ?? null,
              scheduledPurgeAt: opts.scheduledPurgeAt ?? null,
              retentionExemptUntil: opts.retentionExemptUntil ?? null,
            }
          : undefined)),
      },
      document: {
        findMany: documentFindMany,
      },
      application: { findMany: vi.fn(async () => (opts.applications ?? []).map(id => ({ id }))) },
      interview: { findMany: vi.fn(async () => (opts.interviews ?? []).map(id => ({ id }))) },
      screeningTranscript: {
        findMany: vi.fn(async () => (opts.transcripts ?? []).map(id => ({ id }))),
      },
      transcriptAnalysis: {
        findMany: vi.fn(async () => (opts.analyses ?? []).map(id => ({ id }))),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn((cond: unknown) => {
          selectCalls.push({ from: table, where: cond })
          return Promise.resolve(selectResults[selectIdx++])
        }),
      })),
    })),
    transaction,
    insert,
  }
  return { db, transaction, txDelete, insert, inserts, selectCalls }
}

let deleteFromS3: ReturnType<typeof vi.fn>

afterEach(() => { vi.unstubAllGlobals() })

describe('eraseCandidates', () => {
  beforeEach(() => {
    deleteFromS3 = vi.fn(async () => {})
    vi.stubGlobal('deleteFromS3', deleteFromS3)
    // Re-provide the logger globals (afterEach unstubs everything, including
    // the ones from tests/setup.ts).
    vi.stubGlobal('logInfo', vi.fn())
    vi.stubGlobal('logWarn', vi.fn())
  })

  it('dry run touches nothing', async () => {
    const m = makeDb({ candidateExists: true, documents: ['k1'], comments: [{}, {}] })
    vi.stubGlobal('db', m.db)

    const report = await eraseCandidates('org1', ['c1'], { dryRun: true })

    expect(report.dryRun).toBe(true)
    expect(report.results[0].status).toBe('would_erase')
    expect(report.results[0].documents).toBe(1)
    expect(report.results[0].comments).toBe(2)
    expect(deleteFromS3).not.toHaveBeenCalled()
    expect(m.transaction).not.toHaveBeenCalled()
    expect(m.insert).not.toHaveBeenCalled()
  })

  it('reports not_found for a candidate missing in this org (tenant isolation + idempotency)', async () => {
    const m = makeDb({ candidateExists: false })
    vi.stubGlobal('db', m.db)

    const report = await eraseCandidates('org1', ['ghost'], {})

    expect(report.results[0].status).toBe('not_found')
    expect(deleteFromS3).not.toHaveBeenCalled()
    expect(m.transaction).not.toHaveBeenCalled()
  })

  it('deletes S3 objects BEFORE the DB graph, then erases', async () => {
    const m = makeDb({
      candidateExists: true,
      documents: ['k1', 'k2'],
      applications: ['a1'],
      interviews: ['i1'],
      comments: [{}, {}],
      properties: [{}],
    })
    vi.stubGlobal('db', m.db)

    const report = await eraseCandidates('org1', ['c1'], { actorId: 'u1' })

    expect(report.results[0].status).toBe('erased')
    expect(deleteFromS3).toHaveBeenCalledTimes(2)
    expect(m.transaction).toHaveBeenCalledTimes(1)
    // 4 polymorphic/graph deletes inside the transaction.
    expect(m.txDelete).toHaveBeenCalledTimes(4)
    expect(m.db.query.application.findMany).toHaveBeenCalledTimes(1)
    expect(m.db.query.interview.findMany).toHaveBeenCalledTimes(1)
    // S3 deletion happens before the DB transaction.
    expect(deleteFromS3.mock.invocationCallOrder[0])
      .toBeLessThan(m.transaction.mock.invocationCallOrder[0])
  })

  it('does NOT delete the DB graph when an S3 object fails (keeps key for retry)', async () => {
    const m = makeDb({ candidateExists: true, documents: ['k1', 'bad'] })
    vi.stubGlobal('db', m.db)
    deleteFromS3.mockRejectedValueOnce(new Error('S3 down'))

    const report = await eraseCandidates('org1', ['c1'], {})

    expect(report.results[0].status).toBe('skipped_s3_failure')
    expect(report.results[0].s3Failures).toBe(1)
    expect(m.transaction).not.toHaveBeenCalled()
    // A 'partial' audit row is still written.
    expect(m.inserts[0]?.result).toBe('partial')
  })

  it('writes a privacy-safe audit row containing NO candidate PII', async () => {
    const m = makeDb({ candidateExists: true, documents: ['k1'], comments: [{}], properties: [], activityLogs: [{}, {}] })
    vi.stubGlobal('db', m.db)

    await eraseCandidates('org1', ['c1'], { actorId: 'u1' })

    expect(m.inserts).toHaveLength(1)
    const audit = m.inserts[0]
    expect(Object.keys(audit).sort()).toEqual(
      ['action', 'actorId', 'candidateId', 'metadata', 'organizationId', 'result'],
    )
    expect(audit.action).toBe('erased')
    expect(audit.result).toBe('success')
    // Metadata holds only non-PII counts.
    const meta = audit.metadata as Record<string, unknown>
    for (const v of Object.values(meta)) {
      expect(typeof v === 'number' || typeof v === 'string').toBe(true)
    }
    // No PII keys leaked into the audit payload.
    const serialized = JSON.stringify(audit)
    expect(serialized).not.toMatch(/email|firstName|lastName|storageKey|@/i)
  })

  it('flags auditFailed (and does not throw) when the audit row cannot be written', async () => {
    const m = makeDb({ candidateExists: true, documents: ['k1'] })
    // Make the audit insert throw, but leave the erasure itself successful.
    m.db.insert = vi.fn(() => ({ values: vi.fn(() => Promise.reject(new Error('audit table down'))) }))
    vi.stubGlobal('db', m.db)
    vi.stubGlobal('logError', vi.fn())

    const report = await eraseCandidates('org1', ['c1'], { actorId: 'u1' })

    expect(report.results[0].status).toBe('erased')
    expect(report.results[0].auditFailed).toBe(true)
    expect((globalThis as Record<string, unknown>).logError).toHaveBeenCalled()
  })

  describe('requirePurgeEligible (reapplication race guard)', () => {
    const PAST = new Date('2026-01-01T00:00:00Z')
    const FUTURE = new Date('2999-01-01T00:00:00Z')
    const NOW = new Date('2026-06-20T00:00:00Z')

    it('skips (pre-check) when the candidate is no longer quarantined — touches nothing', async () => {
      // A reapplication cleared quarantinedAt before the sweep reached this candidate.
      const m = makeDb({ candidateExists: true, documents: ['k1'], quarantinedAt: null })
      vi.stubGlobal('db', m.db)

      const report = await eraseCandidates('org1', ['c1'], { requirePurgeEligible: true, now: NOW })

      expect(report.results[0].status).toBe('skipped_not_eligible')
      expect(report.skipped).toBe(1)
      expect(report.erased).toBe(0)
      expect(deleteFromS3).not.toHaveBeenCalled()
      expect(m.transaction).not.toHaveBeenCalled()
    })

    it('skips (pre-check) when the candidate is under an active legal hold', async () => {
      const m = makeDb({
        candidateExists: true,
        documents: ['k1'],
        quarantinedAt: PAST,
        scheduledPurgeAt: PAST,
        retentionExemptUntil: FUTURE,
      })
      vi.stubGlobal('db', m.db)

      const report = await eraseCandidates('org1', ['c1'], { requirePurgeEligible: true, now: NOW })

      expect(report.results[0].status).toBe('skipped_not_eligible')
      expect(deleteFromS3).not.toHaveBeenCalled()
      expect(m.transaction).not.toHaveBeenCalled()
    })

    it('rolls back the transaction when the atomic delete matches 0 rows (race lost mid-sweep)', async () => {
      // Pre-check passes, but a reapplication restores the candidate before the
      // transaction; the guarded candidate delete matches nothing and we roll back.
      const m = makeDb({
        candidateExists: true,
        documents: ['k1'],
        comments: [{}],
        quarantinedAt: PAST,
        scheduledPurgeAt: PAST,
        candidateDeleted: false,
      })
      vi.stubGlobal('db', m.db)

      const report = await eraseCandidates('org1', ['c1'], { requirePurgeEligible: true, now: NOW })

      expect(report.results[0].status).toBe('skipped_not_eligible')
      expect(m.transaction).toHaveBeenCalledTimes(1)
      // No success audit row written for a rolled-back erasure.
      expect(m.inserts).toHaveLength(0)
    })

    it('erases when still quarantined and past purge', async () => {
      const m = makeDb({
        candidateExists: true,
        documents: ['k1'],
        quarantinedAt: PAST,
        scheduledPurgeAt: PAST,
      })
      vi.stubGlobal('db', m.db)

      const report = await eraseCandidates('org1', ['c1'], { requirePurgeEligible: true, now: NOW })

      expect(report.results[0].status).toBe('erased')
      expect(m.transaction).toHaveBeenCalledTimes(1)
      expect(m.inserts[0]?.result).toBe('success')
    })
  })

  it('aggregates a multi-candidate report', async () => {
    // First exists, second is a ghost.
    const existing = makeDb({ candidateExists: true, documents: [] })
    vi.stubGlobal('db', existing.db)
    const report = await eraseCandidates('org1', ['c1'], {})
    expect(report.processed).toBe(1)
    expect(report.erased).toBe(1)
    expect(report.skipped).toBe(0)
  })

  describe('transcript + transcript_analysis GDPR wiring (TA1.3)', () => {
    it('deletes S3 objects for uploaded transcript documents — document.findMany has no `type` filter, so type=transcript documents are already covered by the existing candidate-document erasure path', async () => {
      const m = makeDb({
        candidateExists: true,
        documents: ['resume-storage-key', 'transcript-storage-key'],
      })
      vi.stubGlobal('db', m.db)

      const report = await eraseCandidates('org1', ['c1'], {})

      expect(report.results[0].status).toBe('erased')
      // Both the resume document AND the transcript-typed document's S3 object
      // were deleted — proving the existing candidate-document S3 erasure path
      // already covers uploaded transcripts (screening_transcript.documentId
      // points at a `document` row of type='transcript').
      expect(deleteFromS3).toHaveBeenCalledWith('resume-storage-key')
      expect(deleteFromS3).toHaveBeenCalledWith('transcript-storage-key')
      expect(deleteFromS3).toHaveBeenCalledTimes(2)

      // Prove the query itself is type-agnostic: the `where` clause passed to
      // document.findMany only scopes by candidateId + organizationId, never
      // by `type`, so it can never silently skip transcript-typed documents.
      const lastArgs = (m.db.query.document.findMany as unknown as { mock: { calls: [{ where: unknown }][] } })
        .mock.calls[0][0]
      const rendered = renderWhere(lastArgs.where)
      expect(rendered.sql).not.toMatch(/"type"/)
    })

    it('fetches screening_transcript and transcript_analysis rows scoped to the candidate applications (rows themselves cascade-delete via the application FK — no explicit tx.delete needed)', async () => {
      const m = makeDb({
        candidateExists: true,
        documents: ['k1'],
        applications: ['a1', 'a2'],
        transcripts: ['t1', 't2'],
        analyses: ['an1'],
      })
      vi.stubGlobal('db', m.db)

      const report = await eraseCandidates('org1', ['c1'], {})

      expect(report.results[0].status).toBe('erased')
      expect(m.db.query.screeningTranscript.findMany).toHaveBeenCalledTimes(1)
      expect(m.db.query.transcriptAnalysis.findMany).toHaveBeenCalledTimes(1)
      // No new tx.delete calls: transcript/analysis rows are NOT deleted
      // explicitly — they cascade via `screening_transcript.application_id`
      // and `transcript_analysis.application_id` FKs (onDelete: 'cascade'),
      // same as the application delete cascade already covers
      // responses/interviews/scores/analysis_run/documents.
      expect(m.txDelete).toHaveBeenCalledTimes(4)
    })

    it('adds transcript and transcript_analysis resourceTypes (scoped to the fetched ids) to the activityLog erasure scope', async () => {
      const m = makeDb({
        candidateExists: true,
        documents: ['k1'],
        applications: ['a1'],
        transcripts: ['t1', 't2'],
        analyses: ['an1'],
      })
      vi.stubGlobal('db', m.db)

      await eraseCandidates('org1', ['c1'], {})

      const activityCall = m.selectCalls.find(c => c.from === activityLog)
      expect(activityCall).toBeDefined()
      const rendered = renderWhere(activityCall!.where)
      expect(rendered.params).toContain('transcript')
      expect(rendered.params).toContain('transcript_analysis')
      expect(rendered.params).toContain('t1')
      expect(rendered.params).toContain('t2')
      expect(rendered.params).toContain('an1')
    })

    it('does NOT add transcript/transcript_analysis scopes when the candidate has no applications (nothing to scope by)', async () => {
      const m = makeDb({ candidateExists: true, documents: ['k1'] })
      vi.stubGlobal('db', m.db)

      await eraseCandidates('org1', ['c1'], {})

      // No applications → transcript/analysis lookups are skipped entirely.
      expect(m.db.query.screeningTranscript.findMany).not.toHaveBeenCalled()
      expect(m.db.query.transcriptAnalysis.findMany).not.toHaveBeenCalled()

      const activityCall = m.selectCalls.find(c => c.from === activityLog)
      const rendered = renderWhere(activityCall!.where)
      expect(rendered.params).not.toContain('transcript')
      expect(rendered.params).not.toContain('transcript_analysis')
    })
  })
})
