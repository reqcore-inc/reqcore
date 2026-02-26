---
name: master-seo-prompt
description: End-to-end SEO article pipeline — runs all 5 phases from topic research to quality gate for a single blog article.
---

# Master SEO Pipeline — Full Article Production

This prompt orchestrates the complete 5-phase SEO article pipeline for Reqcore's blog. Each phase uses its dedicated skill file. Execute phases **sequentially** — each phase's output feeds the next. Stop at any phase if its quality gate fails.

---

## How to Use

1. Provide a **topic or keyword** (ideally from the [Topical Authority Map](../../TOPICAL-AUTHORITY-MAP.md))
2. The agent runs all 5 phases in order, pausing at decision gates
3. Each phase produces a structured deliverable that feeds the next
4. The final output is a publish-ready Markdown article in `content/blog/`

---

## Pipeline Overview

| Phase | Name | Skill | Input | Output |
|-------|------|-------|-------|--------|
| 1 | Topic Research & Validation | `1-topic-research` | Topic/keyword | Topic Brief |
| 2 | Source Gathering | `2-source-gathering` | Topic Brief | Source Package |
| 3 | Article Drafting | `3-article-draft` + `seo-skill` | Topic Brief + Source Package | Draft Markdown article |
| 4 | Technical SEO Optimization | `4-technical-seo` | Draft article + Topic Brief | SEO Audit Report + Corrected article |
| 5 | Human Review & Quality Gate | `5-review-quality` | Final article + Source Package | Quality Gate Report + Action items |

---

## Phase 1: Topic Research & Validation

> **Skill:** Read and follow `.agents/skills/1-topic-research/SKILL.md`

### What to Do

1. **Keyword Validation** — Identify primary keyword, 3–5 secondary keywords, assess ranking difficulty via SERP analysis
2. **Search Intent Classification** — Classify as informational/commercial/transactional/navigational; determine article format (guide, listicle, comparison, how-to, opinion, glossary)
3. **Cannibalization Check** — Scan all existing files in `content/blog/` for overlap in title, keyword, intent, and content
4. **Content Gap Analysis** — Fetch and analyze top 5–10 ranking pages; extract PAA questions; identify what competitors miss
5. **Original Angle Identification** — Define 2–3 unique angles from builder experience, review data, contrarian opinions, original data, or technical depth
6. **Internal Link Planning** — Plan 3–5 outgoing links and 2–3 incoming links for topical authority reinforcement
7. **Business Potential Scoring** — Score 1–3 for Reqcore alignment; recommend a natural CTA

### Output

A structured **Topic Brief** (see the template in the skill file §8).

### Decision Gate

**STOP if any of these are true:**
- Business potential = 1 (no natural Reqcore connection)
- High cannibalization with no resolution path
- Cannot find at least 2 original angles
- Transactional or navigational intent (not a blog topic)

If stopping, recommend a specific alternative topic from the Topical Authority Map.

---

## Phase 2: Source Gathering & Original Input Assembly

> **Skill:** Read and follow `.agents/skills/2-source-gathering/SKILL.md`

### What to Do

1. **Review Data Collection** — Ask the human to paste review excerpts from G2, Capterra, Reddit, TrustRadius (aim for 30–50 reviews per product). Quantify patterns as percentages
2. **Quote Extraction** — Select 2–4 vivid, specific, representative direct quotes with attribution
3. **Builder Experience Notes** — Prompt the human with the 5 specific questions from the skill file. Push for at least one concrete, specific answer
4. **Data Points & Statistics** — Collect 3–5 verifiable statistics with source URLs. Use `fetch_webpage` for SHRM, LinkedIn, Gartner, Deloitte data
5. **Visual Asset Planning** — Identify at least 1 non-stock visual (comparison table, diagram, flowchart, code snippet) per article type
6. **Competitive Content Analysis** — Summarize top 3 ranking articles, map gaps to gathered original material

### Output

A structured **Source Package** (see the template in the skill file §8).

### Decision Gate

**STOP if:**
- Zero original inputs (no review data AND no builder experience AND no original statistics)
- All statistics are unverifiable
- No competitive gap can be filled with gathered materials

