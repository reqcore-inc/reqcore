import { getTableColumns } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import {
  analysisRun,
  documentTypeEnum,
  transcriptAnalysis,
  transcriptAnalysisRecommendationEnum,
} from '../../server/database/schema/app'

describe('transcript analysis schema', () => {
  it('documentTypeEnum includes transcript', () => {
    expect(documentTypeEnum.enumValues).toContain('transcript')
  })

  it('analysisRun.kind defaults to application_scoring', () => {
    const columns = getTableColumns(analysisRun)
    expect(columns.kind).toBeDefined()
    expect(columns.kind.notNull).toBe(true)
    expect(columns.kind.default).toBe('application_scoring')
  })

  it('transcriptAnalysis has no rawResponse column', () => {
    const columns = getTableColumns(transcriptAnalysis)
    expect(columns.rawResponse).toBeUndefined()
  })

  it('recommendation enum has exactly the 4 spec values', () => {
    expect(transcriptAnalysisRecommendationEnum.enumValues).toEqual([
      'advance',
      'hold',
      'do_not_advance',
      'insufficient_evidence',
    ])
  })

  it('answerBreakdown column is nullable', () => {
    const columns = getTableColumns(transcriptAnalysis)
    expect(columns.answerBreakdown.notNull).toBe(false)
  })

  it('sectionScores and extractionMode columns are notNull', () => {
    const columns = getTableColumns(transcriptAnalysis)
    expect(columns.sectionScores.notNull).toBe(true)
    expect(columns.extractionMode.notNull).toBe(true)
  })
})
