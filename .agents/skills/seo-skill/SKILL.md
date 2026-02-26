---
name: seo-skill
description: Organic SEO optimization for blog articles, landing pages, and public content. Use when writing, reviewing, or improving Markdown blog posts, page metadata, structured data, or any content intended to rank on Google Search and get cited by AI assistants (ChatGPT, Perplexity, Gemini). Covers on-page SEO, E-E-A-T, keyword strategy, content structure, schema markup, and AI/LLM visibility.
---

# SEO Skill — Maximize Organic Search Ranking & AI Visibility

This skill provides actionable rules for writing and optimizing content that ranks at the top of Google Search and gets cited by AI assistants. Every rule is grounded in Google's official documentation, industry-leading SEO research (Ahrefs, Backlinko), and adapted to the Reqcore tech stack (`@nuxt/content` v3, `@nuxtjs/seo`, Nuxt 4).

**When to use this skill:**
- Writing or reviewing blog articles (`content/blog/*.md`)
- Setting `useSeoMeta()` or `useSchemaOrg()` on any page
- Creating landing pages, feature pages, or public-facing content
- Optimizing existing content for better rankings
- Planning content strategy or choosing topics

---

## 1. Content Strategy & Topic Selection

### 1.1 Target One Primary Keyword Per Article
- Every article targets **one** primary keyword (e.g., "self-hosted ATS", "open-source applicant tracking system").
- The primary keyword should have search volume, be relevant to Reqcore's audience (recruiters, HR teams, CTOs), and have realistic ranking difficulty.
- Use long-tail variants to capture specific search queries (e.g., "self-hosted ATS vs cloud ATS comparison").

### 1.2 Match Search Intent
Before writing, search the primary keyword on Google and analyze the top 10 results:
- **Informational intent** → Write a comprehensive guide or comparison
- **Commercial investigation** → Write a "best X" list or comparison with alternatives
- **Transactional intent** → Create a landing/product page, not a blog post
- Match the **content format** (guide, listicle, comparison, how-to) that dominates page 1

### 1.3 Business Potential Score
Prioritize topics where Reqcore can be naturally mentioned as a solution. Rank topics 1–3:
- **3 (High)**: Reqcore is an irreplaceable solution (e.g., "best open-source ATS")
- **2 (Medium)**: Reqcore can be mentioned naturally (e.g., "ATS data ownership guide")
- **1 (Low)**: Tangential topic, brand mention feels forced (e.g., "remote work trends")

Focus on topics scoring 2–3.

---

## 2. Article Frontmatter (Markdown YAML)

Every blog post in `content/blog/*.md` MUST include complete frontmatter:

```yaml
---
title: "Primary Keyword — Compelling Modifier | Brand Context"
description: "A 120–155 character meta description that includes the primary keyword, communicates value, and uses active voice."
date: 2026-02-22
author: "Reqcore Team"
image: "/og-image.png"
tags: ["primary-keyword", "related-term-1", "related-term-2", "ats", "recruitment"]
---
```

### Frontmatter Rules

| Field | Rules |
|-------|-------|
| `title` | 50–60 characters. Include primary keyword near the front. Use a compelling modifier (e.g., "Definitive Guide", "Practical Comparison", number). Avoid clickbait. |
| `description` | 120–155 characters. Expand on the title with additional value. Include primary keyword. Use active voice. Address the searcher directly. |
| `date` | ISO date format (YYYY-MM-DD). Must reflect actual publish or substantial update date. Never backdate for freshness illusion. |
| `author` | Real person name preferred for E-E-A-T. "Reqcore Team" acceptable for team-authored content. |
| `image` | Path to a representative OG image. Use article-specific images when possible (minimum 1200×630px). |
| `tags` | 3–7 lowercase tags. Include primary keyword, topical category, and 2–3 related terms. |

---

## 3. Title Tag Optimization

The title tag is the single most impactful on-page SEO element. It directly influences rankings and click-through rate.

