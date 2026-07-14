# Reqcore — Screening Scenario Plans.md

作成日: 2026-07-14
Feature: AI-generated screening scenario (recruiter interview script) per application.
Spec delta: ROADMAP.md — new "Screening Scenarios" milestone under Phase 2 (see ROADMAP.md).
team_validation_mode: subagent (Product/Skeptic, Architecture/QA, Security perspectives run 2026-07-14)

## Product contract (summary)

- Recruiter opens a candidate's application (CandidateDetailSidebar) → new **Screening** tab.
- Configures question count (5 / 8 / 10 / 15) and tone (technical / balanced / casual), clicks **Generate**.
- Server builds prompt from job description + candidate profile + parsed CV text + existing AI score
  (score optional — generation degrades gracefully without it), calls the org's resolved AI provider
  (BYOK → platform), stores the result as an append-only `screening_scenario` row (history preserved;
  regenerate = new row).
- Questions render as **plain text** (never v-html/markdown-to-HTML) with per-question category + rationale
  (Auditable Intelligence: the "why" is visible).
- Out of scope v1 (rejected in review): mark-as-asked checkboxes, call notes (defer to Milestone 11),
  streaming output, editing generated questions.

## Unknown data (not_observed != absent)

- `unknown`: how playwright e2e mocks AI provider calls today (no e2e AI fixture confirmed) — resolve in Task 3.1.
- `unknown`: exact erasure/export service file list for the candidate data graph — resolve in Task 1.7.
- `unknown`: whether the ai_analysis tab localizes AI output. v1 decision: generated questions follow the
  job description's language; UI labels use i18n keys.
- Confirmed: `captureAiGeneration.feature` is a free-text string (`server/utils/ai/observability.ts:44`) — no union to extend.
- Confirmed absent: no eslint/prettier config — repo baseline is `npm run typecheck` + vitest + playwright (used in all DoD).

---

## Phase 1: Backend — schema, prompt, endpoints (stage: 実装(TDD))

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 1.1 | [lane:gate] [tdd:skip:schema-migration] Add `screening_scenario` table to `server/database/schema/app.ts` mirroring `analysisRun`: org-scoped, applicationId, status enum (completed/failed), provider/model/billingMode, `config` jsonb ({questionCount, tone}), `inputSnapshot` jsonb, `questions` jsonb (typed via $type), token counts, costUsdMicros, errorMessage, generatedById, createdAt + indexes + relations | `npm run db:generate` produces migration; migration applies on clean db; typecheck passes | - | cc:TODO |
| 1.2 | [lane:gate] [tdd:required] `server/utils/ai/screeningScenario.ts`: zod response schema ({category, question, rationale}[]), pure `buildScreeningPrompt(config, input)` with tone + count injection and untrusted-data framing (CV/job text labeled as data, not instructions), generation via existing structured-output util, no tool use | Failing tests first; unit tests cover tone/count in prompt, schema rejects malformed/wrong-count payloads | - | cc:TODO |
| 1.3 | [lane:gate] [tdd:required] Extract shared `loadApplicationContext(applicationId, orgId)` helper (org-scoped application + job + candidate + resume text + score) from `analyze.post.ts`; all child lookups scoped through the org-checked application row | `analyze.post.ts` refactored to use helper with unchanged behavior; existing unit tests + typecheck pass; helper unit-tested incl. org-mismatch → not found | - | cc:TODO |
| 1.4 | [lane:gate] [tdd:required] `POST /api/applications/[id]/screening-scenario`: rate limiter (stricter than analyze, e.g. 10/min) → `requirePermission({ scoring: ['create'] })` → loadApplicationContext → `resolveAnalysisProvider` → `assertPlatformBudget` → generate → insert row (also on failure, with errorMessage) → `captureAiGeneration({ feature: 'screening_scenario' })` + cost via `computeCostUsdMicros` | Unit tests for request zod schema (count 5–15, tone enum) and response mapper; failure paths return 422 (no provider), budget error via `budgetErrorToHttp`, 502 on LLM error with failed row written; typecheck passes | 1.1, 1.2, 1.3 | cc:TODO |
| 1.5 | [lane:gate] [tdd:required] `GET /api/applications/[id]/screening-scenario`: latest scenario + generation history (org-scoped, `scoring: ['read']`) | Unit test for org scoping (IDOR: other-org applicationId → 404); typecheck passes | 1.1 | cc:TODO |
| 1.6 | [lane:gate] [tdd:required] Extend `server/utils/ai/budget.ts` platform-run counting (free-tier count + monthly/daily sums) to include `screening_scenario` rows so the second AI surface is metered | `billing-limits`-style unit tests prove scenario generations count toward free-tier cap | 1.1, 1.4 | cc:TODO |
| 1.7 | [lane:gate] [tdd:required] GDPR: include `screening_scenario` in candidate erasure data graph and per-candidate export (per DATA-RETENTION.md); verify quarantine/soft-delete coverage | `candidate-retention` tests extended: erasing a candidate removes their scenarios; export includes them | 1.1 | cc:TODO |

