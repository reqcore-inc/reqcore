import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('candidate DSAR export includes transcripts + transcript analyses (TA1.3)', () => {
  it('requests screeningTranscripts (incl. rawText) and transcriptAnalyses via the applications relation, following the existing responses/interviews/criterionScores/analysisRuns enumeration style', () => {
    const source = read('server/api/candidates/[id]/export.get.ts')

    // Same `with` block that already enumerates responses / interviews /
    // criterionScores / analysisRuns / source for each application.
    const withBlock = source.slice(
      source.indexOf('applications: {'),
      source.indexOf('applications: {') + source.slice(source.indexOf('applications: {')).indexOf('},\n      },'),
    )

    expect(withBlock).toMatch(/screeningTranscripts:\s*true/)
    expect(withBlock).toMatch(/transcriptAnalyses:\s*true/)
  })

  it('does not select a narrowed column set that would drop rawText from screening_transcript', () => {
    const source = read('server/api/candidates/[id]/export.get.ts')

    // `screeningTranscripts: true` (relational "select everything" form) is
    // required — a `columns: {...}` projection could silently omit rawText,
    // which is the DSAR-relevant paste-transcript content.
    expect(source).toMatch(/screeningTranscripts:\s*true,?\s*$/m)
  })
})