### Rules
1. **50–60 characters** (under 70 characters absolute max to avoid truncation)
2. **Primary keyword as close to the front as possible** — Google weights early keywords more
3. **Include a compelling modifier**: "Guide", "Comparison", numbers, current year (when freshness matters)
4. **Match search intent** — the title must tell searchers you have what they want
5. **Stand out from competitors** — scan SERP titles and differentiate
6. **Use positive emotion** — modifiers like "Practical", "Complete", "Essential" perform well. Avoid "insane", "unbelievable" (clickbait penalty)
7. **Add the current year** only for topics that demand freshness (e.g., "Best ATS 2026") — do NOT put the year in the URL slug
8. **Nuxt title template**: The `nuxt.config.ts` appends ` — Reqcore` via `titleTemplate: '%s — Reqcore'`. Account for this in total character count (~12 extra chars). Set the title via `useSeoMeta({ title: '...' })`, not `useHead({ title: '...' })`

### Title Formulas That Work
- `[Primary Keyword]: [Benefit or Outcome]` → "Self-Hosted ATS: Full Data Ownership Without the SaaS Tax"
- `[Number] [Noun] [Keyword] [Modifier]` → "7 Open-Source ATS Platforms Compared (2026)"
- `[Keyword] — [Adjective] [Benefit] ([Confidence Booster])` → "ATS Migration — A Practical Guide (With Checklist)"
- `[Question format]` → "Is a Self-Hosted ATS Worth It? A Cost Breakdown"

---

## 4. Meta Description Optimization

Meta descriptions are NOT a ranking factor, but they influence CTR (Google uses them ~37% of the time as the snippet). They also influence AI assistant citation selection.

### Rules
1. **120–155 characters** (under 160 absolute max)
2. **Include the primary keyword** — Google bolds matching terms in the snippet
3. **Expand on the title** — add information not already in the title
4. **Use active voice** — address the searcher directly: "Learn...", "Discover...", "Compare..."
5. **Communicate clear value** — what will the reader gain?
6. **Front-load important information** — critical details first, in case of truncation
7. Set via the `description` frontmatter field AND `useSeoMeta({ description: '...' })`

### Example
```
Title: "Self-Hosted vs Cloud ATS: Pros, Cons, and When to Switch"
Description: "A practical comparison of self-hosted and cloud-based applicant tracking systems. Learn the trade-offs in cost, data ownership, privacy, and control."
```

---

## 5. URL Structure

URLs are a lightweight ranking factor and a strong user trust signal.

### Rules
1. **Use the primary keyword as the URL slug**: `/blog/self-hosted-vs-cloud-ats`
2. **Keep slugs short and readable** — drop function words (for, and, or, to, the)
3. **Never include dates in slugs** — content should be updatable without changing the URL
4. **Use lowercase, hyphens only** — no underscores, no uppercase, no special characters
5. **No trailing slashes** in links
6. In Reqcore, blog URLs are derived from the filename: `content/blog/self-hosted-vs-cloud-ats.md` → `/blog/self-hosted-vs-cloud-ats`

### Good vs Bad URLs
```
✅ /blog/self-hosted-ats-guide
✅ /blog/open-source-ats-comparison
❌ /blog/2026-02-18-self-hosted-ats
❌ /blog/article-about-self-hosted-ats-and-cloud-ats-comparison-guide
❌ /blog/Self_Hosted_ATS
```

---

## 6. Content Structure & On-Page SEO

### 6.1 Heading Hierarchy
- **One H1 per page** — this is the article title (rendered from frontmatter `title`)
- **H2 for major sections** — each H2 should cover a distinct subtopic
- **H3+ for supporting sections** — examples, details, sub-arguments
- **Include the primary keyword** in at least one H2
- **Include related keywords** naturally in other H2s and H3s
- **Use descriptive, query-like headings** — "How to Migrate from a Cloud ATS" beats "Step 3"
- Headings should let someone skim the article and understand the full argument

### 6.2 First 100 Words
- **Include the primary keyword** in the first 100–150 words
- **Lead with the key takeaway** — Google and AI systems weight early content
- Open with what the article delivers, not background preamble
- Use a declarative sentence that directly answers the search query (optimizes for featured snippets and AI Overviews)

