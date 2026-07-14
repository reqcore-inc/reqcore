import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

const FIXTURES_DIR = fileURLToPath(new URL('./fixtures/transcripts/', import.meta.url))

function readFixture(name: string): string {
  return readFileSync(`${FIXTURES_DIR}${name}`, 'utf-8')
}

const generateStructuredOutputMock = vi.hoisted(() => vi.fn())

vi.mock('../../server/utils/ai/provider', () => ({
  generateStructuredOutput: generateStructuredOutputMock,
}))

import {
  analyzeTranscript,
  detectTurnStructure,
  TRANSCRIPT_CHAR_CAP,
  truncateTranscript,
} from '../../server/utils/ai/transcriptAnalysis'

const FAKE_CONFIG = {
  provider: 'openai' as const,
  model: 'gpt-4.1-mini',
  apiKeyEncrypted: 'encrypted',
  maxTokens: 4000,
}

const BASE_INPUT = {
  jobTitle: 'Backend Engineer',
  jobDescription: 'We need someone to own the billing pipeline.',
  criteria: [
    {
      key: 'technical_skills',
      name: 'Technical Skills',
      description: 'Evaluate technical competency',
      category: 'technical',
      maxScore: 10,
      weight: 50,
    },
  ],
  resumeText: 'Experienced backend engineer.',
  candidateProperties: null,
  scenario: null,
  transcriptText: '',
}

function mockLlmResponse(overrides: Record<string, unknown> = {}) {
  return {
    object: {
      answerBreakdown: [
        {
          question: 'Tell me about your current role.',
          answer: 'I own the reconciliation service.',
          evidence: 'I own the reconciliation service that matches Stripe events to internal invoices.',
          score: 8,
          confidence: 80,
          strengths: ['Clear ownership'],
          gaps: [],
        },
      ],
      sectionScores: [
        {
          section: 'Technical Skills',
          score: 8,
          maxScore: 10,
          evidence: 'Owns reconciliation service migration.',
          summary: 'Strong technical depth.',
        },
      ],
      pairingConfidence: 85,
      recommendation: 'advance',
      confidence: 75,
      rationale: 'Strong evidence of relevant experience.',
      ...overrides,
    },
    usage: { promptTokens: 100, completionTokens: 50 },
  }
}

afterEach(() => {
  generateStructuredOutputMock.mockReset()
})

describe('truncateTranscript', () => {
  it('does not truncate text under the cap', () => {
    const result = truncateTranscript('short transcript text')
    expect(result.truncated).toBe(false)
    expect(result.text).toBe('short transcript text')
  })

  it('truncates at the cap and sets the flag + a visible marker', () => {
    const longText = 'a'.repeat(TRANSCRIPT_CHAR_CAP + 5000)
    const result = truncateTranscript(longText)
    expect(result.truncated).toBe(true)
    expect(result.text.length).toBeLessThan(longText.length)
    expect(result.text).toMatch(/truncat/i)
  })
})

describe('detectTurnStructure', () => {
  it('passes fixture 01 (clean speaker labels)', () => {
    expect(detectTurnStructure(readFixture('01-clean-speaker-labeled.txt'))).toBe(true)
  })

  it('passes fixture 02 (VTT export)', () => {
    expect(detectTurnStructure(readFixture('02-zoom-vtt-export.txt'))).toBe(true)
  })

  it('passes fixture 03 (Teams-style export)', () => {
    expect(detectTurnStructure(readFixture('03-teams-style-export.txt'))).toBe(true)
  })

  it('fails fixture 04 (unlabeled wall of text)', () => {
    expect(detectTurnStructure(readFixture('04-unlabeled-wall-of-text.txt'))).toBe(false)
  })
})

