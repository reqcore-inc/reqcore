---
name: 4-technical-seo
description: "Phase 4 of the SEO article pipeline: Technical SEO & Optimization. Runs AFTER the article draft is written in Phase 3. A linting pass that audits title tags, meta descriptions, URL slugs, heading structure, keyword placement, links, featured snippets, LLM citation readiness, frontmatter, and schema.org markup. Produces an SEO audit report and the corrected article."
---

# Phase 4: SEO & Technical Optimization

> **Pipeline position:** Phase 4 of 6 — runs AFTER the article draft (Phase 3) is complete.
> **Input:** A finished Markdown article draft from Phase 3 with frontmatter, plus the Topic Brief from Phase 1.
> **Output:** An SEO audit report (table + score) followed by the corrected/optimized article.
> **Assumption:** Content quality and writing are already handled by Phase 3. This phase focuses exclusively on technical SEO validation and correction.

---

## When to Use This Skill

- After an article draft is complete and ready for SEO review
- When the user asks to "optimize", "audit", or "lint" a blog article for SEO
- When the user asks to check an article's meta tags, headings, or keyword placement
- Before publishing any article to `content/blog/`

---

## Inputs Required

Before starting, collect:
1. **The article Markdown** (draft from Phase 3 or existing file in `content/blog/`)
2. **Primary keyword** (from the Phase 1 Topic Brief)
3. **Secondary keywords** (from the Phase 1 Topic Brief)
4. **Target URL slug** (proposed or existing)

---

## Audit Checklist

Run each check sequentially. Record ✅ (pass), ❌ (fail), or ⚠️ (acceptable but improvable) for every item.

### 1. Title Tag

| # | Check | Rule |
|---|-------|------|
| 1.1 | Character count | 50–60 chars (account for ` — Reqcore` suffix = ~12 extra chars, so frontmatter title should be 50–60 chars) |
| 1.2 | Keyword position | Primary keyword within the first 5 words |
| 1.3 | Modifier present | Includes a compelling modifier: guide, comparison, number, year, checklist, breakdown, etc. |
| 1.4 | Differentiation | Does NOT duplicate the phrasing of likely competitor titles found in the Phase 1 brief |
| 1.5 | Overall score | Rate 1–5. If below 4, output a revised title with specific reasoning |

### 2. Meta Description

| # | Check | Rule |
|---|-------|------|
| 2.1 | Character count | 120–155 chars |
| 2.2 | Keyword included | Primary keyword appears naturally |
| 2.3 | Active voice | Written in active voice, addresses the reader ("you", "your") |
| 2.4 | Expands on title | Adds information beyond the title — not a repetition |
| 2.5 | Value proposition | Communicates a clear reason to click |

### 3. URL Slug

| # | Check | Rule |
|---|-------|------|
| 3.1 | Keyword match | Slug reflects the primary keyword |
| 3.2 | Format | Lowercase, hyphens only, no dates, no function words (the, and, of, a, in) |
| 3.3 | Length | Under 60 characters |
| 3.4 | Uniqueness | No existing article in `content/blog/` uses the same or very similar slug |

### 4. Heading Structure

| # | Check | Rule |
|---|-------|------|
| 4.1 | Single H1 | Exactly one H1 (the Markdown title or frontmatter title) |
| 4.2 | Hierarchy | Logical H2 → H3 nesting, no skipped levels (no H2 → H4) |
| 4.3 | Keyword in H2 | Primary keyword appears in at least one H2 |
| 4.4 | Descriptive headings | No generic headings ("Step 1", "Introduction", "Conclusion"). Every heading is descriptive and query-like |
| 4.5 | Scannable | Someone reading only the headings can understand the full article's argument |

### 5. Keyword Placement

Verify the primary keyword appears in ALL of these positions:

- [ ] Title tag (frontmatter `title`)
- [ ] Meta description (frontmatter `description`)
- [ ] H1 (first `#` heading or frontmatter title)
- [ ] First 100 words of body content
- [ ] At least one H2
- [ ] URL slug
- [ ] At least one image alt text (if images exist)
- [ ] Conclusion/summary section

For each missing position, suggest a **specific, natural insertion** — not "add the keyword somewhere."

### 6. Link Audit

| # | Check | Rule |
|---|-------|------|
| 6.1 | Internal links | 3–5 internal links with keyword-rich anchor text |
| 6.2 | External links | 3–8 external links to authoritative sources (docs, research, official sites) |
| 6.3 | Anchor text quality | No "click here", "read more", or bare URLs as anchor text |
| 6.4 | Internal link validity | All internal links point to existing paths in `content/blog/` or valid site pages (`/jobs`, `/roadmap`, etc.) |
| 6.5 | Link density | No section longer than 300 words without at least one link. Flag violating sections |