### 6.3 Keyword Placement
Place the primary keyword naturally in:
- Title tag (frontmatter `title`)
- Meta description (frontmatter `description`)
- H1 heading (same as title)
- First 100 words of body content
- At least one H2 subheading
- Alt text of the primary image
- URL slug (filename)
- Conclusion/summary section

**Keyword frequency**: Use the primary keyword 5–10 times in a 2000+ word article. Never stuff — every mention should read naturally.

### 6.4 Content Depth & Content Gaps
- **Comprehensive coverage** of the topic — aim to be the most complete resource on page 1
- **Fill content gaps**: Search the primary keyword, analyze what top-ranking pages cover, and ensure your article covers those subtopics plus unique angles
- **Answer "People Also Ask" questions** — Google's PAA box reveals related questions; address them as H2/H3 sections
- **Cover related long-tail queries** as subsections
- Don't pad word count artificially — Google has no preferred word count. Quality and completeness matter.
- Minimum **1,500 words** for competitive informational queries; 800–1,200 for focused comparison or opinion pieces

### 6.5 Content Formatting for Readability & LLM Visibility
- **Short paragraphs** — 2–4 sentences max
- **Bullet and numbered lists** for scannable information
- **Bold key phrases** for emphasis and skimmability
- **Tables for comparisons** — structured data that LLMs can parse and cite
- **Block quotes** for key statistics or expert opinions
- Use semantic HTML elements (`<table>`, lists, headings) — not just visual formatting
- **White space** between sections — don't create walls of text

---

## 7. LLM & AI Visibility Optimization

AI assistants (ChatGPT, Perplexity, Gemini, Google AI Overviews) increasingly cite web content. Optimizing for LLMs is now a core part of SEO.

### 7.1 Structure for LLM Summarization
- **Semantic chunking**: Each H2 section should stand alone as a mini-resource that can be extracted and cited independently
- **Lead with the answer**: Start each section with a clear, concise response, then expand with supporting details
- **Make key points quotable**: Write authoritative, self-contained sentences that convey complete ideas
- **Use declarative sentences**: "A self-hosted ATS stores all candidate data on infrastructure you control." — not vague or conditional language
- **Include FAQ sections**: Add a Q&A section at the end with real questions people search for — LLMs match these to queries

### 7.2 AI Citation Signals
ChatGPT selects sources based on:
1. URL relevance
2. Title quality
3. Snippet/meta description clarity
4. Ranking position
5. Publishing date freshness

All of these are on-page SEO factors you directly control.

### 7.3 Featured Snippet & Zero-Click Optimization
- Write **definition-style paragraphs** (40–60 words) directly after questions — these get pulled into featured snippets
- Use **numbered lists** for "how-to" or "steps" queries
- Use **tables** for comparison queries
- Open the article with the core answer, then elaborate

---

## 8. E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)

Google's quality rater guidelines prioritize E-E-A-T. While not a direct ranking factor, it reflects what Google's algorithms aim to reward.

### 8.1 Demonstrate Expertise
- **Author byline** with real name when possible
- Link to author bio or about page (currently `/` or a dedicated team page)
- Show **first-hand experience**: reference actual product usage, real data, real workflows
- For Reqcore content: include screenshots, code snippets, or configuration examples that prove familiarity
- **Cite authoritative sources**: link to Google documentation, industry reports, credible studies

### 8.2 Build Authoritativeness
- **Include original data or analysis** — cost comparisons, feature matrices, benchmarks that nobody else has
- **Reference Reqcore's own product** as a case study when relevant
- **Expert quotes** for topics outside direct expertise (e.g., legal compliance, privacy law)
- Consistently publish on your core topic (ATS, recruitment, hiring tech) to build topical authority

### 8.3 Ensure Trustworthiness
- **Factual accuracy** — every claim must be verifiable
- **No easily-verified factual errors**
- **Transparent about AI usage** — if AI assisted content creation, disclose it appropriately
- **Clear sourcing** — link to sources for statistics and claims
- **Professional presentation** — no spelling errors, no sloppy formatting

---

## 9. Internal & External Linking

