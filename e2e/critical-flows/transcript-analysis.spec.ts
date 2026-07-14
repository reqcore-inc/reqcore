import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, declineAnalyticsConsent } from '../fixtures'
import {
  VALID_FILE_CONFIGS,
  INVALID_FILE_CONFIGS,
} from '../fixtures/test-buffers'
import { startMockAiServer, MOCK_TRANSCRIPT_ANALYSIS, type MockAiServer } from '../fixtures/mock-ai-server'

/**
 * TA5.2's DoD asks for "valid PDF and DOCX accepted" — deliberately narrower
 * than `resume-upload.spec.ts`'s full VALID_FILE_CONFIGS (which also covers
 * legacy `.doc`/OLE2). Investigating while writing this spec surfaced a real,
 * pre-existing bug: `transcript/upload.post.ts`'s OLE2 magic-byte fallback
 * only triggers on `!mimeType`, but `file-type` detects OLE2 buffers as
 * `application/x-cfb` (a truthy, non-undefined value) rather than leaving it
 * undefined — so the fallback never runs and legitimate `.doc` uploads are
 * rejected. The sibling endpoint `server/api/public/jobs/[slug]/apply.post.ts`
 * already has the fix (`if (!mimeType || mimeType === 'application/x-cfb')`)
 * but `transcript/upload.post.ts` doesn't. Filed as a known gap rather than
 * fixed here — TA5.2's file scope is spec + fixtures + minimal component
 * testids only, and the DoD doesn't require legacy `.doc` coverage.
 */
const TRANSCRIPT_VALID_FILE_CONFIGS = VALID_FILE_CONFIGS.filter(f => f.label !== 'DOC (legacy Word)')

/**
 * Critical flow: Transcript Analysis — upload, paste, run (mocked provider),
 * and results rendering.
 *
 * Covers TA5.2's DoD:
 *   (a) upload path — valid PDF/DOC/DOCX accepted, invalid types rejected
 *       with a visible error (clones `resume-upload.spec.ts`'s VALID/INVALID
 *       file-config loop pattern, applied to the transcript upload input).
 *   (b) paste path — pasted text appears in the list with `source: 'paste'`.
 *   (c) run — analysis reaches a deterministic outcome with NO live LLM call.
 *       Mock seam: the org's AI config (`openai_compatible` provider) points
 *       `baseUrl` at a local HTTP server (`../fixtures/mock-ai-server.ts`)
 *       started in-process by this spec, which returns a canned structured
 *       chat-completion response matching `transcriptAnalysisRawSchema`.
 *       This is the "reuse the seam via `server/utils/ai/provider.ts`" path
 *       from the task brief (option 2) — no `codex`/other e2e AI mock
 *       mechanism exists yet in this repo (checked: no other spec mocks AI).
 *   (d) breakdown + advisory banner render, driven entirely by the mocked
 *       analysis result above.
 *
 * A single long-form test (rather than many small ones) mirrors
 * `candidate-application.spec.ts`'s pattern: the flow is inherently
 * sequential (job → application → AI config → uploads → paste → run →
 * results → delete) and sharing one recruiter session avoids re-running the
 * expensive signup/job-creation setup for each assertion.
 */

const JOB_TITLE = 'Transcript Analysis E2E Test Role'
const JOB_DESCRIPTION = 'A role used purely to exercise the transcript analysis critical flow end-to-end.'
const JOB_LOCATION = 'Remote'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SAMPLE_TRANSCRIPT_TEXT = fs.readFileSync(
  path.join(__dirname, '../../tests/unit/fixtures/transcripts/01-clean-speaker-labeled.txt'),
  'utf-8',
)

let mockAiServer: MockAiServer

