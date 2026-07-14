import { test, expect, declineAnalyticsConsent } from '../fixtures'
import type { Browser, Page, Request, Response, Route } from '@playwright/test'

/**
 * Critical flow: the "Screening" tab on the candidate detail sidebar
 * (ScreeningScenarioPanel.vue).
 *
 * All AI-provider interaction happens server-side in
 * `server/api/applications/[id]/screening-scenario.{get,post}.ts` — this
 * spec never talks to a real LLM. Both endpoints are intercepted via
 * `page.route()` fixtures (same pattern as
 * `e2e/critical-flows/billing-checkout.spec.ts`'s Stripe interception),
 * so the test is deterministic and costs no AI spend in CI.
 *
 * Setup mirrors `candidate-application.spec.ts`: sign up → create a job →
 * publish it → apply as a candidate → open the recruiter's candidate
 * detail sidebar for that application.
 */

const JOB_TITLE = 'Backend Engineer — Screening Scenario Test'
const JOB_DESCRIPTION = 'Join our platform team building the core API.'
const JOB_LOCATION = 'Remote'

interface ScreeningQuestionFixture {
  category: string
  question: string
  rationale: string
}

interface ScreeningScenarioFixture {
  id: string
  status: string
  provider: string | null
  model: string | null
  config: { questionCount: number, tone: 'technical' | 'balanced' | 'casual' } | null
  questions: ScreeningQuestionFixture[] | null
  promptTokens: number | null
  completionTokens: number | null
  errorMessage: string | null
  createdAt: string
}

/**
 * Eight questions for the "generate 10" selection below — the fixture data
 * shape is intercept-controlled, so the exact count of returned questions
 * doesn't need to match the requested `questionCount`; only the client's
 * outgoing request body is asserted against the UI selection.
 * One question intentionally contains a raw `<script>` tag to verify the
 * panel renders question text as literal text (Vue's `{{ }}` interpolation
 * escapes HTML) rather than executing/parsing it as markup.
 */
function buildQuestions(): ScreeningQuestionFixture[] {
  return [
    { category: 'Technical', question: 'Explain how you would design a rate limiter for a public API.', rationale: 'Assesses systems design depth.' },
    { category: 'Technical', question: 'Walk through debugging a memory leak in a Node.js service.', rationale: 'Assesses production debugging skill.' },
    { category: 'Behavioral', question: 'Describe a time you disagreed with a technical decision.', rationale: 'Assesses collaboration style.' },
    { category: 'Technical', question: '<script>alert(1)</script>', rationale: 'XSS canary — must render as literal text, never execute.' },
    { category: 'Technical', question: 'How would you index a table for a high-cardinality search query?', rationale: 'Assesses database fundamentals.' },
    { category: 'Behavioral', question: 'Tell me about a project that failed and what you learned.', rationale: 'Assesses reflection and growth mindset.' },
    { category: 'Technical', question: 'What tradeoffs would you weigh between REST and GraphQL here?', rationale: 'Assesses API design judgement.' },
    { category: 'Technical', question: 'How do you approach testing an asynchronous background job?', rationale: 'Assesses testing discipline.' },
  ]
}

function makeScenario(overrides: Partial<ScreeningScenarioFixture> & { id: string }): ScreeningScenarioFixture {
  return {
    status: 'completed',
    provider: 'anthropic',
    model: 'test-model',
    config: { questionCount: 10, tone: 'technical' },
    questions: buildQuestions(),
    promptTokens: 512,
    completionTokens: 256,
    errorMessage: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Installs the GET/POST screening-scenario route interception for a given
 * page + applicationId. `getResponder` is called on every GET so tests can
 * flip behaviour between "before generation" (empty) and "after generation"
 * (fixture scenario) without re-registering the route.
 */
async function mockScreeningScenarioRoutes(
  page: Page,
  applicationId: string,
  options: {
    getResponder: () => { latest: ScreeningScenarioFixture | null, history: ScreeningScenarioFixture[] }
    postResponder: (body: any) => ScreeningScenarioFixture | { status: number, statusMessage: string }
  },
) {
  const routePattern = new RegExp(`/api/applications/${applicationId}/screening-scenario$`)

  await page.route(routePattern, async (route: Route) => {
    const method = route.request().method()

    if (method === 'GET') {
      const body = options.getResponder()
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
      return
    }

    if (method === 'POST') {
      const requestBody = route.request().postDataJSON()
      const result = options.postResponder(requestBody)
      if ('statusMessage' in result) {
        await route.fulfill({
          status: result.status,
          contentType: 'application/json',
          body: JSON.stringify({ statusCode: result.status, statusMessage: result.statusMessage }),
        })
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) })
      return
    }

    await route.continue()
  })
}

