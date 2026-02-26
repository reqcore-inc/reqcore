---
name: 1-topic-research
description: "Phase 1 of the SEO article pipeline: Topic Research & Validation. Use BEFORE writing any blog article. Takes a topic/keyword from the topical authority map, validates it, and produces a structured brief for Phase 2 (Source Gathering) and Phase 3 (Article Drafting). Covers keyword validation, search intent classification, cannibalization checks, content gap analysis, original angle identification, internal link planning, and business potential scoring."
---

# Phase 1: Topic Research & Validation

> **Pipeline position:** Phase 1 of 6 — runs BEFORE any writing happens.
> **Input:** A topic or keyword from the [Topical Authority Map](../../../TOPICAL-AUTHORITY-MAP.md).
> **Output:** A structured Topic Brief (see §8) that feeds into Phase 2 (Source Gathering) and Phase 3 (Article Drafting).
> **Decision gate:** If the topic fails validation (no original angles, business potential = 1, or cannibalization with no fix), recommend a different topic and STOP.

---

## When to Use This Skill

- The user asks to research, validate, or brief a blog topic
- The user picks a topic from the topical authority map and wants to start the article pipeline
- The user asks "should I write about X?" or "is this keyword worth targeting?"
- Before ANY blog article is drafted — this phase is mandatory

## Context: Reqcore & The Content Strategy

**Reqcore** is an open-source applicant tracking system (ATS). We are executing a topical authority SEO strategy with ~132 planned articles across 9 clusters (see `TOPICAL-AUTHORITY-MAP.md`). We publish one AI-assisted article per day on `reqcore.com/blog`. Content lives in `content/blog/*.md` files using `@nuxt/content` v3.

**Primary audiences:**
1. Technical recruiters & hiring managers evaluating ATS tools
2. HR leaders at SMBs (10–500 employees)
3. Developers and founders who want to self-host their ATS
4. Recruiting agency owners looking for flexible, affordable software

**Competitive landscape:** We are a new blog competing against established HR tech sites with high domain authority: Workable (blog.workable.com), Lever (lever.co/blog), Ashby, Greenhouse, Manatal, JazzHR, BambooHR, iCIMS, SmartRecruiters, Recruitee, and Zoho Recruit. We compensate with deeper technical content, original builder perspective, and topical authority density.

---

## Step-by-Step Research Process

### Step 1: Keyword Validation

**Goal:** Confirm the topic is a viable SEO target and define the keyword set.

#### 1.1 Identify the Primary Keyword

Take the topic from the topical authority map and determine the best **primary keyword** to target. The primary keyword should be:

- The most natural, commonly-searched phrasing of this topic
- Relevant to Reqcore's audience (recruiters, HR teams, developers, founders)
- Specific enough to have clear search intent (avoid overly broad terms)

**How to validate:** Use `fetch_webpage` to search Google for the candidate keyword. Analyze the top 10 results:

- Do the results match the topic you intend to cover? (If not, refine the keyword)
- What type of sites rank? (If only mega-brands rank for a head term, pivot to a long-tail variant)
- Are there any open-source or small-player results? (This signals an opportunity)

#### 1.2 Identify 3–5 Secondary Keywords

Find long-tail variations and semantically related terms that should appear naturally in the article. Sources for secondary keywords:

- Google autocomplete suggestions for the primary keyword
- "People Also Ask" (PAA) boxes in the SERP
- Related searches at the bottom of the SERP
- Variations that add modifiers: "for small business", "open source", "self-hosted", "free", "vs [competitor]", "[year]", "guide", "how to"

#### 1.3 Assess Ranking Difficulty

Evaluate whether we can realistically rank for this keyword given our domain authority:

| Signal | Good (Pursue) | Caution | Bad (Pivot to Long-tail) |
|--------|---------------|---------|--------------------------|
| Top 10 dominated by | Blogs, niche sites, forums, Reddit | Mix of brands and blogs | Only enterprise SaaS homepages |
| Content quality of top 10 | Thin, outdated, generic | Decent but gaps exist | Comprehensive, recently updated |
| Content format diversity | Multiple formats compete | One format dominates | Single authoritative page |
| Reddit/Quora/forums rank | Yes (weak SERP) | Some | None |
| Featured snippet available | Yes — wipeable | Yes — occupied by authority | N/A for this query |

**If difficulty is too high:** Recommend a more specific long-tail variant and explain the pivot.