### 9.1 Internal Links
- **Link to 3–5 related internal pages** from every blog article
- Use **keyword-rich anchor text** — not "click here" or "read more"
- Link to product pages (`/`, `/roadmap`, `/auth/sign-in`) and other blog posts
- Use the **hub-and-spoke model**: pillar content (comprehensive guide) links to/from spoke articles (specific subtopics)
- Link from high-authority pages to new content that needs a ranking boost
- Use natural placement — within the body text, not forced footer link lists

### 9.2 External Links
- **Link to authoritative external sources**: Google documentation, industry reports, respected publications
- External links build trust and add value for readers
- 3–8 external links per article is typical
- Periodically check for broken external links
- Never link to competitors' product pages unless genuinely useful for the reader

### 9.3 Anchor Text Best Practices
```markdown
✅ "Learn more about [self-hosted ATS advantages](/blog/self-hosted-vs-cloud-ats)"
✅ "As Google's [SEO Starter Guide](https://developers.google.com/...) explains..."
❌ "[Click here](/blog/self-hosted-vs-cloud-ats) to read more"
❌ "Read [this article](/blog/self-hosted-vs-cloud-ats)"
```

---

## 10. Image Optimization

### Rules
1. **Descriptive filenames**: `self-hosted-ats-cost-comparison.png` not `IMG_859045.png`
2. **Alt text on every image**: Describe the image content, include keyword naturally if relevant
   - `alt="Cost comparison table showing self-hosted ATS at $360 vs cloud ATS at $36,000 over 3 years"`
   - Don't keyword-stuff alt text
3. **Compress images**: Use WebP or optimized PNG/JPEG. Target under 100KB per image
4. **Use descriptive captions** when they add value
5. **Serve responsive images**: Use `srcset` or Nuxt's image optimization when available
6. **Lazy load** images below the fold (Nuxt handles this by default)
7. Provide images at **multiple aspect ratios** for OG/schema: 16:9, 4:3, 1:1 are ideal

---

## 11. Structured Data (Schema.org)

Reqcore uses `@nuxtjs/seo` which auto-generates schema. Always enhance it.

### 11.1 Blog Articles — Required Schema
Every blog article page (`app/pages/blog/[...slug].vue`) must use:

