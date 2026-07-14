# TA0.2 spike — transcript Q/A extraction feasibility

Task: TA0.2 · Spec: `docs/spec/transcript-analysis.md` · Status: complete (desk
analysis only; live-LLM validation deferred, see "What stays unknown" below)

## Method

Built 10 heterogeneous, fully synthetic screening-call transcripts under
`tests/unit/fixtures/transcripts/` (see the README there for the full
per-fixture description) covering the realistic range of formats a recruiter
would paste or upload: clean speaker labels, a Zoom-style VTT export, a
Teams-style export, an unlabeled wall-of-text paste, crosstalk/transcription
noise, multi-part/counter-questions, a very short/sparse call, an embedded
prompt-injection attempt, non-English (Polish) code-switching, and a long
rambling excerpt.

Each fixture was desk-analyzed by hand (no live LLM call) against three
questions:

1. **Speaker labels?** Is there an explicit, parseable turn-boundary marker
   (name/label prefix, timestamp+name line, or VTT cue block)?
2. **Question boundaries detectable?** Can a reader (human or LLM) reliably
   tell where one question ends and the next begins, including compound/
   multi-part questions and counter-questions?
3. **Pairing risk** — the composite judgment of how likely an LLM is to
   mis-attribute an answer to the wrong question, merge two answers, or
   fabricate a pairing where none cleanly exists.