**Output for this step:**
```
Primary keyword: [keyword]
Secondary keywords: [3–5 keywords]
Ranking difficulty: Low / Medium / High
Difficulty rationale: [1–2 sentences]
Long-tail pivot (if needed): [alternative keyword]
```

---

### Step 2: Search Intent Classification

**Goal:** Determine what the searcher wants and what format to write.

#### 2.1 Classify the Search Intent

Search the primary keyword and classify intent based on what **dominates page 1**:

| Intent | SERP Signals | Reqcore Action |
|--------|-------------|------------------|
| **Informational** | Guides, explainers, how-tos, Wikipedia, blog posts | Write a blog article (guide, explainer, how-to) |
| **Commercial Investigation** | "Best X", comparison posts, review roundups, listicles | Write a blog article (comparison, roundup, listicle) |
| **Transactional** | Product pages, pricing pages, sign-up forms, "buy" CTAs | Flag: this should be a **landing page**, not a blog post — skip or redirect to product team |
| **Navigational** | Brand-specific results (e.g., "Greenhouse ATS login") | Skip: not worth targeting |

#### 2.2 Determine the Correct Article Format

Look at what formats dominate the SERP top 5:

| Format | When It Dominates |
|--------|-------------------|
| **Comprehensive guide** | "What is X", "how does X work", "complete guide to X" |
| **Listicle / Roundup** | "Best X", "top X", "X tools for Y" |
| **Head-to-head comparison** | "X vs Y", "X compared to Y" |
| **How-to / Tutorial** | "How to X", "step-by-step X", "set up X" |
| **Opinion / Thought piece** | Emerging topics, contrarian angles, "is X worth it?" |
| **Glossary / Reference** | "X terms", "X glossary", "X definitions" |

**Match the dominant format.** If 4 of the top 5 are listicles, write a listicle. Going against the dominant format is almost always a losing strategy.

**Output for this step:**
```
Search intent: Informational / Commercial Investigation / Transactional / Navigational
Article format: Guide / Listicle / Comparison / How-to / Opinion / Glossary
Format rationale: [What dominates the SERP and why this format]
Transactional flag: Yes/No (if Yes, recommend landing page instead)
```

---

### Step 3: Cannibalization Check

**Goal:** Ensure we don't compete with our own existing content.

#### 3.1 Scan Existing Blog Articles

Read all existing files in `content/blog/` and check for overlap:

```
# Check existing article filenames, titles, and primary keyword targets
# Look in: content/blog/*.md
```

For each existing article, compare:

1. **Title overlap** — Does an existing article target the same or very similar phrasing?
2. **Primary keyword overlap** — Would Google see these as competing for the same query?
3. **Intent overlap** — Do both articles serve the same search intent?
4. **Content overlap** — Would >30% of the content cover the same subtopics?

#### 3.2 Decision Matrix

| Overlap Level | Recommendation |
|---------------|----------------|
| **No overlap** | Proceed with the new article |
| **Adjacent topics** (related but different intent/angle) | Proceed, but plan intentional differentiation and cross-linking |
| **Partial overlap** (same keyword, different intent or format) | Proceed only if intent is clearly different; document the differentiation |
| **Significant overlap** (same keyword + same intent) | **Do NOT write a new article.** Choose one of: |
| | → **Expand** the existing article to cover this subtopic |
| | → **Merge** by rewriting the existing article with broader scope |
| | → **Skip** this topic entirely |

#### 3.3 Report Format

```
Cannibalization risk: None / Low / Medium / High
Conflicting article(s): [file path(s) or "None"]
Overlap description: [What overlaps and why]
Recommendation: Proceed / Differentiate / Expand existing / Merge / Skip
```

---

### Step 4: Content Gap Analysis

**Goal:** Find what the top-ranking pages cover — and what they miss.

#### 4.1 Analyze Top-Ranking Pages

Use `fetch_webpage` to read the top 5–10 ranking pages for the primary keyword. For each page, extract:

1. **Subtopics covered** — What H2/H3 sections do they have?
2. **Questions answered** — What queries does this page address?
3. **Data and evidence** — What statistics, examples, or original data do they include?
4. **Content depth** — Estimated word count, use of tables/visuals/code
5. **Freshness** — When was it last updated? Are dates/prices/tools current?
6. **Weaknesses** — Where does it fall short? What's thin, outdated, or missing?

#### 4.2 Map "People Also Ask" Questions

Search the primary keyword on Google and extract all PAA questions. These represent confirmed demand for related subtopics. Group them:

- Questions we MUST address (directly related to primary keyword)
- Questions we SHOULD address (related, adds value)
- Questions to skip (tangential, different intent)

#### 4.3 Identify Content Gaps

A content gap is a subtopic or angle that **none or few** of the top-ranking pages cover well. Common gap types:

| Gap Type | Example |
|----------|---------|
| **Missing subtopic** | Top results discuss cloud ATS but never mention data ownership trade-offs |
| **Outdated information** | Comparisons reference pricing from 2023 |
| **No original data** | Generic advice without real numbers, screenshots, or benchmarks |
| **No practitioner perspective** | Written by marketers, not people who build/use ATS software |
| **Missing format** | All guides lack comparison tables, code examples, or decision frameworks |
| **No mention of open source** | Commercial ATS content ignores open-source alternatives entirely |

**Output for this step:**
```
Subtopics covered by competitors: [bulleted list]
PAA questions to address: [bulleted list]
Content gaps identified: [bulleted list with gap type]
Competitor weaknesses: [bulleted list]
```

---

### Step 5: Original Angle Identification

**Goal:** Define 2–3 angles that differentiate our article from everything already ranking. This is the most important step — without original angles, the article is just another "me too" post.

#### 5.1 Sources of Original Angles

| Source | How to Use It | Example |
|--------|--------------|---------|
| **Builder experience** | Reference real decisions, trade-offs, and code from building Reqcore | "When we built our pipeline Kanban board, we found that..." |
| **Review data analysis** | Analyze G2/Capterra review patterns to surface real user pain points | "Across 200+ G2 reviews of [Competitor], 34% mention data export frustration" |
| **Contrarian opinion** | Challenge conventional wisdom with evidence | "Most 'best ATS' lists rank by feature count — but features you'll never use are anti-features" |
| **Original data / cost analysis** | Calculate real numbers nobody else has published | "We calculated the 3-year total cost for self-hosted vs cloud ATS for a 20-person team" |
| **Technical depth** | Go deeper than marketing content — cover architecture, data flow, deployment | "Here's exactly how candidate data flows from application form to your PostgreSQL database" |
| **Framework / Template** | Create a reusable tool (checklist, scorecard, decision matrix) | "Use this 10-question ATS evaluation scorecard before your next demo" |
| **Comparison with proof** | Side-by-side with screenshots, real pricing, actual feature tests | "We tested resume parsing accuracy in 5 ATS platforms. Here's what happened." |

#### 5.2 Validation Criteria

Each original angle must pass ALL of these checks:

- [ ] **Not already covered** by any top-10 ranking page for this keyword
- [ ] **Substantive** — adds real value, not just a creative reframing
- [ ] **Credible** — comes from genuine expertise or verifiable data
- [ ] **Relevant** — directly related to the primary keyword and search intent
- [ ] **Executable** — we can actually produce this content (we have the data, experience, or access)

#### 5.3 No-Go Rule

**If you cannot identify at least 2 original angles, recommend a different topic.** There is no point writing content that merely restates what already exists. Suggest:

- A more specific long-tail variant where gaps are easier to find
- A different topic from the same cluster in the topical authority map
- Expanding an existing article instead of writing a new one

**Output for this step:**
```
Original angle 1: [description + source type]
Original angle 2: [description + source type]
Original angle 3 (optional): [description + source type]
Validation: [Confirm all angles pass the 5 checks above]
```

---

### Step 6: Internal Link Planning

**Goal:** Plan the internal link structure before writing to reinforce topical authority.

#### 6.1 Links FROM the New Article (Outgoing)

Select **3–5 existing blog articles** that the new article should link TO. Prioritize:

1. The **cluster pillar** article (mandatory if it exists)
2. **Sibling articles** in the same cluster (2–3)
3. **Cross-cluster articles** that are topically relevant (as noted in `TOPICAL-AUTHORITY-MAP.md`)
4. **Product pages** where natural: `/` (landing), `/roadmap`, `/auth/sign-in` (demo), `/jobs` (job board)

For each link, specify:
- Target page: file path or URL
- Recommended anchor text (keyword-rich, not "click here")
- Where in the article this link should appear (which section/context)

#### 6.2 Links TO the New Article (Incoming — for Phase 6)

Select **2–3 existing blog articles** that should **later be updated** to link back to this new article. This creates the hub-and-spoke structure. For each:

- Source page: file path
- Recommended anchor text
- Where in the existing article the link should be inserted

#### 6.3 Cross-Cluster Links