```typescript
useSchemaOrg([
  defineArticle({
    headline: post.value.title,
    description: post.value.description,
    datePublished: new Date(post.value.date).toISOString(),
    dateModified: new Date(post.value.date).toISOString(), // Update when content changes
    author: {
      '@type': 'Person',
      name: post.value.author || 'Reqcore Team',
      url: 'https://reqcore.com', // Link to author page when available
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

### 11.2 Schema Best Practices
- Use `BlogPosting` type for blog articles (Nuxt SEO auto-selects based on `defineArticle`)
- Always include `datePublished` and `dateModified` in ISO 8601 format with timezone
- Use `Person` type for individual authors, `Organization` for team-authored
- Include `author.url` linking to an author bio page
- Include high-resolution `image` (minimum 50K pixels = width × height)
- Validate with Google's Rich Results Test: https://search.google.com/test/rich-results

### 11.3 Other Page Types
- **Job detail pages**: Use `defineJobPosting()` (already implemented)
- **Landing page**: Use `defineOrganization()`, `defineWebSite()`, `defineWebPage()`
- **FAQ sections**: Consider adding `FAQPage` schema for Q&A sections in articles
- **How-to content**: Consider `HowTo` schema for step-by-step guides

---

## 12. Technical SEO Checklist

These are handled at the infrastructure level but must be maintained:

### 12.1 Meta Tags (via `useSeoMeta`)
Every public page MUST set:
```typescript
useSeoMeta({
  title: '',           // 50–60 chars, primary keyword near front
  description: '',     // 120–155 chars, keyword included
  ogTitle: '',         // Can match title or be slightly different
  ogDescription: '',   // Can match description
  ogType: 'article',   // 'article' for blog, 'website' for other pages
  ogImage: '',         // Absolute URL or path to 1200×630+ image
  twitterCard: 'summary_large_image',
  twitterTitle: '',
  twitterDescription: '',
})
```

Every **private page** (dashboard, auth, onboarding) MUST include:
```typescript
useSeoMeta({
  robots: 'noindex, nofollow',
})
```

### 12.2 Sitemap
- Dynamic sitemap at `/api/__sitemap__/urls.ts` includes open jobs and blog posts
- Blog posts automatically included via `queryCollection(event, 'blog')`
- Verify sitemap with Google Search Console after adding new pages

### 12.3 Robots
- Dashboard, auth, API, and onboarding routes are disallowed in `nuxt.config.ts`
- Public pages (blog, jobs, landing, roadmap) must be crawlable

### 12.4 Core Web Vitals
- **Largest Contentful Paint (LCP)** < 2.5s — avoid massive hero images above the fold
- **Cumulative Layout Shift (CLS)** < 0.1 — always specify image dimensions
- **Interaction to Next Paint (INP)** < 200ms — avoid heavy JS on content pages
- Reqcore uses ISR/prerender for public pages — this helps significantly

### 12.5 Route Rules (Already Configured)
```typescript
// Prerendered: /, /roadmap, /blog, /blog/**
// ISR (1hr): /jobs, /jobs/**
```

---

## 13. Content Update & Freshness Strategy

### Rules
1. **Update articles when information changes** — outdated content loses rankings
2. **Update the `date` frontmatter** only when the content substantially changes — don't bump dates artificially
3. **Add a `dateModified` field** to frontmatter when updating significantly (if using the field in schema)
4. **Review articles quarterly** — check for broken links, outdated statistics, new competitor coverage
5. **Expand aging articles** rather than creating new overlapping posts — avoid keyword cannibalization
6. **Monitor ranking drops** — if an article loses position, analyze what competitors added and fill the gap
7. **Add the current year to the title** for time-sensitive topics, and update it annually

---

## 14. Blog Article Template

Use this template as a starting point for every new blog article:

```markdown
---
title: "[Primary Keyword] — [Compelling Modifier]"
description: "[120–155 char description with primary keyword, value proposition, active voice]"
date: YYYY-MM-DD
author: "Author Name"
image: "/og-image.png"
tags: ["primary-keyword", "related-1", "related-2", "ats", "recruitment"]
---

# [Same as title — Primary Keyword in H1]

[Opening paragraph — 2-3 sentences. Include primary keyword in first 100 words.
Lead with the key takeaway or answer. Use a declarative sentence that could be
pulled into a featured snippet.]

## [H2 — Subtopic with Related Keyword]

[2–4 sentence paragraph. Short and scannable.]

- Bullet point for key details
- Another point
- Third point

## [H2 — Another Major Subtopic]

[Content with internal links to related Reqcore pages and external links to
authoritative sources.]

| Comparison Column A | Column B |
|---|---|
| Data point | Data point |
| Data point | Data point |

## [H2 — Practical/Actionable Section]

1. First step
2. Second step
3. Third step

## [H2 — FAQ or Common Questions] (optional but recommended)

### [Question matching a "People Also Ask" query]?

[40–60 word direct answer. Then expand with details.]

### [Another question]?

[Direct answer, then elaboration.]

## The Bottom Line

[Summary paragraph. Restate key takeaway. Include CTA mentioning Reqcore
naturally.]

---

