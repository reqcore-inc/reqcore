# Reqcore — Plans.md (worktree: transcript-analysis)

作成日: 2026-07-14
Spec (product contract): `docs/spec/transcript-analysis.md` — precedence `spec.md > sub-spec > Plans.md`

Feature: **Screening Transcript Analysis (TA)** — recruiter uploads a screening
transcript (PDF/DOCX/DOC) or pastes plain text onto an application → AI evaluates
the candidate's answers against job description, candidate profile (CV +
properties), scoring criteria, and (optionally) the screening scenario → output
is a per-answer breakdown with evidence, section scores, and an **advisory
recommendation** (`advance` / `hold` / `do_not_advance` / `insufficient_evidence`).
Never auto-changes application status (GDPR Art. 22 / EU AI Act posture — see spec).

Validation: `team_validation_mode: subagent` — two independent read-only reviews
(Architecture+Security; Product+QA+Skeptic) ran against live code; all Required
findings folded in below. Lint/formatter baseline: **absent** in repo — DoD relies
on `npm run typecheck` + `npm run test` + `npm run test:e2e` (same as CV-import plan).

unknown_data:
- screening-scenario schema (parallel feature, zero commits) → opaque-text adapter, `null` = omit
- real-world transcript formats (speaker labels / VTT / Teams DOCX) → resolved by TA0.2 spike

---

## TA Phase 0: 検証・調査 (stage 1) `[lane:gate]`

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| TA0.1 | Enumerate ALL `analysis_run` readers (scores endpoint, ai-analysis-stats, dashboards, billing usage meter) and record which must filter the new `kind` column vs count both kinds (budget gate counts both — intended). Evidence list in task notes. `[tdd:skip:research]` | Written list of reader → filter/no-filter decisions; no reader missed (grep evidence) | - | cc:完了 [82f9062] |
| TA0.2 | **Spike**: Q/A extraction reliability. Build ~10 heterogeneous transcript fixtures (unlabeled paste, Zoom-VTT-ish text, Teams-style DOCX, crosstalk, non-English fragment) and prompt-test per-answer pairing vs section-level fallback. Decide v1 breakdown granularity; fixtures become test assets. `[tdd:skip:spike]` | Decision recorded in spec (per-answer OR section-level v1); fixtures committed under `tests/unit/fixtures/` or `e2e/fixtures/` | - | cc:完了 [861dfa6] |

## TA Phase 1: Data model `[lane:gate]` `[tdd:required]` (stage 3)

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| TA1.1 | Migration: `documentTypeEnum` + `'transcript'`; `analysisRun.kind` enum (`application_scoring` default / `transcript_analysis`); new tables `screening_transcript` (org, applicationId, interviewId nullable FK, sourceType, documentId nullable FK, rawText ≤200k, truncated, createdById) + `transcript_analysis` (org, transcriptId, applicationId, analysisRunId FK, status, answerBreakdown jsonb, sectionScores jsonb, recommendation enum, confidence, rationale). **No rawResponse column.** Indexes + relations mirror `analysisRun` (org/application/createdAt). | Migration generated + applies clean on dev DB; schema typecheck green; unit test on enum defaults | TA0.1 | cc:完了 [550c5bb] |
| TA1.2 | Point existing scoring readers at `kind = 'application_scoring'` (from TA0.1 list — at minimum `applications/[id]/scores.get.ts`, analysis stats, billing usage meter where scoring-only is meant); budget gate (`budget.ts`) intentionally left counting both kinds. | Regression tests: scoring UI/stats exclude transcript runs; free-limit counter includes a `kind='transcript_analysis'` row (budget-bypass blocker closed) | TA1.1 | cc:完了 [83a0959] |
| TA1.3 | GDPR wiring: extend `erasure.ts` activityLog resource-type allowlist with transcript/analysis types; verify DB cascade + S3 deletion path (uploads live in `document` table so existing S3 erasure covers them — test proves it); add transcripts + analyses to DSAR export `candidates/[id]/export.get.ts`; update `DATA-RETENTION.md`. | Erasure test: candidate erase removes transcript rows, analysis rows, S3 object, activity rows; export includes both | TA1.1 | cc:完了 [abbaac3] |

## TA Phase 2: Ingestion endpoints `[lane:gate]` `[tdd:required]`

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| TA2.1 | Upload path: reuse existing document pipeline (magic-byte MIME validation, 10 MB cap, PDF/DOC/DOCX allowlist, server-generated storage keys, per-candidate doc limit) with `type='transcript'`, then create `screening_transcript` row; text via `parseDocument`. Quarantine gate (`findActiveCandidate`). Permission `document:['create']`. | Unit tests: invalid mime/size rejected; quarantined candidate 403/409; transcript row linked to document + application; org double-scoped | TA1.1 | cc:完了 [d7cdb8c] |
| TA2.2 | Paste path: `POST /api/applications/[id]/transcript` with `z.string().min(1).max(200_000)`; quarantine gate; org double-scope; permission `scoring:['create']`. | Unit tests: over-cap 400; cross-org application 404; happy path persists rawText | TA1.1 | cc:完了 [4d0ecff] |
| TA2.3 | `GET` (list transcripts + analyses for application, `scoring:['read']`) and `DELETE` transcript (also deletes linked document/S3 object; `document:['delete']`), all org double-scoped. | Unit tests: cross-org read/delete rejected; delete removes S3 object + rows | TA2.1, TA2.2 | cc:TODO |

