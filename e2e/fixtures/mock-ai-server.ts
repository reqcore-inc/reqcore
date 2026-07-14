import http from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * Minimal local HTTP server that speaks just enough of the OpenAI
 * **Responses API** wire protocol to satisfy `@ai-sdk/openai`'s
 * `generateObject` (structured-output) call path — no real LLM involved.
 *
 * Why this shape: `server/utils/ai/provider.ts#generateStructuredOutput` uses
 * the Vercel AI SDK's `generateObject`, which for the `openai`/
 * `openai_compatible` provider factory (`createOpenAI(...)` called as
 * `openai(modelId)`) defaults to `createResponsesModel` — NOT the Chat
 * Completions model (`@ai-sdk/openai/dist/index.js#createLanguageModel` →
 * `createResponsesModel`). That model POSTs to `${baseUrl}/responses` (see
 * `OpenAIResponsesLanguageModel#doGenerate` — `url: ({ path }) => baseURL +
 * path`, no implicit `/v1` insertion) and reads the structured object back
 * from `output[].content[].text` where `output[].type === 'message'` (see
 * `openaiResponsesResponseSchema`). This mock returns a minimal, valid
 * Responses API envelope with that field populated — no tool-calling, no
 * auth, no fidelity to the real API beyond what the SDK's response schema
 * requires.
 *
 * (An earlier version of this mock spoke the older Chat Completions
 * `/chat/completions` shape, which is what `@ai-sdk/openai`'s *chat* model
 * uses — but the default model factory in `provider.ts` doesn't go through
 * that path, so requests never reached it. Confirmed by intercepting the
 * actual request in a Playwright run: the SDK posts to `/responses`, not
 * `/chat/completions`.)
 *
 * The org's AI config in these tests points `baseUrl` directly at this
 * server (provider: `openai_compatible`) — see the "Configure AI provider →
 * mock server" step in `transcript-analysis.spec.ts`. This is option (2) from
 * the TA5.2 task brief: no live LLM is ever called.
 */

/** Matches the raw shape `transcriptAnalysisRawSchema` expects (see `server/utils/ai/transcriptAnalysis.ts`). */
export const MOCK_TRANSCRIPT_ANALYSIS = {
  answerBreakdown: [
    {
      question: 'Can you walk me through your current role and recent project ownership?',
      answer: 'The candidate described owning a billing reconciliation service and leading its extraction from a monolith into an independently deployable service.',
      evidence: '"I own the reconciliation service that matches Stripe events to internal invoices, and I recently led the migration of that service from a monolith into its own deployable unit."',
      score: 8,
      confidence: 88,
      strengths: ['Directly relevant ownership experience', 'Clear technical rationale for the migration'],
      gaps: ['No mention of team size or cross-functional coordination'],
    },
    {
      question: 'How comfortable are you working without a clear spec?',
      answer: 'The candidate said they often ended up writing the spec themselves even at a company with more process, so ambiguity is not new.',
      evidence: '"Even in a well-specified company, a lot of my actual day-to-day was defining the problem before solving it."',
      score: 7,
      confidence: 80,
      strengths: ['Comfortable with ambiguity', 'Proactive about defining scope'],
      gaps: ['Limited evidence of founding-stage (0-to-1) product ambiguity specifically'],
    },
  ],
  sectionScores: [
    {
      // maxScore is deliberately NOT 10, so "score/maxScore" text (e.g.
      // "9/15") can never collide with an answerBreakdown item's fixed
      // "score/10" text in the UI — see the e2e spec's section-score
      // assertions, which rely on this text being unambiguous.
      section: 'Technical Experience',
      score: 9,
      maxScore: 15,
      evidence: 'Candidate described owning a service migration and a production incident postmortem.',
      summary: 'Strong, specific technical experience aligned with the role.',
    },
    {
      section: 'Communication & Ownership',
      score: 12,
      maxScore: 15,
      evidence: 'Answers were structured and included concrete outcomes and lessons learned.',
      summary: 'Communicated clearly and took ownership of a past failure.',
    },
  ],
  pairingConfidence: 82,
  recommendation: 'advance' as const,
  confidence: 78,
  rationale: 'The candidate demonstrated strong, specific technical ownership experience directly relevant to the role and communicated clearly throughout the screening call, including candidly discussing a past production incident and what they learned from it.',
}

export interface MockAiServer {
  /** Base URL to hand to the app's `openai_compatible` AI config (`baseUrl`). */
  url: string
  /** Number of `/responses` requests received so far. */
  requestCount: () => number
  close: () => Promise<void>
}

/**
 * Starts the mock server on an OS-assigned loopback port. The Nuxt dev
 * server (a separate process on the same host) reaches it over
 * `127.0.0.1`, exactly like a real provider endpoint.
 */
export async function startMockAiServer(): Promise<MockAiServer> {
  let requestCount = 0

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || !req.url?.endsWith('/responses')) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'mock-ai-server: unsupported route' } }))
      return
    }

    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      requestCount++
      const responseBody = {
        id: `mock-resp-${requestCount}`,
        created_at: Math.floor(Date.now() / 1000),
        model: 'mock-transcript-analysis',
        output: [
          {
            type: 'message',
            role: 'assistant',
            id: `mock-msg-${requestCount}`,
            content: [
              {
                type: 'output_text',
                text: JSON.stringify(MOCK_TRANSCRIPT_ANALYSIS),
                annotations: [],
              },
            ],
          },
        ],
        usage: {
          input_tokens: 512,
          output_tokens: 256,
        },
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(responseBody))
    })
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address() as AddressInfo
  const url = `http://127.0.0.1:${address.port}`

  return {
    url,
    requestCount: () => requestCount,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close(err => (err ? reject(err) : resolve()))
      }),
  }
}