When a gate fails, tell the human exactly what's missing and provide the specific prompts from Step 3 to elicit it.

### Critical Rule

**Human provides, AI organizes.** Never fabricate review data, quotes, or statistics. If material is insufficient, prompt the human explicitly.

---

## Phase 3: Article Drafting

> **Skill:** Read and follow `.agents/skills/3-article-draft/SKILL.md` for drafting instructions.
> **Also reference:** `.agents/skills/seo-skill/SKILL.md` for on-page SEO rules, content structure, and the blog article template.

### What to Do

1. **Follow the H2 outline** from the Phase 1 Topic Brief
2. **Weave in original material** from the Phase 2 Source Package — review synthesis, quotes, builder experience, statistics, and visual assets
3. **Apply blog article template** from the SEO Skill (§14) as the structural foundation
4. **Write for the target audience** — recruiters, HR leaders, developers, founders evaluating ATS tools

### Writing Rules (from the SEO Skill)

- **First 100 words**: Include primary keyword, lead with the key takeaway, use a declarative sentence that answers the search query
- **Heading hierarchy**: One H1 (title), descriptive H2s with keyword variations, H3s for supporting detail
- **Paragraphs**: 2–4 sentences max. No walls of text
- **Formatting**: Use bullet/numbered lists, bold key phrases, tables for comparisons, block quotes for stats/opinions
- **Keyword placement**: Primary keyword in title, description, H1, first 100 words, at least one H2, URL slug, conclusion. 5–10 natural mentions in 2000+ words
- **Links**: 3–5 internal links (keyword-rich anchor text), 3–8 external links to authoritative sources
- **LLM-ready**: Each H2 section stands alone as a citable chunk. Key points are quotable, declarative sentences. Include an FAQ section addressing PAA questions
- **No AI voice artifacts**: No "In today's competitive...", "Let's dive in", "It's important to note", "When it comes to...", "Whether you're a X or a Y", "Look no further", "Game-changer", "Comprehensive guide", "Stands out from the crowd"
- **CTA**: End with a natural Reqcore mention and CTA from the Topic Brief's business potential assessment

### Frontmatter Requirements

```yaml
---
title: "[Primary Keyword] — [Compelling Modifier]"  # 50–60 chars
description: "[Value prop with primary keyword, active voice]"  # 120–155 chars
date: YYYY-MM-DD
author: "Author Name"
image: "/og-image.png"
tags: ["primary-keyword", "related-1", "related-2", "ats", "recruitment"]  # 3–7 tags
---
```

### Output

A complete Markdown article draft saved to `content/blog/[slug].md` with full frontmatter.

### Quality Bar

- Every H2 section contains at least 1 original element (data, quote, builder insight, opinion)
- Article format matches the SERP-dominant format identified in Phase 1
- No section is generic filler — every paragraph adds new information
- Mark any unverified claims with `<!-- [VERIFY] -->` for Phase 5 to catch

---

## Phase 4: Technical SEO & Optimization

> **Skill:** Read and follow `.agents/skills/4-technical-seo/SKILL.md`

### What to Do

Run the **10-point SEO audit checklist** against the Phase 3 draft:

1. **Title Tag** — 50–60 chars, keyword in first 5 words, modifier present, differentiated from competitors
2. **Meta Description** — 120–155 chars, keyword included, active voice, expands on title, clear value prop
3. **URL Slug** — Keyword-based, lowercase hyphens, under 60 chars, unique in `content/blog/`
4. **Heading Structure** — Single H1, logical H2→H3 nesting, keyword in at least one H2, descriptive headings, scannable
5. **Keyword Placement** — Verify all 8 positions: title, description, H1, first 100 words, H2, URL slug, image alt, conclusion
6. **Link Audit** — 3–5 internal links, 3–8 external links, keyword-rich anchors, no section >300 words without a link
7. **Featured Snippet Optimization** — Definition paragraph (40–60 words), how-to numbered lists, comparison tables within first 500 words
8. **LLM Citation Optimization** — Self-contained sections, declarative claims, concise FAQ answers, no vague hedging language
9. **Frontmatter Completeness** — All required fields present and within spec
10. **Schema.org Verification** — Confirm `useSchemaOrg([defineArticle({...})])` in the blog page component