## Phase 2: Frontend — Screening tab (stage: 実装(TDD))

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 2.1 | [lane:gate] [tdd:skip:ui-covered-by-e2e] New `screening` tab in `CandidateDetailSidebar.vue` (+ `initialTab` union): config panel (question count select, 3-way tone control), Generate/Regenerate button with loading state (ScoreBreakdown pattern), questions rendered as plain text with category + rationale, generation metadata (model, when, by whom); all labels via i18n keys (en + existing locales) | Tab renders latest scenario on open (GET), generate produces questions in UI; no v-html anywhere in the tab; typecheck passes | Phase 1 | cc:TODO |
| 2.2 | [lane:gate] [tdd:skip:ui-covered-by-e2e] Empty/error states: no parsed CV (generate allowed, weighted to job description — show notice), no AI score yet (notice, still generates), provider unconfigured (BYOK CTA, mirrors ai_analysis tab), budget exceeded (upgrade notice), generation failed (retry) | Each state reachable and rendered correctly (manual verify + e2e in 3.1) | 2.1 | cc:TODO |
| 2.3 | [lane:fast] [tdd:skip:analytics-only] `track('screening_scenario_generated', …)` via existing trackEvent util | Event fires with application_id + config; typecheck passes | 2.1 | cc:TODO |

## Phase 3: Verification & closeout (stage: レビュー / PR closeout)

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 3.1 | [lane:gate] [tdd:required] Playwright e2e: open candidate sidebar → Screening tab → generate → questions render → regenerate appends history (resolve AI-mock strategy first — see unknown list) | `npm run test:e2e` passes locally/CI; AI call mocked or fixture-backed, no live spend in CI | Phase 2 | cc:TODO |
| 3.2 | [lane:gate] [tdd:skip:review-task] `harness-review` on the branch + full gate: `npm run test`, `npm run typecheck`, evidence pack → PR body → `git push` + `gh pr create` to main | Review artifact produced; all gates green; PR opened | 3.1 | cc:TODO |

---

## 事前確認

- 事項: external-send — `git push` / `gh pr create`（GitHub への branch push と PR 作成）
  理由: Task 3.2 の PR closeout DoD に必要
  scope: Phase 3 / Task 3.2
- 事項: external-send — 開発検証中の AI provider API 呼び出し（OpenRouter / org 設定済み provider）
  理由: Task 2.1–3.1 の動作検証で実プロバイダ呼び出しが発生し得る（CI では mock）
  scope: Phase 2–3 / Task 2.1, 2.2, 3.1
- 事項: destructive — なし（migration は additive のみ、既存テーブル変更なし）
  理由: 宣言のみ（該当操作なし）
  scope: -
- 事項: secret-read — なし
  理由: 宣言のみ（.env / secret の読取は不要）
  scope: -