Live LLM calls were **pre-approved** for this spike (see Plans.md plan-time
pre-approval: "external-send — optional live LLM calls ... using the locally
configured dev AI key"), but were **not performed**. Obtaining a working key
through the app's normal dev flow was not trivially available without reading
`.env`/secrets or DB-stored config, which the task explicitly scoped out.
Desk analysis alone was judged sufficient to make the v1 granularity decision
because the deciding factor (see "Decision" below) is structural — detectable
from the raw text — not a property that requires a live model call to assess.

## Feasibility matrix

| Fixture | Speaker labels? | Question boundaries detectable? | Pairing risk |
|---|---|---|---|
| 01 clean-speaker-labeled | Yes — explicit `Recruiter:`/`Candidate:` | Yes — one turn per line, unambiguous | **Low** |
| 02 zoom-vtt-export | Yes — VTT cue + `<v Name>` tag | Yes — cue boundaries double as turn boundaries | **Low** |
| 03 teams-style-export | Yes — `[HH:MM] Name` line | Yes — timestamp line always precedes a new turn | **Low** |
| 04 unlabeled-wall-of-text | **No** — zero markers, single paragraph | Weak — only inferable from content/phrasing, no structural cue | **High** |
| 05 crosstalk-transcription-noise | Yes, but degraded — interruptions split single logical turns across multiple labeled fragments | Partial — boundaries present but blurred by `[inaudible]`/`[crosstalk]` and restarts | **Medium** |
| 06 multi-part-questions-counter-questions | Yes | Partial — a single recruiter turn can contain 2+ questions; a candidate counter-question is answered before the candidate's own original answer resumes, breaking simple strict alternation | **Medium** |
| 07 short-sparse-screening | Yes | Yes — few questions, each atomic | **Low** (structurally easy; separately, statistical confidence in the resulting section scores is inherently low given so little content — a scope note, not a pairing-risk note) |
| 08 prompt-injection-attempt | Yes | Yes — structurally identical to fixture 01 | **Low–Medium** — pairing itself is not the risk here; the risk is a security one (the model must not let injected text override its output schema/verdict). Structural pairing quality is not degraded by the presence of the injected block. |
| 09 non-english-fragments | Yes | Yes — labels present throughout, including during code-switched sentences | **Medium** — pairing (which turn answers which question) is not affected by language; but quoted-evidence quality/scoring nuance may be, which is an evaluation-quality question, not an extraction-quality one, and out of scope for this spike |
| 10 long-rambling-call-excerpt | Yes | Weak *at the sub-topic level* — a single answer digresses across multiple unrelated topics before returning to the original question, so decomposing that turn into fine-grained sub-answers is unreliable | **High** for fine-grained decomposition; **Low** for the coarser "this whole turn is the answer to that question" pairing, since the turn boundary itself is unambiguous |

## Decision

**v1 uses a conditional/adaptive contract, not a fixed choice between
"always per-answer" and "always section-level."** Full rationale and the
concrete server-side contract are recorded in
`docs/spec/transcript-analysis.md` (the "Per-answer breakdown is gated by a
spike (TA0.2)" bullet). Summary:

- A cheap structural heuristic (do ≥70% of non-blank lines match a
  turn-boundary pattern?) runs before the LLM call. Fixtures 01, 02, 03, 05,
  06, 07, 08, 09, 10 all pass this heuristic (some noisily, e.g. 05, but the
  *lines* still carry labels). Fixture 04 fails it outright — this is the
  fixture that makes the "always per-answer" option unsafe: there is no
  structural signal at all to anchor a pairing on, so any per-answer output
  the model produced would be an unverifiable guess dressed up as structured
  fact.
- The LLM additionally self-reports a `pairingConfidence` (0–100); the server
  computes `extractionMode = 'per_answer'` only when the structural heuristic
  passed **and** `pairingConfidence >= 60`. This is what keeps fixtures like
  05 (crosstalk) and 06 (multi-part/counter-questions) from being blindly
  forced into a fine-grained per-answer breakdown when the model itself isn't
  confident in the pairing — they can still land in `'per_answer'` mode if
  the model is confident, but they're not guaranteed to.
- `sectionScores` (topic/category-level) are computed unconditionally in both
  modes, because every fixture — including 04 (unlabeled) and 10 (rambling)
  — has clearly identifiable *topics* even where individual answers can't be
  cleanly isolated. This is the reliable floor: v1 never promises less than
  section-level, and never silently fabricates per-answer precision it can't
  back with evidence.
- `answerBreakdown` is nullable and the UI labels which mode a given run used,
  so a degraded run is visibly degraded rather than silently downgraded.

**Rejected alternatives:**

- *Always per-answer*: unsafe per fixture 04 — no structural anchor, so
  Q/A pairs would be model confabulation, which directly violates the spec's
  "fabricated Q/A pairs are worse than none for an auditable-AI product"
  principle.
- *Always section-level (fixed v1 downgrade)*: unnecessarily throws away real
  value on the 7+ fixtures (01, 02, 03, 07, 08, 09, and usually 06) where
  per-answer pairing is clearly reliable and recruiters would reasonably
  expect the richer breakdown promised in the product contract.

## What stays unknown (`not_observed != absent`)

- **Not observed**: whether a real LLM's `pairingConfidence` self-report is
  well-calibrated (i.e., actually predicts pairing accuracy) on these
  fixtures, versus just restating the structural heuristic's own signal in
  different words. This spike did not make live LLM calls (see "Method"
  above). It is **not** absent evidence that the self-report is unreliable —
  it simply hasn't been tested yet. Deferred to TA3.1, where unit/prompt
  tests (optionally with a live provider, mocked by default) can exercise
  this directly against these same fixtures.
- **Not observed**: real-world transcript formats beyond the 10 modeled here
  (e.g. Google Meet exports, other ATS-native formats, audio-transcription
  vendors with different noise conventions). The 10 fixtures were chosen to
  span the documented risk categories in the spec's Unknowns section
  (speaker labels / VTT / Teams DOCX / crosstalk / non-English), not to be
  exhaustive. If a materially different format shows up in production, the
  structural heuristic in `transcriptAnalysis.ts` should be revisited rather
  than assumed to generalize.
- **Not observed**: how the 60,000-char truncation cap interacts with
  pairing confidence on a transcript that's cut off mid-turn. None of the 10
  fixtures approach that length; this is a distinct concern from Q/A
  extraction and is separately covered by the spec's truncation-marker
  contract.

## Implications for TA3.1 (Zod output schema)

- `answerBreakdown`: nullable array (not an empty-array default) — `null`
  unambiguously means "section-level mode," distinct from "per-answer mode
  but zero answers extracted" (which would itself be a signal worth
  surfacing, e.g. on a near-empty transcript).
- `sectionScores`: always required/present, independent of `answerBreakdown`.
- `extractionMode: z.enum(['per_answer', 'section_level'])`: required, always
  present, computed **server-side** from the structural heuristic +
  self-reported `pairingConfidence` — not trusted verbatim from the model's
  own claim about its mode, to avoid a prompt-injection or hallucination
  vector where the model claims high confidence it doesn't actually have
  (see fixture 08).
- `pairingConfidence: z.number().min(0).max(100)`: part of the raw structured
  output used to *compute* `extractionMode`, but the final `extractionMode`
  value written to the DB should be the server-computed one, clamped exactly
  like `scoring.ts` clamps recommendation/score fields.
- Unit tests for TA3.1/TA5.1 should exercise fixtures 04 (forces
  `section_level`), 01 or 02 (forces `per_answer` under normal confidence),
  and 08 (must not let the injected instructions change `extractionMode`,
  `recommendation`, or bypass the evidence requirement).