### Output

Two deliverables:
- **SEO Audit Report** — Table with ✅/❌/⚠️ per check, overall score X/10, critical issues, suggested improvements
- **Corrected Article** — Full Markdown with all fixes applied, changes marked with `<!-- SEO FIX: [what was changed] -->` comments

### Rules

- Be specific — every suggestion is actionable with exact text
- Don't rewrite content for style/tone — only fix placement, structure, metadata
- Preserve the author's voice
- Check `content/blog/` for slug and link conflicts
- Flag but don't block on missing images

---

## Phase 5: Human Review & Quality Gate

> **Skill:** Read and follow `.agents/skills/5-review-quality/SKILL.md`

### What to Do

Run the **7-section quality audit** against the Phase 4 output:

1. **Originality Check** — ≥2 elements absent from top 10 results, every H2 has ≥1 original element, removal test (strip original content — would remainder still be publishable? If yes → FAIL)
2. **AI Voice Detection** — Scan for banned phrases, hedging without substance, preamble, padding, summary-as-conclusion. Read the intro aloud — if it sounds like a language model, rewrite
3. **Factual Accuracy** — Verify competitor claims against current websites, verify all statistics have linkable sources, cross-reference quotes against Source Package, resolve all `[VERIFY]` flags, check technical claims
4. **Internal Link Validation** — ≥3 internal links, all point to real pages, descriptive anchor text, contextually natural placement
5. **Personal Touch Insertion Points** — Identify 2–3 specific locations for builder experience, specific details only the author would know, genuine opinions
6. **Readability & Flow** — Logical progression, transition sentences, balanced section lengths, intro→promise/conclusion→delivery arc
7. **Final Quality Bar** — Would you share this on Reddit without embarrassment? Would a recruiter learn something new? Would you trust this article?

### Output

A **Quality Gate Report** with pass/fail per section and a final verdict:

- **✅ PUBLISH** — Article is ready
- **🔶 PUBLISH AFTER FIXES** — Specific action items listed
- **❌ DO NOT PUBLISH** — Originality or factual accuracy failed; fix before re-review

### Hard Rule

**If Originality fails → verdict is ❌ DO NOT PUBLISH. No exceptions.** Fix originality before reviewing anything else.

---

## Post-Pipeline: Publishing Checklist

After Phase 5 passes, complete these final steps:

1. **Save article** to `content/blog/[slug].md`
2. **Update incoming links** — Edit the 2–3 existing articles identified in Phase 1's internal link plan to add links to the new article
3. **Verify sitemap** — Confirm the new article appears in the dynamic sitemap at `server/api/__sitemap__/urls.ts`
4. **Verify schema** — Check that `app/pages/blog/[...slug].vue` has the correct `useSchemaOrg([defineArticle({...})])` call
5. **Run Snyk scan** — Per project security rules, scan any new/modified code
6. **Update CHANGELOG.md** — Add an entry for the new article

---

## Quick Reference: Skill File Locations

| Phase | Skill File |
|-------|-----------|
| 1 — Topic Research | `.agents/skills/1-topic-research/SKILL.md` |
| 2 — Source Gathering | `.agents/skills/2-source-gathering/SKILL.md` |
| 3 — Article Draft | `.agents/skills/3-article-draft/SKILL.md` + `.agents/skills/seo-skill/SKILL.md` |
| 4 — Technical SEO | `.agents/skills/4-technical-seo/SKILL.md` |
| 5 — Quality Gate | `.agents/skills/5-review-quality/SKILL.md` |
| General SEO | `.agents/skills/seo-skill/SKILL.md` |

---

## Important Context Files

- [Topical Authority Map](../../TOPICAL-AUTHORITY-MAP.md) — The 132-article content plan with clusters, phases, and cross-linking rules
- [Existing blog content](../../content/blog/) — Published articles for cannibalization checks and internal linking
- [Product Vision](../../PRODUCT.md) — Reqcore's UVP, audience, and positioning
- [Copilot Instructions](../copilot-instructions.md) — Codebase conventions, design system, and project structure