---
name: 5-review-quality
description: "Phase 5 of the SEO article pipeline: Human Review & Quality Gate. Run AFTER Phase 4 (Technical SEO), BEFORE publishing. AI-assisted checklist that audits an article for originality, AI voice artifacts, factual accuracy, internal links, readability, and personal touch. Designed to catch the specific failure modes of AI-generated content. Outputs a pass/fail Quality Gate Report with actionable fixes."
---

# Phase 5 — Human Review & Quality Gate

**Role**: Strict editor. Your job is to find reasons NOT to publish.

**Input**: Final article from Phase 4 + Phase 2 Source Package.
**Output**: Quality Gate Report (pass/fail per section, specific fixes, final verdict).

**Hard rule**: If Originality fails → verdict is ❌ DO NOT PUBLISH. No exceptions.

---

## 1. Originality Check

- [ ] Article contains **≥ 2 elements** absent from the current top 10 Google results for the target keyword
- [ ] Every major section (H2) has **≥ 1 original element**: proprietary data, review synthesis, builder insight, or genuine opinion
- [ ] **Removal test**: if you strip all original-layer content, would the remainder still be publishable? If yes → FAIL (not enough original input)
- [ ] No section reads like a paraphrase of existing SERPs

**If this section fails, stop. Fix originality before reviewing anything else.**

---

## 2. AI Voice Detection

Read the intro aloud. If it sounds like a language model, rewrite it.

**Banned phrases** (find & kill):
`In today's competitive...` · `Let's dive in` · `It's important to note` · `When it comes to...` · `Whether you're a X or a Y` · `In the world of...` · `Look no further` · `Game-changer` · `Comprehensive guide` · `Stands out from the crowd`

- [ ] No hedging without substance ("both have their merits" without saying which and why)
- [ ] No preamble — first paragraph delivers value immediately
- [ ] No padding — every paragraph adds **new** information (not a reword of the previous one)
- [ ] No list items that say the same thing with different adjectives
- [ ] Conclusion is a genuine take, not a summary of headings

**Test**: Read any random paragraph. Can you tell a human wrote it? If not → rewrite.

---

## 3. Factual Accuracy

- [ ] Every competitor feature/pricing claim is verified against the vendor's current website
- [ ] Every statistic has a real, linkable source (no "studies show" without citation)
- [ ] Review quotes cross-referenced against Phase 2 Source Package — accurate attribution, not paraphrased
- [ ] All `[VERIFY]` flags from Phase 3 resolved (search the document — zero remaining)
- [ ] Technical claims (deployment steps, config, commands) tested or verified against docs
- [ ] No hallucinated product names, feature names, or integrations

---

## 4. Internal Link Validation

- [ ] **≥ 3 internal links** present
- [ ] Every internal link points to a **real, published** page (click each one)
- [ ] Anchor text is descriptive and keyword-relevant (not "this article", "click here", "read more")
- [ ] Links are contextually natural, not shoehorned
- [ ] At least one link to a product/feature page, at least one to another blog post

---

## 5. Personal Touch Insertion Points

Identify **2–3 specific locations** (by section heading) where the human must add:

- [ ] A sentence grounded in **builder experience** (building Reqcore — architecture decision, tradeoff, lesson learned)
- [ ] A **specific detail only the author would know** (user feedback, support conversation, metric, failed experiment)
- [ ] A **genuine opinion** the AI could not have generated (a recommendation, a warning, a preference with reasoning)

Format output as:
```
→ Insert builder experience at: [Section Heading] — suggested angle: ...
→ Insert opinion at: [Section Heading] — suggested angle: ...
```

---

## 6. Readability & Flow

- [ ] Sections follow a logical progression (problem → context → solution → action)
- [ ] Transition sentences connect major sections (no abrupt topic jumps)
- [ ] No section is > 2× the length of the shortest section (unless justified)
- [ ] Intro sets up the article's promise; conclusion delivers on it
- [ ] Subheadings are scannable — a reader skimming only H2/H3s understands the article's arc

---

## 7. Final Quality Bar

Answer honestly:

1. **Would I share this on Reddit without embarrassment?**
2. **Would a recruiter learn something they can't get from the top 3 existing results?**
3. **Would I trust this article if I found it while researching ATS tools?**

Any "no" → do not publish. Improve or shelve.

---

## Output Format

```
## Quality Gate Report

**Article**: [title]
**Target keyword**: [keyword]
**Date**: [date]

### Originality: ✅ PASS / ❌ FAIL
[specific findings — what's original, what's not]

### AI Voice: ✅ PASS / ❌ FAIL
[flagged phrases with line locations and suggested rewrites]

### Factual Accuracy: ✅ PASS / ❌ FAIL
[claims to verify or correct, unresolved [VERIFY] flags]

### Internal Links: ✅ PASS / ❌ FAIL
[broken links, missing links, weak anchor text]

### Personal Touch: 🔶 NEEDS ADDITION
→ Insert builder experience at: [section]
→ Insert opinion at: [section]
→ Insert specific detail at: [section]

### Readability: ✅ PASS / ❌ FAIL
[flow issues, disproportionate sections, weak transitions]

---

### Final Verdict: ✅ PUBLISH / 🔶 PUBLISH AFTER FIXES / ❌ DO NOT PUBLISH

**Action items before publishing:**
1. [specific fix]
2. [specific fix]
3. [specific fix]
```

**Reminder**: If articles pass this gate easily and consistently, raise the bar. A quality gate that never blocks is not a quality gate.