/**
 * Recruiter setup mirroring candidate-application.spec.ts: create a job via
 * the 4-step New Job wizard (no custom questions needed here), publish it,
 * apply as a candidate, then return to the recruiter's dashboard so the
 * caller can open the CandidateDetailSidebar.
 */
async function setUpApplicationAndOpenCandidatesTable(page: Page, browser: Browser, testInfo: { retry: number }) {
  await page.goto('/dashboard/jobs/new')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Job title').waitFor({ state: 'visible', timeout: 15_000 })
  await page.getByLabel('Job title').fill(JOB_TITLE)
  await page.locator('textarea').first().fill(JOB_DESCRIPTION)
  await page.getByLabel('Location').fill(JOB_LOCATION)

  // Step 1 → Step 2
  await page.locator('form').getByRole('button', { name: 'Save & continue' }).first().waitFor({ state: 'attached', timeout: 10_000 })
  await expect(page.locator('form').getByRole('button', { name: 'Save & continue' }).first()).toBeEnabled({ timeout: 10_000 })
  await page.locator('form').getByRole('button', { name: 'Save & continue' }).first().click()

  // Step 2: no resume required — no custom questions needed for this flow
  const resumeRadioGroup = page.getByRole('radiogroup', { name: /Resume requirement/i })
  await resumeRadioGroup.waitFor({ state: 'visible', timeout: 10_000 })
  await resumeRadioGroup.getByRole('radio', { name: 'Off' }).click()
  await page.locator('form').getByRole('button', { name: 'Save & continue' }).first().click()

  // Step 3: Scoring criteria — skip
  await page.locator('form').getByRole('button', { name: 'Save & continue' }).first().waitFor({ state: 'visible', timeout: 10_000 })
  await page.locator('form').getByRole('button', { name: 'Save & continue' }).first().click()

  // Step 4: Publish
  await expect(page.getByRole('heading', { name: /Ready to go\?/i })).toBeVisible({ timeout: 10_000 })
  const publishButton = page.locator('form').getByRole('button', { name: /Publish & copy link/i })
  await publishButton.waitFor({ state: 'visible', timeout: 10_000 })
  await publishButton.click()
  await expect(page.getByRole('heading', { name: 'Your job is live!' })).toBeVisible({ timeout: 20_000 })

  const applicationLink = await page.locator('input[readonly]').inputValue()
  expect(applicationLink).toMatch(/\/jobs\/[^/]+\/apply(?:$|[?#])/)
  const slugMatch = applicationLink.match(/\/jobs\/([^/]+)\/apply(?:$|[?#])/)
  const jobSlug = slugMatch?.[1] ?? ''
  expect(jobSlug.length, 'Job slug must not be empty').toBeGreaterThan(0)

  // ── Candidate flow: fresh unauthenticated context ─────────────────────────
  const candidateContext = await browser.newContext()
  await declineAnalyticsConsent(candidateContext)
  const candidatePage = await candidateContext.newPage()

  const applicant = {
    firstName: 'Sam',
    lastName: 'Reviewer',
    email: `sam.reviewer.${Date.now()}.r${testInfo.retry}@example.com`,
    phone: '+49 170 7654321',
  }

  await candidatePage.goto(applicationLink)
  await candidatePage.waitForLoadState('networkidle')
  await expect(candidatePage.getByRole('heading', { name: JOB_TITLE })).toBeVisible({ timeout: 15_000 })
  await candidatePage.getByRole('button', { name: /submit/i }).waitFor({ state: 'visible', timeout: 15_000 })

  await candidatePage.getByLabel('First name').fill(applicant.firstName)
  await candidatePage.getByLabel('Last name').fill(applicant.lastName)
  await candidatePage.getByLabel('Email').fill(applicant.email)
  await candidatePage.getByLabel('Phone').fill(applicant.phone)

  const [applyResponse] = await Promise.all([
    candidatePage.waitForResponse(
      (resp: Response) =>
        resp.url().includes(`/api/public/jobs/${jobSlug}/apply`) &&
        resp.request().method() === 'POST',
      { timeout: 30_000 },
    ),
    candidatePage.getByRole('button', { name: /submit/i }).click(),
  ])
  const applyStatus = applyResponse.status()
  expect(applyStatus, `Apply API returned ${applyStatus}`).toBeGreaterThanOrEqual(200)
  expect(applyStatus, `Apply API returned ${applyStatus}`).toBeLessThan(300)

  await candidatePage.close()
  await candidateContext.close()

  // ── Recruiter: navigate to the job's candidates table ─────────────────────
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')

  const jobCardLink = page.getByRole('link', { name: JOB_TITLE }).first()
  await expect(jobCardLink).toBeVisible({ timeout: 15_000 })
  const jobHref = await jobCardLink.getAttribute('href')
  expect(jobHref, 'Job card link must contain /jobs/').toContain('/jobs/')
  const jobId = jobHref!.split('/jobs/')[1]!.split('/')[0]
  expect(jobId.length, 'Job ID must not be empty').toBeGreaterThan(0)

  await page.goto(`/dashboard/jobs/${jobId}/candidates`)
  await page.waitForLoadState('networkidle')

  return { applicant, jobId }
}

/**
 * Opens the CandidateDetailSidebar for the given applicant (row click) and
 * captures the applicationId from the sidebar's own GET request — needed to
 * scope the page.route() interception before the panel fires its fetch.
 */
async function openCandidateSidebar(page: Page, applicant: { firstName: string, lastName: string }): Promise<string> {
  const sidebarAppRequestPromise = page.waitForRequest(
    (req: Request) => /\/api\/applications\/[^/]+$/.test(req.url()) && req.method() === 'GET',
    { timeout: 15_000 },
  ).catch(() => null)

  await page
    .getByRole('row', { name: new RegExp(`${applicant.firstName}\\s+${applicant.lastName}`, 'i') })
    .first()
    .click()

  await page.getByRole('button', { name: 'Overview' }).waitFor({ state: 'visible', timeout: 10_000 })

  const req = await sidebarAppRequestPromise
  if (req) {
    const match = req.url().match(/\/api\/applications\/([^/]+)$/)
    if (match?.[1]) return match[1]
  }

  // Fallback: scrape the applicationId from the URL query/hash if the
  // sidebar exposes it there (defensive — primary path above is expected
  // to resolve first in practice).
  throw new Error('Could not determine applicationId from sidebar network activity')
}

test.describe('Screening Scenario tab', () => {
  test('generate, regenerate, and error states', async ({ authenticatedPage, browser }, testInfo) => {
    const page = authenticatedPage

    const { applicant } = await setUpApplicationAndOpenCandidatesTable(page, browser, testInfo)

    // Open the sidebar once, unmocked, purely to learn the applicationId —
    // then reload with the route interception installed so the panel's very
    // first GET is served by the fixture, not real data.
    const applicationId = await openCandidateSidebar(page, applicant)
    await page.getByRole('button', { name: 'Close (Esc)' }).click()

    let generationCount = 0
    const generatedScenarios: ScreeningScenarioFixture[] = []
    let lastPostBody: any = null
    let forceProviderUnconfigured = false

    await mockScreeningScenarioRoutes(page, applicationId, {
      getResponder: () => {
        if (generationCount === 0) {
          return { latest: null, history: [] }
        }
        return { latest: generatedScenarios[generatedScenarios.length - 1]!, history: [...generatedScenarios] }
      },
      postResponder: (body) => {
        lastPostBody = body
        if (forceProviderUnconfigured) {
          return { status: 422, statusMessage: 'No AI provider configured for this workspace.' }
        }
        generationCount += 1
        const scenario = makeScenario({
          id: `scenario-${generationCount}`,
          config: { questionCount: body?.questionCount, tone: body?.tone },
        })
        generatedScenarios.push(scenario)
        return scenario
      },
    })

    // Re-open the sidebar with interception active.
    await page
      .getByRole('row', { name: new RegExp(`${applicant.firstName}\\s+${applicant.lastName}`, 'i') })
      .first()
      .click()
    await page.getByRole('button', { name: 'Overview' }).waitFor({ state: 'visible', timeout: 10_000 })

    // ── Click the Screening tab ────────────────────────────────────────────
    await page.getByRole('button', { name: 'Screening' }).click()

    // ── Empty state + Generate button ──────────────────────────────────────
    await expect(page.getByText('No screening scenario yet.')).toBeVisible({ timeout: 10_000 })
    const generateButton = page.getByRole('button', { name: 'Generate' })
    await expect(generateButton).toBeVisible()

    // ── Select question count 10 + tone Technical ──────────────────────────
    // The "Questions" <select> and tone <button> group are not associated to
    // their labels via `for`/`aria-labelledby`, so scope to the sidebar
    // <aside> root — the candidates table page underneath also renders a
    // "Rows" pagination <select> that stays mounted behind the sidebar
    // overlay (the sidebar is a v-if aside on the same page, not a
    // navigation), so a bare `page.locator('select')` resolves to 2
    // elements and would be a strict-mode violation.
    const sidebar = page.locator('aside')
    await sidebar.locator('select').selectOption('10')
    await sidebar.getByRole('button', { name: 'Technical', exact: true }).click()

    // ── Click Generate ──────────────────────────────────────────────────────
    await Promise.all([
      page.waitForResponse(
        (resp: Response) => resp.url().includes(`/api/applications/${applicationId}/screening-scenario`) && resp.request().method() === 'POST',
      ),
      generateButton.click(),
    ])

    // Assert the intercepted POST body matches the UI selection.
    expect(lastPostBody).toMatchObject({ questionCount: 10, tone: 'technical' })

    // ── Fixture questions render (question text, category chip, rationale) ──
    // Each question is rendered in its own card — scope the category-chip
    // and rationale assertions to that card so "Technical" (which is also
    // the tone toggle button's label) is unambiguous.
    const questions = buildQuestions()
    for (const q of questions) {
      if (q.question.includes('<script>')) continue // asserted separately below
      const questionText = page.getByText(q.question, { exact: false }).first()
      await expect(questionText).toBeVisible({ timeout: 10_000 })
      const card = questionText.locator('xpath=ancestor::*[contains(@class, "rounded-xl")][1]')
      await expect(card.getByText(q.category, { exact: true })).toBeVisible()
      await expect(card.getByText(q.rationale, { exact: false })).toBeVisible()
    }

    // ── No HTML injection: the <script> question renders as literal text ────
    const scriptQuestion = questions.find(q => q.question.includes('<script>'))!
    await expect(page.getByText(scriptQuestion.question, { exact: false })).toBeVisible()
    // If the markup were parsed/executed, this locator (a real <script> DOM
    // node injected via v-html or similar) would exist. Vue's default `{{ }}`
    // interpolation escapes HTML, so no such element should ever be created.
    // Scoped to the sidebar <aside> for consistency with the other assertions.
    await expect(sidebar.locator('script:has-text("alert(1)")')).toHaveCount(0)

    // ── Button now reads Regenerate ──────────────────────────────────────────
    const regenerateButton = page.getByRole('button', { name: 'Regenerate' })
    await expect(regenerateButton).toBeVisible()

    // ── Simulate regenerate with a second fixture (history length 2) ────────
    await Promise.all([
      page.waitForResponse(
        (resp: Response) => resp.url().includes(`/api/applications/${applicationId}/screening-scenario`) && resp.request().method() === 'POST',
      ),
      regenerateButton.click(),
    ])

    expect(generatedScenarios.length).toBe(2)
    await expect(page.getByText('Generation 2')).toBeVisible({ timeout: 10_000 })

    // ── Error state: 422 "No AI provider configured" → BYOK CTA, not a crash ─
    forceProviderUnconfigured = true
    const regenerateButtonAgain = page.getByRole('button', { name: 'Regenerate' })
    await Promise.all([
      page.waitForResponse(
        (resp: Response) => resp.url().includes(`/api/applications/${applicationId}/screening-scenario`) && resp.request().method() === 'POST',
      ),
      regenerateButtonAgain.click(),
    ])

    await expect(page.getByText('No AI provider configured for this workspace.')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('link', { name: 'Go to AI Settings' })).toBeVisible()
    // The panel must not crash — the previously rendered questions and the
    // Regenerate button should still be present underneath the error notice.
    await expect(page.getByRole('button', { name: 'Regenerate' })).toBeVisible()
    await expect(page.getByText(questions[0]!.question, { exact: false })).toBeVisible()
  })
})