*[Reqcore](/) is an open-source applicant tracking system with transparent AI,
no per-seat pricing, and full data ownership.
[Try the live demo](/auth/sign-in) or explore the [product roadmap](/roadmap).*
```

---

## 15. SEO Quality Checklist (Pre-Publish)

Run through this checklist before publishing or updating any blog article:

### Content
- [ ] Primary keyword appears in: title, description, H1, first 100 words, at least one H2, URL slug
- [ ] Search intent matches the top 10 SERP results for the primary keyword
- [ ] Content is the most comprehensive resource on this topic (or close)
- [ ] All facts are accurate and sourced
- [ ] No spelling or grammar errors
- [ ] Author byline is included
- [ ] Images have descriptive filenames and alt text

### Structure
- [ ] One H1 only (the article title)
- [ ] Clear H2/H3 hierarchy — logical, skimmable
- [ ] Short paragraphs (2–4 sentences)
- [ ] Uses lists, tables, or bold text for key information
- [ ] Opening answers the core question immediately (featured snippet optimization)

### Links
- [ ] 3–5 internal links to relevant Reqcore pages
- [ ] 3–8 external links to authoritative sources
- [ ] All links use descriptive anchor text
- [ ] No broken links

### Technical
- [ ] Frontmatter is complete (title, description, date, author, image, tags)
- [ ] `useSeoMeta()` is set on the page component
- [ ] `useSchemaOrg([defineArticle({...})])` is configured
- [ ] OG image exists and is >= 1200×630px
- [ ] Page is included in sitemap (`/api/__sitemap__/urls.ts`)
- [ ] Page is not blocked by robots rules

### AI/LLM Readiness
- [ ] Key points are written as quotable, self-contained sentences
- [ ] FAQ section addresses "People Also Ask" queries
- [ ] Tables are used for comparison data
- [ ] Each H2 section can stand alone as a citable chunk

---

## 16. Common Mistakes to Avoid

| Mistake | Why It Hurts | Fix |
|---------|-------------|-----|
| Keyword stuffing | Google penalizes unnatural repetition | Use primary keyword 5–10 times naturally in 2000+ words |
| Missing meta description | Google auto-generates a worse snippet | Write a compelling 120–155 char description |
| Vague headings ("Introduction", "Step 1") | Poor for SEO, LLMs, and users | Use descriptive, keyword-containing headings |
| No internal links | Orphaned pages don't rank well | Add 3–5 internal links per article |
| Walls of text | High bounce rate, poor readability | Short paragraphs, lists, tables, images |
| Duplicate title tags | Confuses Google, dilutes ranking signals | Every page must have a unique title |
| Date in URL slug | Can't update content without breaking links | Keep slugs evergreen, put year in title only |
| Clickbait title | Users bounce back to SERPs → ranking drops | Match title to actual content value |
| No OG image | Poor social sharing, lower CTR from social | Always include a 1200×630+ OG image |
| Thin content on competitive queries | Won't outrank comprehensive competitors | Be the most complete resource |
| Ignoring search intent | Content doesn't match what users want | Analyze SERP before writing |
| Not updating old content | Loses freshness signals, competitors overtake | Quarterly review and update cycle |

---

## 17. Reqcore-Specific Content Topics (High Business Potential)

When choosing blog topics, prioritize these topic clusters where Reqcore naturally fits as a solution:

### Cluster 1: ATS Comparison & Selection (Business Potential: 3)
- "Best open-source ATS" / "open-source applicant tracking systems"
- "Self-hosted vs cloud ATS"
- "ATS comparison for small businesses"
- "Free ATS software"
- "Greenhouse alternatives" / "Lever alternatives" / "Workable alternatives"

### Cluster 2: Data Ownership & Privacy (Business Potential: 3)
- "ATS data ownership"
- "GDPR compliant ATS"
- "Candidate data privacy"
- "Self-hosted recruitment software"

### Cluster 3: ATS Implementation & Migration (Business Potential: 2–3)
- "How to migrate from cloud ATS"
- "Self-host an ATS"
- "ATS setup guide"
- "Docker ATS deployment"

### Cluster 4: Recruitment Best Practices (Business Potential: 2)
- "Hiring pipeline management"
- "Structured interviewing"
- "Recruitment metrics to track"
- "Transparent AI in hiring"

### Cluster 5: Cost & ROI (Business Potential: 3)
- "ATS pricing comparison"
- "Total cost of ownership ATS"
- "Per-seat pricing alternatives"
- "Recruitment software cost reduction"

---

## References

- [Google: Creating Helpful, Reliable, People-First Content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google: Article Structured Data](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Google: SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google: How Search Works — Ranking Results](https://www.google.com/search/howsearchworks/how-search-works/ranking-results/)
- [Ahrefs: On-Page SEO](https://ahrefs.com/blog/on-page-seo/)
- [Backlinko: On-Page SEO Definitive Guide](https://backlinko.com/on-page-seo)