Consult the Cross-Cluster Linking Map in `TOPICAL-AUTHORITY-MAP.md`. If this article has an explicit cross-cluster link noted, include it in the plan.

**Output for this step:**
```
Outgoing links (new article → existing):
  1. [anchor text](target path) — in [section context]
  2. ...

Incoming links (existing → new article, for Phase 6):
  1. [source path] — anchor: "[text]" — insert in [section]
  2. ...
```

---

### Step 7: Business Potential Scoring

**Goal:** Score the topic's alignment with Reqcore's business goals.

#### 7.1 Scoring Rubric

| Score | Criteria | Examples |
|-------|----------|---------|
| **3 — High** | Reqcore is a natural, irreplaceable solution to the searcher's problem. The article can organically feature Reqcore as a recommendation. | ATS comparisons ("Best open-source ATS"), ATS selection guides, deployment tutorials, data ownership articles, self-hosting guides |
| **2 — Medium** | Reqcore can be mentioned naturally as one relevant example, but the article isn't *about* Reqcore. Brand mention feels authentic but not central. | AI in hiring, recruiting metrics, compliance guides, hiring workflow best practices, vendor lock-in discussions |
| **1 — Low** | Reqcore mention would feel forced or tangential. The topic doesn't naturally connect to ATS software. | Generic remote work trends, general career advice, HR leadership philosophy, interview tips for candidates |

#### 7.2 Decision Gate

| Score | Action |
|-------|--------|
| **3** | Prioritize — write this article soon |
| **2** | Proceed — schedule normally |
| **1** | **Deprioritize or skip.** Only write if it fills a critical gap in topical authority coverage. Document why it's worth the investment despite low business potential. |

**Output for this step:**
```
Business potential: 3 / 2 / 1
Justification: [How Reqcore connects to this topic]
CTA recommendation: [What Reqcore CTA fits naturally — e.g., "Try the live demo", "See our transparent AI scoring", "Deploy with Docker in 5 minutes"]
```

---

## §8. Output: The Topic Brief

After completing all 7 steps, compile the results into this structured brief. This is the deliverable that feeds into Phase 2 (Source Gathering) and Phase 3 (Article Drafting).

---

### Topic Brief Template

```markdown
# Topic Brief: [Article Title from Topical Authority Map]

**Date researched:** [YYYY-MM-DD]
**Topical map cluster:** [Cluster # — Name]
**Topical map phase:** [Phase #]
**Intent tag from map:** 🔵 Informational / 🟢 Commercial / 🔴 Transactional

---

## 1. Keyword Strategy

| Field | Value |
|-------|-------|
| Primary keyword | [keyword] |
| Secondary keywords | [kw1], [kw2], [kw3], [kw4], [kw5] |
| Ranking difficulty | Low / Medium / High |
| Difficulty rationale | [1–2 sentences] |
| Long-tail pivot | [If needed, otherwise "N/A"] |

## 2. Search Intent & Format

| Field | Value |
|-------|-------|
| Search intent | Informational / Commercial Investigation / Transactional / Navigational |
| Article format | Guide / Listicle / Comparison / How-to / Opinion / Glossary |
| Format rationale | [What dominates the SERP] |
| Transactional flag | No (proceed as blog) / Yes (recommend landing page) |

## 3. Cannibalization Check

| Field | Value |
|-------|-------|
| Risk level | None / Low / Medium / High |
| Conflicting article(s) | [file path(s) or "None"] |
| Overlap description | [What overlaps] |
| Recommendation | Proceed / Differentiate / Expand existing / Merge / Skip |

## 4. Content Gap Analysis

### What competitors cover well
- [subtopic 1]
- [subtopic 2]
- [subtopic 3]

### People Also Ask questions to address
- [question 1]
- [question 2]
- [question 3]

### Content gaps we can exploit
- [gap 1 — gap type]
- [gap 2 — gap type]
- [gap 3 — gap type]

### Competitor weaknesses
- [weakness 1]
- [weakness 2]

## 5. Original Angles

| # | Angle | Source Type | Proven unique? |
|---|-------|-----------|----------------|
| 1 | [description] | Builder experience / Review analysis / Contrarian / Original data / Technical depth / Framework | ✅ |
| 2 | [description] | [source type] | ✅ |
| 3 | [description] (optional) | [source type] | ✅ |

## 6. Internal Link Plan

### Outgoing (new article → existing)
| # | Anchor Text | Target | Section Context |
|---|------------|--------|-----------------|
| 1 | [text] | [path or URL] | [where in article] |
| 2 | [text] | [path or URL] | [where in article] |
| 3 | [text] | [path or URL] | [where in article] |

### Incoming (existing → new article, for Phase 6)
| # | Source Article | Anchor Text | Insert Location |
|---|--------------|------------|-----------------|
| 1 | [file path] | [text] | [section in existing article] |
| 2 | [file path] | [text] | [section in existing article] |

## 7. Business Potential

| Field | Value |
|-------|-------|
| Score | 3 / 2 / 1 |
| Justification | [How Reqcore connects] |
| CTA recommendation | [Natural CTA for this article] |

## 8. Recommended Article Specifications

| Field | Value |
|-------|-------|
| Suggested title | [SEO-optimized title, 50–60 chars] |
| Suggested slug | [filename for content/blog/] |
| Target word count | [based on competitor analysis] |
| Suggested H2 outline | [See below] |

### Suggested H2 Structure
1. [H2 — subtopic]
2. [H2 — subtopic]
3. [H2 — subtopic]
4. [H2 — subtopic]
5. [H2 — FAQ / People Also Ask] (if applicable)
6. [H2 — The Bottom Line]

---

## Decision: ✅ PROCEED / ❌ SKIP / 🔄 PIVOT

**Rationale:** [1–2 sentence summary of why this topic is or isn't worth writing today]

**If SKIP/PIVOT:** [Recommended alternative topic from the topical authority map]
```