test.describe('Transcript Analysis — Upload, Paste, Run (mocked provider), Results', () => {
  test.beforeAll(async () => {
    mockAiServer = await startMockAiServer()
  })

  test.afterAll(async () => {
    await mockAiServer.close()
  })

  test('recruiter can upload/reject transcripts, paste one, run mocked analysis, and see results', async ({ authenticatedPage, browser }, testInfo) => {
    const page = authenticatedPage

    // ── Create & publish a job (resume off — the candidate flow here only
    //    needs to produce an application; transcripts are attached later
    //    from the recruiter dashboard, not the candidate application form) ──

    await page.goto('/dashboard/jobs/new')
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Job title').waitFor({ state: 'visible', timeout: 15_000 })
    await page.getByLabel('Job title').fill(JOB_TITLE)
    await page.locator('textarea').first().fill(JOB_DESCRIPTION)
    await page.getByLabel('Location').fill(JOB_LOCATION)

    await page.locator('form').getByRole('button', { name: 'Save & continue' }).first()
      .waitFor({ state: 'attached', timeout: 10_000 })
    await expect(page.locator('form').getByRole('button', { name: 'Save & continue' }).first())
      .toBeEnabled({ timeout: 10_000 })
    await page.locator('form').getByRole('button', { name: 'Save & continue' }).first().click()

    // Step 2: turn resume requirement off so the candidate can submit with no file.
    const resumeRadioGroup = page.getByRole('radiogroup', { name: /Resume requirement/i })
    await resumeRadioGroup.waitFor({ state: 'visible', timeout: 10_000 })
    await resumeRadioGroup.getByRole('radio', { name: 'Off' }).click()
    await page.locator('form').getByRole('button', { name: 'Save & continue' }).first().click()

    // Step 3 (Scoring criteria — skip) → Step 4 (Publish)
    await page.locator('form').getByRole('button', { name: 'Save & continue' }).first()
      .waitFor({ state: 'visible', timeout: 10_000 })
    await page.locator('form').getByRole('button', { name: 'Save & continue' }).first().click()

    await expect(page.getByRole('heading', { name: /Ready to go\?/i })).toBeVisible({ timeout: 10_000 })
    const publishButton = page.locator('form').getByRole('button', { name: /Publish & copy link/i })
    await publishButton.waitFor({ state: 'visible', timeout: 10_000 })
    await publishButton.click()
    await expect(page.getByRole('heading', { name: 'Your job is live!' })).toBeVisible({ timeout: 20_000 })

    const applicationLink = await page.locator('input[readonly]').inputValue()
    expect(applicationLink).toMatch(/\/jobs\/[^/]+\/apply(?:$|[?#])/)

    // ── Candidate applies (fresh unauthenticated context) ─────────────────

    const candidateContext = await browser.newContext()
    await declineAnalyticsConsent(candidateContext)
    const candidatePage = await candidateContext.newPage()

    const applicant = {
      firstName: 'Taylor',
      lastName: `TranscriptTest${Date.now()}`,
      email: `transcript-e2e-${Date.now()}.r${testInfo.retry}@example.com`,
      phone: '+1 555 010 2000',
    }

    await candidatePage.goto(applicationLink)
    await candidatePage.waitForLoadState('networkidle')
    await expect(candidatePage.getByRole('heading', { name: JOB_TITLE })).toBeVisible({ timeout: 15_000 })
    await candidatePage.getByRole('button', { name: /submit/i }).waitFor({ state: 'visible', timeout: 15_000 })

    await candidatePage.getByLabel('First name').fill(applicant.firstName)
    await candidatePage.getByLabel('Last name').fill(applicant.lastName)
    await candidatePage.getByLabel('Email').fill(applicant.email)
    await candidatePage.getByLabel('Phone').fill(applicant.phone)

    await Promise.all([
      candidatePage.waitForResponse(
        resp => resp.url().includes('/api/public/jobs/') && resp.url().includes('/apply') && resp.request().method() === 'POST',
        { timeout: 30_000 },
      ),
      candidatePage.getByRole('button', { name: /submit/i }).click(),
    ])
    await expect(candidatePage.getByRole('heading', { name: 'Application Submitted!' })).toBeVisible({ timeout: 15_000 })

    await candidatePage.close()
    await candidateContext.close()

    // ── Recruiter: navigate to the new application's detail page ─────────

    await page.goto('/dashboard/applications')
    await page.waitForLoadState('networkidle')
    const applicantFullName = `${applicant.firstName} ${applicant.lastName}`
    const appRow = page.getByText(applicantFullName).first()
    await expect(appRow).toBeVisible({ timeout: 15_000 })
    await appRow.click()

    // Clicking a row opens the `ApplicationDetailDrawer` slide-over, not a
    // full navigation. "Open full page" links to the real
    // `/dashboard/applications/:id` route (see `ApplicationDetailDrawer.vue`)
    // — navigate there so the URL (and therefore the application id) is real.
    const openFullPageLink = page.getByRole('link', { name: 'Open full page' })
    await openFullPageLink.waitFor({ state: 'visible', timeout: 15_000 })
    await openFullPageLink.click()
    await page.waitForURL(/\/dashboard\/applications\/[^/?#]+/, { timeout: 15_000 })
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: new RegExp(applicant.firstName, 'i') })).toBeVisible({ timeout: 15_000 })
    const applicationDetailUrl = page.url()
    const applicationIdMatch = applicationDetailUrl.match(/\/applications\/([^/?#]+)/)
    expect(applicationIdMatch, 'Application detail URL must contain the application id').not.toBeNull()
    const applicationId = applicationIdMatch![1]!

    // ── Configure the org's AI provider → point it at the local mock server ──
    // (option 2 from the task brief: `openai_compatible` provider, `baseUrl`
    // pointing at an in-process HTTP server; see mock-ai-server.ts docblock
    // for why this satisfies `generateStructuredOutput`'s wire contract.)

    const aiConfigResult = await page.evaluate(async (baseUrl) => {
      const res = await fetch('/api/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Mock E2E Provider',
          provider: 'openai_compatible',
          model: 'mock-transcript-analysis',
          apiKey: 'mock-api-key-not-a-real-secret',
          baseUrl,
          maxTokens: 4096,
          isDefaultChatbot: true,
          isDefaultAnalysis: true,
        }),
      })
      const text = await res.text()
      return { ok: res.ok, status: res.status, body: text }
    }, mockAiServer.url)
    expect(aiConfigResult.ok, `AI config creation failed: ${aiConfigResult.status} ${aiConfigResult.body}`).toBe(true)

    // Re-navigate to the application detail page so the Screening Analysis
    // section mounts fresh (component doesn't depend on the AI config, but
    // this keeps the test independent of any client-side caching of the
    // application query across the fetch() call above).
    await page.goto(applicationDetailUrl)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Screening Analysis' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('No transcripts attached yet.')).toBeVisible({ timeout: 15_000 })

    // ─────────────────────────────────────────────────────────────────────
    // (a) Upload path — valid formats accepted
    // ─────────────────────────────────────────────────────────────────────

    for (const fileConfig of TRANSCRIPT_VALID_FILE_CONFIGS) {
      const rowCountBefore = await page.locator('[data-testid="transcript-row"]').count()
      await Promise.all([
        page.waitForResponse(
          resp => resp.url().includes(`/api/applications/${applicationId}/transcript/upload`) && resp.request().method() === 'POST' && resp.status() === 201,
          { timeout: 30_000 },
        ),
        page.locator('[data-testid="transcript-upload-input"]').setInputFiles({
          name: fileConfig.filename,
          mimeType: fileConfig.mimeType,
          buffer: fileConfig.buffer,
        }),
      ])
      await expect(page.locator('[data-testid="transcript-row"]')).toHaveCount(rowCountBefore + 1, { timeout: 15_000 })
      const newRow = page.locator('[data-testid="transcript-row"][data-source-type="upload"]', { hasText: fileConfig.filename })
      await expect(newRow).toBeVisible({ timeout: 10_000 })
      await expect(newRow.getByText('Upload')).toBeVisible()
    }

    // ── (a) Upload path — invalid formats rejected with a visible error ──

    for (const fileConfig of INVALID_FILE_CONFIGS) {
      const rowCountBefore = await page.locator('[data-testid="transcript-row"]').count()
      const [response] = await Promise.all([
        page.waitForResponse(
          resp => resp.url().includes(`/api/applications/${applicationId}/transcript/upload`) && resp.request().method() === 'POST',
          { timeout: 30_000 },
        ),
        page.locator('[data-testid="transcript-upload-input"]').setInputFiles({
          name: fileConfig.filename,
          mimeType: fileConfig.mimeType,
          buffer: fileConfig.buffer,
        }),
      ])
      expect(response.status(), `${fileConfig.label}: expected 400 but got ${response.status()}`).toBe(400)

      // Visible error surfaced verbatim from the server (statusMessage).
      await expect(page.getByText(/Invalid file type/i)).toBeVisible({ timeout: 10_000 })
      // No new row was created for a rejected upload.
      await expect(page.locator('[data-testid="transcript-row"]')).toHaveCount(rowCountBefore, { timeout: 5_000 })
    }

    // ─────────────────────────────────────────────────────────────────────
    // (b) Paste path — pasted text appears in the list with source 'paste'
    // ─────────────────────────────────────────────────────────────────────

    const rowCountBeforePaste = await page.locator('[data-testid="transcript-row"]').count()
    await page.getByRole('button', { name: 'Paste text' }).click()
    await page.getByPlaceholder('Paste the screening-call transcript here…').fill(SAMPLE_TRANSCRIPT_TEXT)

    await Promise.all([
      page.waitForResponse(
        resp => resp.url().includes(`/api/applications/${applicationId}/transcript`) && resp.request().method() === 'POST' && resp.status() === 201,
        { timeout: 30_000 },
      ),
      page.getByRole('button', { name: 'Save transcript' }).click(),
    ])

    await expect(page.locator('[data-testid="transcript-row"]')).toHaveCount(rowCountBeforePaste + 1, { timeout: 15_000 })
    const pasteRow = page.locator('[data-testid="transcript-row"][data-source-type="paste"]').first()
    await expect(pasteRow).toBeVisible({ timeout: 10_000 })
    await expect(pasteRow.getByText('Pasted transcript')).toBeVisible()
    await expect(pasteRow.getByText(/^Paste ·/)).toBeVisible()

    // ─────────────────────────────────────────────────────────────────────
    // (c) Run — deterministic outcome from the mocked provider (no live LLM)
    // ─────────────────────────────────────────────────────────────────────

    const requestsBeforeRun = mockAiServer.requestCount()

    await Promise.all([
      page.waitForResponse(
        resp => resp.url().includes(`/api/applications/${applicationId}/transcript-analysis`) && resp.request().method() === 'POST' && resp.status() === 200,
        { timeout: 30_000 },
      ),
      pasteRow.getByRole('button', { name: 'Run analysis' }).click(),
    ])

    // The mock server (not a live LLM) received exactly one request for this run.
    expect(mockAiServer.requestCount()).toBe(requestsBeforeRun + 1)

    // ─────────────────────────────────────────────────────────────────────
    // (d) Results rendering — advisory banner, recommendation, section
    //     scores, extraction-mode label, per-answer breakdown
    // ─────────────────────────────────────────────────────────────────────

    const results = pasteRow.locator('[data-testid="transcript-analysis-results"]')
    await expect(results).toBeVisible({ timeout: 15_000 })

    // Advisory banner — the exact "decision is yours" copy contract.
    await expect(results.getByText(/This recommendation is AI-generated advice — the decision is yours\./i)).toBeVisible()

    // Recommendation label (mocked response: 'advance' → 'Advance').
    await expect(results.getByText('AI recommends:')).toBeVisible()
    await expect(results.getByText('Advance', { exact: true })).toBeVisible()

    // Confidence.
    await expect(results.getByText('Confidence:')).toBeVisible()

    // Extraction-mode label — the fixture transcript has clean speaker
    // labels and the mock's pairingConfidence (82) clears the >= 60 gate,
    // so the server computes extractionMode: 'per_answer'.
    await expect(results.getByText('Per-answer breakdown').first()).toBeVisible()

    // Section scores — both mocked sections with their score/maxScore.
    await expect(results.getByText('Section scores')).toBeVisible()
    for (const section of MOCK_TRANSCRIPT_ANALYSIS.sectionScores) {
      await expect(results.getByText(section.section)).toBeVisible()
      await expect(results.getByText(`${section.score}/${section.maxScore}`)).toBeVisible()
    }

    // Per-answer breakdown — question text from the mocked answerBreakdown.
    for (const answer of MOCK_TRANSCRIPT_ANALYSIS.answerBreakdown) {
      await expect(results.getByText(answer.question)).toBeVisible()
    }

    // Rationale.
    await expect(results.getByText(MOCK_TRANSCRIPT_ANALYSIS.rationale)).toBeVisible()

    // Expand a section and an answer to confirm the accordion content renders.
    await results.getByText(MOCK_TRANSCRIPT_ANALYSIS.sectionScores[0]!.section).click()
    await expect(results.getByText(MOCK_TRANSCRIPT_ANALYSIS.sectionScores[0]!.summary)).toBeVisible()

    await results.getByText(MOCK_TRANSCRIPT_ANALYSIS.answerBreakdown[0]!.question).click()
    await expect(results.getByText(MOCK_TRANSCRIPT_ANALYSIS.answerBreakdown[0]!.answer)).toBeVisible()

    // ─────────────────────────────────────────────────────────────────────
    // Delete — transcript (and its analysis) can be removed
    // ─────────────────────────────────────────────────────────────────────

    const rowCountBeforeDelete = await page.locator('[data-testid="transcript-row"]').count()
    await pasteRow.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('heading', { name: 'Delete Transcript' })).toBeVisible({ timeout: 5_000 })

    await Promise.all([
      page.waitForResponse(
        resp => resp.url().includes(`/api/applications/${applicationId}/transcript/`) && resp.request().method() === 'DELETE',
        { timeout: 15_000 },
      ),
      page.getByRole('button', { name: 'Delete', exact: true }).last().click(),
    ])

    await expect(page.locator('[data-testid="transcript-row"]')).toHaveCount(rowCountBeforeDelete - 1, { timeout: 15_000 })
  })
})