### 7. Featured Snippet Optimization

| # | Check | Rule |
|---|-------|------|
| 7.1 | Definition paragraph | First paragraph under H1 directly answers the primary query in 40–60 words (paragraph snippet) |
| 7.2 | How-to format | If article is a how-to: steps use a numbered list |
| 7.3 | Comparison table | If article is a comparison: a comparison table exists within the first 500 words |
| 7.4 | Definition query | If the primary keyword is a "what is" query: a clean 1–2 sentence definition exists |

### 8. LLM Citation Optimization

| # | Check | Rule |
|---|-------|------|
| 8.1 | Self-contained sections | Each H2 section could be extracted and cited independently — no section relies on "as mentioned above" for meaning |
| 8.2 | Declarative claims | Key claims are self-contained, declarative sentences. No hedging: ✅ "A self-hosted ATS stores all candidate data on your infrastructure" ❌ "A self-hosted ATS could potentially help with data storage" |
| 8.3 | FAQ conciseness | If an FAQ section exists, each answer starts with a concise 40–60 word direct answer before expanding |
| 8.4 | No vague language | Flag instances of "might", "could potentially", "it depends", "some people think" in key claims and rewrite them as definitive statements |

### 9. Frontmatter Completeness

Verify all required fields:

| Field | Rule | Status |
|-------|------|--------|
| `title` | 50–60 chars | ✅/❌ (actual count) |
| `description` | 120–155 chars | ✅/❌ (actual count) |
| `date` | YYYY-MM-DD format | ✅/❌ |
| `author` | Real name preferred | ✅/❌ |
| `image` | Valid path, minimum 1200×630px recommended | ✅/❌ |
| `tags` | 3–7 lowercase, hyphenated tags | ✅/❌ (actual count) |

### 10. Schema.org Verification

Confirm the blog article page component (`app/pages/blog/[...slug].vue`) includes the correct `useSchemaOrg()` call. Output the expected structured data block for this specific article:

```typescript
useSchemaOrg([
  defineArticle({
    headline: post.value.title,
    description: post.value.description,
    datePublished: new Date(post.value.date).toISOString(),
    dateModified: new Date(post.value.date).toISOString(),
    author: {
      '@type': 'Person',
      name: 'Joachim',
      url: 'https://reqcore.com',
    },
    image: post.value.image || '/og-image.png',
    publisher: {
      '@type': 'Organization',
      name: 'Reqcore',
      url: 'https://reqcore.com',
    },
  }),
])
```

If the page component is missing this call, flag it as a critical issue and provide the exact code to add.

---

## Output Format

Produce two sections:

### Section A: SEO Audit Report

```markdown
## SEO Audit Report

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | Title Tag (50–60 chars) | ✅/❌ | [actual count], [suggestion if needed] |
| 2 | Meta Description (120–155 chars) | ✅/❌ | [actual count], [suggestion if needed] |
| 3 | URL Slug | ✅/❌ | [current slug], [issue if any] |
| 4 | Heading Structure | ✅/❌ | [issues found] |
| 5 | Keyword Placement (8/8 positions) | ✅/❌ | [X/8 positions filled], [missing positions] |
| 6 | Link Audit | ✅/❌ | [X internal, Y external], [issues] |
| 7 | Featured Snippet | ✅/❌ | [format check result] |
| 8 | LLM Citation Readiness | ✅/❌ | [issues found] |
| 9 | Frontmatter Completeness | ✅/❌ | [missing/invalid fields] |
| 10 | Schema.org | ✅/❌ | [present/missing in page component] |

**Overall SEO Score:** X/10
**Critical Issues:** [list any blockers that must be fixed before publishing]
**Suggested Improvements:** [list nice-to-haves that would improve performance]
```

### Section B: Corrected Article

Output the full corrected Markdown article with all fixes applied. Mark changes with `<!-- SEO FIX: [what was changed] -->` inline comments so the author can review what was modified.

---

## Rules

1. **Be specific.** Every suggestion must be actionable. ❌ "improve the title" → ✅ "move 'open source' to position 1–2 in the title: 'Open-Source ATS: Why Data Ownership Matters'"
2. **Don't rewrite content.** This is a technical pass. Fix placement, structure, and metadata — do not rework paragraphs for style or tone (that's Phase 3's job).
3. **Preserve the author's voice.** When inserting keywords or rewriting headings, match the existing tone.
4. **Check `content/blog/` for slug and link conflicts.** Use file search to verify uniqueness and link validity.
5. **Flag but don't block on images.** If alt text is missing, add it. If no images exist, note it as a suggestion — not a blocker.