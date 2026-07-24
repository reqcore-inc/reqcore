import { describe, it, expect } from 'vitest'
import {
  DEFAULT_STAGES,
  STAGE_CATEGORIES,
  STAGE_CATEGORY_META,
  STAGE_COLORS,
  STAGE_COLOR_TOKENS,
  DEFAULT_STAGE_COLOR,
  stageColorClasses,
} from '~~/shared/pipeline'

describe('default pipeline template', () => {
  it('reproduces the six legacy stages in order', () => {
    expect(DEFAULT_STAGES.map(s => s.name)).toEqual([
      'New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected',
    ])
  })

  it('has exactly one entry stage, and it is the applied one', () => {
    const entries = DEFAULT_STAGES.filter(s => s.isEntry)
    expect(entries).toHaveLength(1)
    expect(entries[0]!.name).toBe('New')
    expect(entries[0]!.category).toBe('applied')
  })

  it('assigns the terminal roles so hire/rejection reporting works out of the box', () => {
    expect(DEFAULT_STAGES.find(s => s.category === 'hired')?.name).toBe('Hired')
    expect(DEFAULT_STAGES.find(s => s.category === 'rejected')?.name).toBe('Rejected')
  })

  it('only uses colour tokens that exist in the palette', () => {
    for (const stage of DEFAULT_STAGES) {
      expect(STAGE_COLOR_TOKENS).toContain(stage.color)
    }
  })

  // The migration backfills applications by matching lower(stage.name) against
  // the old enum slug, so this 1:1 mapping must hold.
  it('names map 1:1 to the legacy status slugs (migration backfill contract)', () => {
    expect(DEFAULT_STAGES.map(s => s.name.toLowerCase())).toEqual([
      'new', 'screening', 'interview', 'offer', 'hired', 'rejected',
    ])
  })
})

describe('stage categories', () => {
  it('describes every category', () => {
    for (const category of STAGE_CATEGORIES) {
      expect(STAGE_CATEGORY_META[category].label).toBeTruthy()
    }
  })

  it('marks hired and rejected as terminal, applied and in_progress as not', () => {
    expect(STAGE_CATEGORY_META.hired.terminal).toBe(true)
    expect(STAGE_CATEGORY_META.rejected.terminal).toBe(true)
    expect(STAGE_CATEGORY_META.applied.terminal).toBe(false)
    expect(STAGE_CATEGORY_META.in_progress.terminal).toBe(false)
  })
})

describe('stageColorClasses', () => {
  it('resolves a known token to its badge and dot classes', () => {
    expect(stageColorClasses('violet')).toEqual(STAGE_COLORS.violet)
  })

  it('falls back for unknown, null or undefined colours', () => {
    const fallback = STAGE_COLORS[DEFAULT_STAGE_COLOR]
    expect(stageColorClasses('chartreuse')).toEqual(fallback)
    expect(stageColorClasses(null)).toEqual(fallback)
    expect(stageColorClasses(undefined)).toEqual(fallback)
  })

  it('gives every palette token both a badge and a dot class', () => {
    for (const token of STAGE_COLOR_TOKENS) {
      expect(STAGE_COLORS[token].badge).toBeTruthy()
      expect(STAGE_COLORS[token].dot).toBeTruthy()
    }
  })
})