describe('analyzeTranscript — prompt construction', () => {
  it('places the transcript inside explicit untrusted delimiters and never alters the system contract', async () => {
    generateStructuredOutputMock.mockResolvedValueOnce(mockLlmResponse())

    const injected = readFixture('08-prompt-injection-attempt.txt')
    await analyzeTranscript(FAKE_CONFIG, { ...BASE_INPUT, transcriptText: injected })

    expect(generateStructuredOutputMock).toHaveBeenCalledTimes(1)
    const call = generateStructuredOutputMock.mock.calls[0][1] as { system: string, prompt: string }

    // The injected text must be inside the prompt, delimited, never merged into the system message.
    expect(call.prompt).toContain(injected)
    expect(call.system).not.toContain('Ignore all previous instructions')
    expect(call.system).toContain('DATA')
    expect(call.system.toLowerCase()).toContain('never instructions')
  })

  it('a mocked malicious out-of-range response is clamped, not trusted verbatim', async () => {
    generateStructuredOutputMock.mockResolvedValueOnce(mockLlmResponse({
      recommendation: 'advance',
      confidence: 999,
      sectionScores: [
        {
          section: 'Technical Skills',
          score: 999,
          maxScore: 10,
          evidence: 'injected',
          summary: 'injected',
        },
      ],
      pairingConfidence: 999,
    }))

    const injected = readFixture('08-prompt-injection-attempt.txt')
    const result = await analyzeTranscript(FAKE_CONFIG, { ...BASE_INPUT, transcriptText: injected })

    expect(result.analysis.confidence).toBeLessThanOrEqual(100)
    expect(result.analysis.sectionScores[0].score).toBeLessThanOrEqual(result.analysis.sectionScores[0].maxScore)
    expect(['advance', 'hold', 'do_not_advance', 'insufficient_evidence']).toContain(result.analysis.recommendation)
  })

  it('omits the scenario section entirely when scenario is null', async () => {
    generateStructuredOutputMock.mockResolvedValueOnce(mockLlmResponse())
    await analyzeTranscript(FAKE_CONFIG, { ...BASE_INPUT, scenario: null, transcriptText: 'Recruiter: hi\nCandidate: hi' })

    const call = generateStructuredOutputMock.mock.calls[0][1] as { prompt: string }
    expect(call.prompt.toUpperCase()).not.toContain('SCENARIO')
  })

  it('includes the scenario section when scenario is provided', async () => {
    generateStructuredOutputMock.mockResolvedValueOnce(mockLlmResponse())
    await analyzeTranscript(FAKE_CONFIG, {
      ...BASE_INPUT,
      scenario: 'This screening covers system design and collaboration.',
      transcriptText: 'Recruiter: hi\nCandidate: hi',
    })

    const call = generateStructuredOutputMock.mock.calls[0][1] as { prompt: string }
    expect(call.prompt).toContain('This screening covers system design and collaboration.')
    expect(call.prompt.toUpperCase()).toContain('SCENARIO')
  })
})

describe('analyzeTranscript — server-side clamping', () => {
  it('clamps out-of-range scores (e.g. 999, -5) into valid bounds', async () => {
    generateStructuredOutputMock.mockResolvedValueOnce(mockLlmResponse({
      sectionScores: [
        { section: 'Technical Skills', score: 999, maxScore: 10, evidence: 'e', summary: 's' },
        { section: 'Culture Fit', score: -5, maxScore: 10, evidence: 'e', summary: 's' },
      ],
      confidence: -5,
    }))

    const result = await analyzeTranscript(FAKE_CONFIG, { ...BASE_INPUT, transcriptText: 'Recruiter: hi\nCandidate: hi' })

    expect(result.analysis.sectionScores[0].score).toBeLessThanOrEqual(10)
    expect(result.analysis.sectionScores[0].score).toBeGreaterThanOrEqual(0)
    expect(result.analysis.sectionScores[1].score).toBeGreaterThanOrEqual(0)
    expect(result.analysis.confidence).toBeGreaterThanOrEqual(0)
  })
})

describe('analyzeTranscript — server-computed extractionMode', () => {
  it('forces section_level when the structural heuristic fails, even with pairingConfidence=95', async () => {
    generateStructuredOutputMock.mockResolvedValueOnce(mockLlmResponse({ pairingConfidence: 95 }))

    const unlabeled = readFixture('04-unlabeled-wall-of-text.txt')
    const result = await analyzeTranscript(FAKE_CONFIG, { ...BASE_INPUT, transcriptText: unlabeled })

    expect(result.analysis.extractionMode).toBe('section_level')
    expect(result.analysis.answerBreakdown).toBeNull()
  })

  it('uses section_level and nulls answerBreakdown when pairingConfidence is 40 even though structure passes', async () => {
    generateStructuredOutputMock.mockResolvedValueOnce(mockLlmResponse({ pairingConfidence: 40 }))

    const labeled = readFixture('01-clean-speaker-labeled.txt')
    const result = await analyzeTranscript(FAKE_CONFIG, { ...BASE_INPUT, transcriptText: labeled })

    expect(result.analysis.extractionMode).toBe('section_level')
    expect(result.analysis.answerBreakdown).toBeNull()
  })

  it('uses per_answer when structure passes and pairingConfidence >= 60', async () => {
    generateStructuredOutputMock.mockResolvedValueOnce(mockLlmResponse({ pairingConfidence: 85 }))

    const labeled = readFixture('01-clean-speaker-labeled.txt')
    const result = await analyzeTranscript(FAKE_CONFIG, { ...BASE_INPUT, transcriptText: labeled })

    expect(result.analysis.extractionMode).toBe('per_answer')
    expect(result.analysis.answerBreakdown).not.toBeNull()
  })
})
