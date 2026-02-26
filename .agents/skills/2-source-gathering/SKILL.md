---
name: 2-source-gathering
description: "Phase 2 of the SEO article pipeline: Source Gathering & Original Input Assembly. Takes the Topic Brief from Phase 1 (Topic Research) and helps assemble the 'original layer' — review synthesis, builder experience, quotable quotes, statistics, visual assets, and competitive gaps. The output is a Source Package that feeds into Phase 3 (Article Drafting). Use after Phase 1 is complete and before any writing begins."
---

# Phase 2: Source Gathering & Original Input Assembly

> **Pipeline position:** Phase 2 of 6 — runs AFTER Phase 1 (Topic Research), BEFORE Phase 3 (Article Drafting).
> **Input:** A completed Topic Brief from Phase 1.
> **Output:** A structured Source Package (see §8) that Phase 3 consumes.
> **Decision gate:** Refuse to proceed without at least ONE category of original input (review data OR builder experience OR original statistics). Without original material, the article will score low on Google's `contentEffort` signal.

---

## When to Use This Skill

- After Phase 1 produces a Topic Brief with a ✅ PROCEED decision
- The user says "gather sources for [topic]" or "assemble inputs for [article]"
- Before ANY Phase 3 drafting — this phase is mandatory

## Critical Principle: Human Provides, AI Organizes

The **human** supplies raw inputs: pasted review excerpts, builder notes, data points. The **AI** synthesizes patterns, formats quotes, identifies gaps, and structures the Source Package. The AI must **never fabricate** review data, quotes, or statistics. If raw material is insufficient, prompt the human explicitly.

---

## Step-by-Step Process

### Step 1: Review Data Collection

**When:** The article involves evaluating, comparing, or mentioning a specific ATS product.
**Skip if:** The article is purely educational with no product references.

Ask the human to paste review excerpts from these platforms. For credible synthesis, aim for **30–50 reviews per product** across sources.

| Platform | What to Extract |
|----------|----------------|
| **G2** | Top 3 praised features, top 3 complaints, switch reasons, reviewer profile (company size, role) |
| **Capterra** | Same categories — note where patterns diverge from G2 |
| **Reddit** (r/recruiting, r/humanresources, r/recruitinghell) | Unfiltered opinions, specific complaints, candid recommendations |
| **TrustRadius** | Longer-form senior buyer reviews — procurement-level concerns |

Once the human provides raw reviews, **quantify patterns**:

- "23% of negative reviews mention pricing opacity" — this specificity makes content original
- Calculate the percentage of reviews mentioning each theme
- Note total reviews analyzed and platforms

**If fewer than 15 reviews:** Flag that synthesis will be weak and ask for more. Proceed only if the human confirms.

### Step 2: Quote Extraction

Select **2–4 direct quotes** from the human-provided review data. Each quote must be:

- **Vivid** — expresses emotion, frustration, or surprise
- **Specific** — mentions a concrete feature, price, or workflow
- **Representative** — reflects a pattern, not an outlier

Format each quote with attribution:

> *"For what we pay, I expected the dashboards to actually be useful."* — G2 reviewer, mid-market recruiter

Never use full names unless publicly attributed. Use: platform, role, and company size.

### Step 3: Builder Experience Notes

**When:** The topic relates to something built or decided in Reqcore.
**Skip if:** The topic has no connection to Reqcore's technical implementation.

Prompt the human with these specific questions:

1. **"What's one technical decision you made related to this topic, and why?"** (e.g., "I chose Drizzle ORM over Prisma because...")
2. **"What problem did you encounter building this, and how did you solve it?"**
3. **"Do you have a number or data point from Reqcore's development?"** (processing time, architecture choice, lines of code, deployment metric)
4. **"What's one thing you learned building this that most people get wrong?"**
5. **"Do you hold an opinion based on building experience that goes against conventional wisdom?"**

Push for at least one concrete, specific answer — not vague generalities.

### Step 4: Data Points & Statistics

Collect **3–5 verifiable statistics** relevant to the article topic.

| Rule | Detail |
|------|--------|
| **Recency** | Prioritize data from the last 2 years |
| **Source URL** | Every stat must have a linkable source — no "studies show" without a URL |
| **Verifiability** | If you cannot verify a stat, flag it with ⚠️ and ask the human to confirm or remove |
| **Relevance** | Each stat must directly support a point in the article outline from the Phase 1 brief |

Use `fetch_webpage` to find statistics from: SHRM, LinkedIn Talent Solutions, Gartner, Deloitte, BLS, and reputable HR tech publications.

