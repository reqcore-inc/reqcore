# Transcript fixtures (TA0.2 spike)

All fixtures are **fully synthetic** — invented names, companies, and events.
No real recruiter, candidate, or company is represented. Built for the
Screening Transcript Analysis spike (`docs/spec/transcript-analysis.md`,
task TA0.2) to desk-test whether per-answer Q/A pairing is reliable across
the range of transcript formats/quality a recruiter might realistically
paste or upload.

Feasibility analysis and the resulting v1 granularity decision live in
`docs/research/ta0.2-transcript-spike.md`. These fixtures are also reused
as unit-test assets for `TA3.1` (Zod schema / injection-resistance tests)
and `TA5.1` (parser fixtures).

| # | File | What it covers |
|---|------|-----------------|
| 01 | `01-clean-speaker-labeled.txt` | Best case: consistent `Recruiter:` / `Candidate:` labels, one turn per line, clean prose. |
| 02 | `02-zoom-vtt-export.txt` | Zoom-style WebVTT export: cue numbers, timestamp ranges, `<v Name>` speaker tags. Tests whether a non-`Label:` speaker convention still pairs cleanly. |
| 03 | `03-teams-style-export.txt` | Microsoft Teams export style: `[HH:MM]` timestamp + full name on its own line, then the utterance on the next line. |
| 04 | `04-unlabeled-wall-of-text.txt` | Worst case for pairing: no speaker markers, no line breaks, no punctuation-based turn cues — a single unbroken paste, as a recruiter copying from a chat window without formatting might produce. |
| 05 | `05-crosstalk-transcription-noise.txt` | Speaker-labeled but with interruptions, restarts, `[inaudible]` markers, `[crosstalk]` markers, and mid-sentence trail-offs — simulates auto-transcription artifacts. |
| 06 | `06-multi-part-questions-counter-questions.txt` | Recruiter asks compound/multi-part questions in one turn; candidate also asks counter-questions mid-answer, which the recruiter answers before the candidate's original answer resumes. Tests Q/A boundary detection when one "turn" contains more than one logical Q or A. |
| 07 | `07-short-sparse-screening.txt` | Very short call (~15 min in-fiction), only 3 substantive questions. Tests the lower bound: is there even enough content for a meaningful per-answer breakdown, or does section-level scoring make more sense when the whole transcript is this thin? |
| 08 | `08-prompt-injection-attempt.txt` | Candidate speech contains an embedded prompt-injection attempt ("Ignore all previous instructions...", a fake "SYSTEM NOTE" block) framed as if it were part of the transcript. Doubles as a test asset for TA3.1 (schema/output must not be hijacked) and TA5.1 (injection-resistance unit test). |
| 09 | `09-non-english-fragments.txt` | Otherwise-English interview where the candidate switches into Polish for short thinking-out-loud fragments, sometimes self-translating, sometimes not. Tests whether Q/A pairing and evidence-quoting survive code-switching. |
| 10 | `10-long-rambling-call-excerpt.txt` | Excerpt of a long call where answers ramble across multiple tangents (an incident story that digresses into an unrelated deploy-pipeline story) before looping back to the original question. Tests whether a single "answer" can be reliably scoped when it doesn't stay on-topic. |

## Conventions

- Plain text (`.txt`), UTF-8. Fixture 02 uses WebVTT-flavored plain text but
  is still a `.txt` file (real Zoom exports are commonly re-saved/pasted as
  plain text by recruiters, not uploaded as raw `.vtt`).
- All names, companies, and event details are invented for this fixture set.
- Numbers in filenames are stable identifiers — don't renumber existing
  fixtures when adding new ones; append instead.
