# TA0.1 — Readers of `analysis_run` (drizzle symbol `analysisRun`)

Status: research complete · not_observed != absent (see Unknown section)

## Context

`analysis_run` is gaining a `kind: 'application_scoring' | 'transcript_analysis'`
column (default `application_scoring`, see `docs/spec/transcript-analysis.md`
"Data model" section). This document enumerates every code location that reads
(`select` / `query` / `$count` / `join`) the table today, and classifies whether
each reader must add a `kind = 'application_scoring'` filter once transcript
runs start landing in the same table, or whether it must intentionally keep
counting both kinds.

## Grep commands used (evidence)

```bash
# 1. drizzle symbol usage across all app surfaces
grep -rn "analysisRun" server/ app/ ee/ shared/ tests/ e2e/ --include="*.ts" --include="*.vue"

# 2. raw table name (catches SQL migrations / doc comments the symbol grep misses)
grep -rn "analysis_run" server/ app/ ee/ shared/ tests/ e2e/ --include="*.ts" --include="*.vue" --include="*.sql"

# 3. whole-repo sanity sweep (confirms no reader exists outside server/app/ee that
#    the two greps above missed — e.g. root-level scripts, config)
grep -rln "analysisRun\|analysis_run" --include="*.ts" --include="*.vue" --include="*.js" --include="*.mjs" .
```

Result of grep #3 matched exactly the same file set as greps #1/#2 (plus the
identical files duplicated once under the harness worktree mount) — no reader
was missed by scoping to `server/ app/ ee/ shared/ tests/ e2e/`.

No hits at all under `tests/` or `e2e/` — there is currently no automated test
that queries `analysisRun` directly (tests exercise it indirectly through API
route handlers, which are covered below).

## Reader table

| file:line | what it powers | classification | justification |
|---|---|---|---|
| `server/utils/ai/budget.ts:71-81` (`countPlatformRuns`) | Free-plan lifetime AI run limit gate (`assertPlatformBudget`) | **count both (intended)** | Spec: "The budget gate intentionally counts both kinds." A transcript run must consume the same free-tier lifetime allowance as a scoring run. |
| `server/utils/ai/budget.ts:84-101` (`sumPlatformSpendMicros`) | Org monthly $ ceiling + global daily kill-switch | **count both (intended)** | Same money-safety gate; spec explicitly requires transcript spend to count toward org monthly budget and global daily cap. |
| `server/utils/billing/usage.ts:40-50` (`countPlatformRuns`, duplicate of budget.ts) | `GET` org usage meter shown on the billing/upgrade UI (`aiAnalysis.used`) | **count both (intended)** | This function mirrors `budget.ts`'s free-tier count gate 1:1 (comment at top of file: "aiAnalysis → assertPlatformBudget free-tier count gate"). Must stay in lockstep with the gate it mirrors, or the billing UI will under-report usage relative to what the gate actually enforces. |
| `server/api/applications/[id]/scores.get.ts:50-66` (latest analysis run) | Matching Logic UI — application detail page score breakdown, `latestRun.provider/model/compositeScore` | **filter: application_scoring** | This is exactly the "scores endpoint" the spec calls out by name ("all existing scoring readers (scores endpoint, stats, Matching Logic UI) filter to `application_scoring`"). Without the filter, `ORDER BY createdAt DESC LIMIT 1` could surface a transcript run (which has no `compositeScore`/`provider` semantics matching a scoring run) as the "latest scoring run," corrupting the Matching Logic display. |
| `ee/server/api/ai-analysis/stats.get.ts:56-129` (7 queries: totalRuns, completedRuns, failedRuns, tokenUsage, dailyRuns, recentRuns, modelBreakdown) | EE "AI Analysis" dashboard (provider health, scoring volume, token/cost breakdown, recent-runs table) | **filter: application_scoring** | Explicitly named in spec as "stats." All 7 queries in this file's `Promise.all` select from `analysisRun` scoped only by `organizationId` (and a 30-day window for two of them) — every one needs the `kind = 'application_scoring'` predicate added, or transcript-analysis runs will inflate "scoring volume" counts, pollute the per-model cost breakdown, and show up in the "recent scoring runs" table alongside actual scoring runs. |
| `server/api/candidates/[id]/export.get.ts:22-34` (`analysisRuns: true` relation, via `candidate.applications.analysisRuns`) | GDPR Art. 15/20 DSAR export (`candidates/[id]/export.get.ts`) | **count both (intended)** | Spec explicitly: "DSAR export ... includes transcripts and analyses." Both scoring and transcript-analysis output are personal data / automated-decision-logic inputs under Art. 15 and must both appear in the subject's data export. |
| `server/scripts/seed.ts:9783-9796` (ad-hoc token/cost sum for console log) | Dev-only seed script debug output ("Compute and log total demo cost") | **n/a (dev script, not a production reader)** | Not reachable from any request path; only sums whatever rows the same seed script inserted (currently scoring-kind only). No product behavior depends on it. If seed.ts is later extended to also insert transcript-analysis demo rows, this sum would silently count both — acceptable for a debug log, but flagged here so it isn't mistaken for a production reader. |