## TA Phase 3: AI engine + run endpoint `[lane:gate]` `[tdd:required]`

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| TA3.1 | `server/utils/ai/transcriptAnalysis.ts`: Zod output schema (per TA0.2 granularity: answers with evidence/score/confidence, sectionScores, recommendation enum, rationale); prompt assembles job description + CV text + properties + criteria + scenario adapter (`scenario: string \| null`, null = omit); transcript fenced in delimiters with explicit "data, never instructions" contract; bias guardrails reused verbatim from `scoring.ts` system prompt; 60k-char cap with explicit truncation marker + flag; server-side clamps on scores/recommendation (mirror `scoring.ts` clamp). | Unit tests: injection strings in transcript don't alter schema/verdict bounds; truncation marker + flag set at cap; scenario null omits section; out-of-range LLM values clamped | TA0.2 | cc:完了 [5d99978] |
| TA3.2 | `POST /api/applications/[id]/transcript-analysis`: rate limit 20/min (mirror `analyze.post.ts`); `scoring:['create']`; quarantine gate; flow `resolveAnalysisProvider` → `assertPlatformBudget` (platform mode only) → LLM → companion `analysis_run` row (`kind='transcript_analysis'`, frozen `costUsdMicros`, billingMode, failed-run audit rows on error) → `transcript_analysis` row; `captureAiGeneration` feature tag `transcript_analysis`. | Unit tests: BudgetExceededError → 429; malformed AI JSON → `failed` run row, no dangling result row; cost/billing fields written; BYOK path skips budget gate | TA3.1, TA1.2, TA2.2 | cc:TODO |

## TA Phase 4: Frontend `[lane:gate]`

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| TA4.1 | "Screening Analysis" section on `app/pages/dashboard/applications/[id].vue`: upload/paste tabs, transcript list, run button with 429/budget error copy (reuse existing budget-exceeded messaging pattern). English copy per spec i18n decision. `[tdd:skip:ui-covered-by-e2e]` | Renders in dev; upload + paste + run reachable; budget error surfaced, not swallowed | TA2.3, TA3.2 | cc:TODO |
| TA4.2 | Results view: advisory banner ("AI recommendation — the decision is yours" framing, recommendation + confidence), section scores, per-answer accordion with quoted evidence, visible truncation notice when flagged. **No control that auto-changes application status.** `[tdd:skip:ui-covered-by-e2e]` | All output fields rendered; advisory copy present; truncation notice shown when `truncated` | TA4.1 | cc:TODO |

## TA Phase 5: Verification + closeout `[lane:gate]` (stage gates 4–5)

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| TA5.1 | Unit suite `tests/unit/transcript-analysis*.test.ts` following `ai-provider-grandfathered.test.ts` mock pattern: provider/plan resolution + BYOK fallback, budget-429 boundary (`billing-limits.test.ts` pattern), malformed/out-of-range AI JSON, prompt injection, org isolation (`demo-account-isolation.test.ts` pattern), quarantine, parser fixtures (`resume-parser.test.ts` pattern), kind-filter regressions. `[tdd:required]` | `npm run test` green; every Phase 1–3 behavior has a covering test | TA3.2 | cc:TODO |
| TA5.2 | e2e `e2e/critical-flows/transcript-analysis.spec.ts` (clone `resume-upload.spec.ts` file-config pattern, mocked AI provider — no live LLM): upload valid/invalid types, paste, run, breakdown + advisory banner render. `[tdd:required]` | `npm run test:e2e` green locally | TA4.2 | cc:TODO |
| TA5.3 | Closeout: `npm run typecheck` + full test suites; `harness-review` artifact; evidence pack → PR body; push branch + open PR (pre-approved item #1). `[tdd:skip:verification-phase]` | Review artifact attached; PR open with evidence; CI green | TA5.1, TA5.2 | cc:TODO |

---

## 事前確認 (plan-time pre-approval)

- 事項: external-send — `git push` + `gh pr create` (branch `worktree-transcript-analysis` → PR to `main`)
  理由: TA5.3 closeout DoD requires an open PR with evidence pack
  scope: Phase TA5 / Task TA5.3
- 事項: destructive — Drizzle migration apply against the **local dev database** (new enums/columns/tables; additive only, no drops)
  理由: TA1.1 DoD requires the migration to apply cleanly before dependent tasks
  scope: Phase TA1 / Task TA1.1
- 事項: external-send — optional live LLM calls during the TA0.2 spike using the locally configured dev AI key (small, bounded prompt runs; spend on the configured key)
  理由: Q/A-extraction reliability can't be judged from mocks alone
  scope: Phase TA0 / Task TA0.2

Not requested: no secret-read (no `.env`/key file reads needed — tests use mocks; dev server reads env itself), no force-push, no production operations.