### Step 5: Visual Asset Planning

Every article needs at least **one non-stock visual element**. Identify what's needed based on article format:

| Article Type | Visual Assets |
|-------------|--------------|
| **Comparison** | Comparison table (specify columns/rows), feature matrix, pricing table |
| **Technical / How-to** | Terminal screenshots, config file snippets, architecture diagrams |
| **Guide / Explainer** | Process flowchart, decision framework diagram, checklist graphic |
| **Listicle** | Summary table, scoring matrix |
| **All articles** | At least one table or diagram — never publish text-only |

For each visual, specify: type, content/data it should contain, and where in the article it appears.

### Step 6: Competitive Content Analysis

Using the top-ranking pages identified in Phase 1's Content Gap Analysis:

1. **Summarize** what the top 3 ranking articles contain (structure, depth, word count estimate)
2. **Identify specifically** what they lack that our Source Package enables us to include
3. **Map each gap** to the original material gathered in Steps 1–5

This ensures Phase 3 produces content that demonstrably outcompetes existing results.

---

## §8. Output: The Source Package

Compile all gathered materials into this structured format.

```markdown
# Source Package for: [Article Title from Phase 1 Brief]

**Date assembled:** [YYYY-MM-DD]
**Phase 1 Brief:** [reference to the Topic Brief]

---

## 1. Review Synthesis

**Product:** [Competitor name]
**Reviews Analyzed:** [number] across [platforms]

### Top 3 Praised Features
1. [feature] — mentioned in ~X% of positive reviews
2. [feature] — mentioned in ~X% of positive reviews
3. [feature] — mentioned in ~X% of positive reviews

### Top 3 Complaints
1. [complaint] — mentioned in ~X% of negative reviews
2. [complaint] — mentioned in ~X% of negative reviews
3. [complaint] — mentioned in ~X% of negative reviews

**Most Common Switch Reason:** [reason]
**Typical User Profile:** [company size, role, industry]

---

## 2. Quotable User Quotes

1. *"[quote]"* — [source platform], [role], [company size]
2. *"[quote]"* — [source platform], [role], [company size]
3. *"[quote]"* — [source platform], [role], [company size]

---

## 3. Builder Experience (Reqcore)

- [specific experience, decision, or insight relevant to this topic]
- [technical detail or data point from development]
- [contrarian opinion or lesson learned]

---

## 4. Statistics & Data Points

1. [stat] — Source: [URL]
2. [stat] — Source: [URL]
3. [stat] — Source: [URL]

---

## 5. Visual Assets Needed

- [ ] [type]: [description, data it contains, article section]
- [ ] [type]: [description, data it contains, article section]

---

## 6. Competitive Gap Summary

**Top 3 articles for "[primary keyword]" miss:**
1. [gap] — we cover this using: [which source material from above]
2. [gap] — we cover this using: [which source material from above]
3. [gap] — we cover this using: [which source material from above]

---

## Original Input Checklist

- [ ] Review data collected (≥15 reviews)
- [ ] 2–4 vivid, attributed quotes extracted
- [ ] ≥1 builder experience note with specific detail
- [ ] 3–5 statistics with source URLs
- [ ] ≥1 non-stock visual planned
- [ ] Competitive gaps mapped to our original material

**Gate check:** At least ONE of {review data, builder experience, original statistics} must be substantive. If none are, DO NOT pass to Phase 3.
```

---

## §9. Quality Gates

**Do NOT pass the Source Package to Phase 3 if:**

1. **Zero original inputs** — No review data, no builder experience, no original statistics. The article will be generic AI output. Go back and gather material.
2. **All statistics are unverifiable** — Every stat is flagged ⚠️ with no source URL. Remove them or find verifiable alternatives.
3. **Quotes are fabricated** — If the human did not provide real review excerpts, do not invent quotes. Leave the quotes section empty and note it as a gap.
4. **No competitive gap can be filled** — If the gathered materials don't enable the article to beat existing content on any dimension, the topic may need a Phase 1 re-evaluation.

When a gate fails, tell the human exactly what's missing and provide the specific prompts from Step 3 to elicit the needed input.

---

## §10. References

- [Phase 1: Topic Research](../1-topic-research/SKILL.md) — Produces the Topic Brief this phase consumes
- [SEO Skill](../seo-skill/SKILL.md) — On-page SEO rules and E-E-A-T requirements
- [Topical Authority Map](../../../TOPICAL-AUTHORITY-MAP.md) — Content plan context
- [Existing blog content](../../../content/blog/) — Published articles for reference