### Write-only / schema / cascade-delete — not readers

| file:line | what it is | classification | justification |
|---|---|---|---|
| `server/database/schema/app.ts:780-934` (`analysisRun` table def, `analysisRunRelations`, indexes) | Drizzle schema definition | **n/a (schema)** | Defines the table/relation shape; does not itself query data. |
| `server/database/migrations/0015_closed_william_stryker.sql`, `0016_first_spyke.sql`, `0033_black_hydra.sql` | Historical DDL (CREATE TABLE, ALTER COLUMN, ADD COLUMN) | **n/a (schema/migration)** | DDL history, not a runtime reader. |
| `server/utils/ai/autoScore.ts:84`, `:135-147` | Insert scoring-kind analysis run rows (auto-scoring on candidate create) | **n/a (write-only)** | `db.insert(analysisRun).values(...)` / `tx.insert(...).returning(...)` — no `select`/`query` on the table. |
| `server/api/applications/[id]/analyze.post.ts:141`, `:204-245` | Insert scoring-kind analysis run rows (manual re-score endpoint) | **n/a (write-only)** | Same — insert-only (`status: 'failed'` error path and the `completed` success path), plus one line (`:245`) that just references `run!.id` from the just-inserted row, not a table read. |
| `server/scripts/delete-demo-org.ts:45` | `db.delete(schema.analysisRun).where(eq(organizationId, orgId))` — demo-org teardown before reseed | **n/a (write-only, both kinds by design)** | Pure delete of every row for the org so `seed.ts` can start clean; not a read, and correctly indiscriminate across `kind` since it's a full-org wipe. |
| `server/utils/ai/pricing.ts:5`, `server/utils/ai/resolveProvider.ts:20` | Doc comments referencing `analysisRun` conceptually | **n/a (comment only)** | No actual query in either file; comments describe where `costUsdMicros` / billing mode are stored. |
| `server/utils/erasure.ts:22` | Doc comment listing `analysis_run` among tables covered by the erasure/retention design | **n/a (comment only)** | No `analysisRun` import or query in this file — it documents the erasure *policy* (implemented via cascade delete + the DSAR export above), not a direct table read. |
| `app/components/ScoreBreakdown.vue:103` | `track('ai_analysis_run', ...)` — client-side analytics event name | **n/a (unrelated string match)** | This is a PostHog/analytics event name string, not a reference to the `analysisRun` drizzle symbol or a DB query; matched only because it contains the substring `analysis_run`. |

## Phase TA1.2 change list

Exact files needing a `kind = 'application_scoring'` filter added to their
`analysisRun` queries:

1. `server/api/applications/[id]/scores.get.ts` — the single "latest analysis run"
   query (lines 50-66).
2. `ee/server/api/ai-analysis/stats.get.ts` — all 7 queries inside the
   `Promise.all` (lines 56-129): `totalRuns`, `completedRuns`, `failedRuns`,
   `tokenUsage`, `dailyRuns`, `recentRuns`, `modelBreakdown`.

Files that must explicitly count BOTH kinds (do NOT add a filter — verify no
filter is accidentally introduced during Phase TA1.2 review):

1. `server/utils/ai/budget.ts` — `countPlatformRuns` and `sumPlatformSpendMicros`.
2. `server/utils/billing/usage.ts` — `countPlatformRuns` (duplicate gate logic;
   keep in lockstep with `budget.ts`).
3. `server/api/candidates/[id]/export.get.ts` — DSAR export relation
   (`analysisRuns: true`).

## Unknown section (`not_observed != absent`)

- `unknown`: whether any **frontend** Vue component queries `analysisRun` data
  through a mechanism other than the two audited API endpoints
  (`scores.get.ts`, `ee/.../stats.get.ts`). The grep sweep found no direct
  DB access from `app/`, and Nuxt server routes are the only DB access layer
  in this codebase's convention, so this is treated as `absent` with high
  confidence — but it is called out explicitly per the "not_observed != absent"
  rule rather than silently assumed.
- `unknown`: whether any not-yet-written test suite will add new
  `analysisRun` queries before Phase TA1.2 lands. Current `tests/` and `e2e/`
  trees have zero references (verified by grep), so there is nothing to
  classify today; this file should be re-run once TA1.2 begins in case new
  test helpers were added in the interim.
