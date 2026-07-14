import { describe, it, expect } from 'vitest'
import {
  screeningScenarioConfigSchema,
  screeningScenarioResponseSchema,
  buildScreeningPrompt,
  type ScreeningScenarioInput,
} from '../../server/utils/ai/screeningScenario'

/**
 * Prompt-builder + schema coverage for AI-generated screening scenarios
 * (recruiter interview scripts). Mirrors the style of ai-config-schema.test.ts.
 * No live AI/network calls — everything here is pure function / schema testing.
 */

const baseInput: ScreeningScenarioInput = {
  jobTitle: 'Senior Backend Engineer',
  jobDescription: 'Build and scale our Node.js APIs.',
  candidateName: 'Jane Doe',
  resumeText: 'Jane has 6 years of experience with Node.js and PostgreSQL.',
  compositeScore: 82,
  criterionScores: [
    { name: 'Technical Skills', applicantScore: 8, maxScore: 10, reasoning: 'Strong Node.js background.' },
  ],
}

describe('screeningScenarioConfigSchema', () => {
  it('accepts a valid config', () => {
    const result = screeningScenarioConfigSchema.safeParse({ questionCount: 8, tone: 'balanced' })
    expect(result.success).toBe(true)
  })

  it('rejects questionCount below 5', () => {
    const result = screeningScenarioConfigSchema.safeParse({ questionCount: 4, tone: 'balanced' })
    expect(result.success).toBe(false)
  })

  it('rejects questionCount above 15', () => {
    const result = screeningScenarioConfigSchema.safeParse({ questionCount: 16, tone: 'balanced' })
    expect(result.success).toBe(false)
  })

  it('rejects a non-integer questionCount', () => {
    const result = screeningScenarioConfigSchema.safeParse({ questionCount: 8.5, tone: 'balanced' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid tone', () => {
    const result = screeningScenarioConfigSchema.safeParse({ questionCount: 8, tone: 'sarcastic' })
    expect(result.success).toBe(false)
  })

  it('accepts all three tone values', () => {
    for (const tone of ['technical', 'balanced', 'casual']) {
      const result = screeningScenarioConfigSchema.safeParse({ questionCount: 5, tone })
      expect(result.success).toBe(true)
    }
  })
})

describe('screeningScenarioResponseSchema', () => {
  it('accepts a valid payload', () => {
    const result = screeningScenarioResponseSchema.safeParse({
      questions: [
        { category: 'Technical Depth', question: 'Tell me about a scaling challenge you solved.', rationale: 'Probes production experience mentioned in resume.' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty questions array', () => {
    const result = screeningScenarioResponseSchema.safeParse({ questions: [] })
    expect(result.success).toBe(false)
  })

  it('rejects a question with an empty category', () => {
    const result = screeningScenarioResponseSchema.safeParse({
      questions: [{ category: '', question: 'Q?', rationale: 'R.' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a question with an empty question field', () => {
    const result = screeningScenarioResponseSchema.safeParse({
      questions: [{ category: 'Technical', question: '', rationale: 'R.' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a question with an empty rationale', () => {
    const result = screeningScenarioResponseSchema.safeParse({
      questions: [{ category: 'Technical', question: 'Q?', rationale: '' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a question missing a required field', () => {
    const result = screeningScenarioResponseSchema.safeParse({
      questions: [{ category: 'Technical', question: 'Q?' }],
    })
    expect(result.success).toBe(false)
  })
})

describe('buildScreeningPrompt', () => {
  it('includes the exact question count and tone instruction in the system prompt', () => {
    const { system } = buildScreeningPrompt({ questionCount: 9, tone: 'technical' }, baseInput)
    expect(system).toContain('9')
    expect(system.toLowerCase()).toContain('technical')
  })

  it('produces clearly different tone instructions for technical vs casual vs balanced', () => {
    const technical = buildScreeningPrompt({ questionCount: 6, tone: 'technical' }, baseInput).system
    const casual = buildScreeningPrompt({ questionCount: 6, tone: 'casual' }, baseInput).system
    const balanced = buildScreeningPrompt({ questionCount: 6, tone: 'balanced' }, baseInput).system

    expect(technical).not.toBe(casual)
    expect(technical).not.toBe(balanced)
    expect(casual).not.toBe(balanced)

    expect(technical.toLowerCase()).toMatch(/architecture|skills|depth|probing/)
    expect(casual.toLowerCase()).toMatch(/rapport|motivation|culture/)
    expect(balanced.toLowerCase()).toMatch(/mix|balance/)
  })

  it('instructs that every question must include a rationale referencing the candidate background', () => {
    const { system } = buildScreeningPrompt({ questionCount: 6, tone: 'balanced' }, baseInput)
    expect(system.toLowerCase()).toContain('rationale')
  })

  it('includes untrusted-data framing that instructs to ignore embedded instructions', () => {
    const { system } = buildScreeningPrompt({ questionCount: 6, tone: 'balanced' }, baseInput)
    const lower = system.toLowerCase()
    expect(lower).toMatch(/data,? not instructions|not instructions to follow/)
    expect(lower).toContain('ignore')
  })

  it('assembles job description, candidate name, and resume text in the user prompt', () => {
    const { user } = buildScreeningPrompt({ questionCount: 6, tone: 'balanced' }, baseInput)
    expect(user).toContain(baseInput.jobTitle)
    expect(user).toContain(baseInput.jobDescription)
    expect(user).toContain(baseInput.candidateName)
    expect(user).toContain(baseInput.resumeText)
  })

  it('renders a "no resume available" note when resumeText is null', () => {
    const input: ScreeningScenarioInput = { ...baseInput, resumeText: null }
    const { user } = buildScreeningPrompt({ questionCount: 6, tone: 'balanced' }, input)
    expect(user.toLowerCase()).toContain('no resume available')
  })

  it('includes score context when compositeScore and criterionScores are present', () => {
    const { user } = buildScreeningPrompt({ questionCount: 6, tone: 'balanced' }, baseInput)
    expect(user).toContain('82')
    expect(user).toContain('Technical Skills')
  })

  it('omits score context gracefully when compositeScore and criterionScores are null', () => {
    const input: ScreeningScenarioInput = { ...baseInput, compositeScore: null, criterionScores: null }
    const { user } = buildScreeningPrompt({ questionCount: 6, tone: 'balanced' }, input)
    expect(user).not.toContain('82')
    expect(user.toLowerCase()).not.toContain('undefined')
    expect(user.toLowerCase()).not.toContain('null')
  })
})