---

## §9. Research Tools & Techniques

### Tools Available to the Agent

| Tool | Use For |
|------|---------|
| `fetch_webpage` | Fetch and analyze Google SERPs, competitor pages, G2/Capterra reviews, PAA questions |
| `read_file` / `grep_search` | Scan `content/blog/*.md` for cannibalization checks, read existing articles |
| `semantic_search` | Find related content across the workspace |
| `file_search` | Find blog articles by filename pattern |

### SERP Analysis Technique

To analyze what ranks for a keyword:

1. Use `fetch_webpage` with a Google search URL: `https://www.google.com/search?q=[keyword]&gl=us&hl=en`
2. Extract: page titles, URLs, formats, snippet text, PAA questions
3. Then `fetch_webpage` the top 3–5 ranking pages individually to analyze their structure and content

### Competitor Content Analysis

When fetching competitor pages, extract:
- H2/H3 heading structure (reveals their content outline)
- Word count estimate
- Whether they include: tables, images, code, data, examples, templates
- Publication and update dates
- Author and E-E-A-T signals

### Review Data Mining

For original angles based on review data:
- Fetch G2 review pages: `https://www.g2.com/products/[product]/reviews`
- Fetch Capterra review pages: `https://www.capterra.com/p/[id]/[product]/reviews/`
- Look for patterns: repeated complaints, unmet needs, feature gaps, pricing frustrations
- Quantify: "X% of reviews mention Y" is a powerful original data point

---

## §10. Quality Gates — When to STOP

**Do NOT proceed to Phase 2 if any of these are true:**

1. **Business potential = 1** — The topic has no natural connection to Reqcore. Recommend a different topic.
2. **High cannibalization with no resolution** — An existing article already targets this keyword and intent, and there's no way to differentiate. Recommend expanding the existing article instead.
3. **No original angles found** — If all top-10 results already cover the topic comprehensively and you cannot identify at least 2 unique angles, the article will be a "me too" post. Recommend a long-tail pivot or different topic.
4. **Transactional intent** — The keyword triggers product/pricing pages, not blog content. Flag for the product team as a landing page opportunity.
5. **Navigational intent** — The keyword is brand-specific to a competitor. Not worth targeting.

When stopping, always recommend a specific alternative topic from the [Topical Authority Map](../../../TOPICAL-AUTHORITY-MAP.md) and explain why it's a better use of today's writing slot.

---

## §11. References

- [Topical Authority Map](../../../TOPICAL-AUTHORITY-MAP.md) — The 132-article content plan with clusters, phases, and cross-linking rules
- [SEO Skill](../seo-skill/SKILL.md) — On-page SEO rules, content structure, frontmatter, technical SEO
- [Existing blog content](../../../content/blog/) — Published articles for cannibalization checks
- [Google: Creating Helpful Content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Ahrefs: Keyword Research Guide](https://ahrefs.com/blog/keyword-research/)
- [Backlinko: Content Gap Analysis](https://backlinko.com/hub/seo/content-gaps)