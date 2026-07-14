import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadApplicationContext } from '../../server/utils/loadApplicationContext'

afterEach(() => vi.unstubAllGlobals())

function baseApp(overrides: Partial<any> = {}) {
  return {
    id: 'app-1',
    organizationId: 'org-1',
    notes: null,
    coverLetterText: null,
    score: null,
    candidate: { id: 'cand-1', firstName: 'Ada', lastName: 'Lovelace' },
    job: { id: 'job-1', title: 'Engineer', description: 'Build things' },
    ...overrides,
  }
}

function stubDb(opts: {
  app: any | null
  docs?: any[]
  scores?: any[]
}) {
  const findFirst = vi.fn(async () => opts.app)
  // db.select(...).from(...).where(...) — the helper calls select() twice in a
  // fixed order: first for candidate documents, then for criterion scores.
  let selectCallCount = 0
  const select = vi.fn((_cols: any) => {
    const callIndex = selectCallCount++
    return {
      from: () => ({
        where: async () => (callIndex === 0 ? (opts.docs ?? []) : (opts.scores ?? [])),
      }),
    }
  })
  vi.stubGlobal('db', {
    query: { application: { findFirst } },
    select,
  })
  return { findFirst, select }
}

describe('loadApplicationContext', () => {
  beforeEach(() => {
    vi.stubGlobal('logInfo', vi.fn())
  })

  it('returns null when the application belongs to a different organization (IDOR guard)', async () => {
    stubDb({ app: null })
    const result = await loadApplicationContext('app-1', 'org-attacker')
    expect(result).toBeNull()
  })

  it('returns null when the application does not exist', async () => {
    stubDb({ app: null })
    const result = await loadApplicationContext('missing-app', 'org-1')
    expect(result).toBeNull()
  })

  it('returns resumeText null when no parsed document exists', async () => {
    stubDb({ app: baseApp(), docs: [] })
    const result = await loadApplicationContext('app-1', 'org-1')
    expect(result).not.toBeNull()
    expect(result!.resumeText).toBeNull()
    expect(result!.resumeDocumentId).toBeNull()
  })

  it('returns compositeScore null when no scores exist', async () => {
    stubDb({ app: baseApp({ score: null }), docs: [], scores: [] })
    const result = await loadApplicationContext('app-1', 'org-1')
    expect(result!.compositeScore).toBeNull()
    expect(result!.criterionScores).toEqual([])
  })

  it('assembles the full context on the happy path', async () => {
    const docs = [
      {
        id: 'doc-1',
        type: 'resume',
        parsedContent: { text: 'Experienced software engineer.' },
      },
    ]
    const scores = [
      {
        criterionKey: 'communication',
        maxScore: 10,
        applicantScore: 8,
        confidence: 90,
        evidence: 'Clear writing in cover letter.',
        strengths: ['clarity'],
        gaps: [],
      },
    ]
    stubDb({ app: baseApp({ score: 82 }), docs, scores })

    const result = await loadApplicationContext('app-1', 'org-1')

    expect(result).toEqual({
      applicationId: 'app-1',
      organizationId: 'org-1',
      jobId: 'job-1',
      jobTitle: 'Engineer',
      jobDescription: 'Build things',
      candidateId: 'cand-1',
      candidateFirstName: 'Ada',
      candidateLastName: 'Lovelace',
      notes: null,
      coverLetterText: null,
      resumeDocumentId: 'doc-1',
      resumeText: 'Experienced software engineer.',
      compositeScore: 82,
      criterionScores: scores,
    })
  })
})
