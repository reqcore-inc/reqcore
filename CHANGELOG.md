# Changelog

All notable changes to Reqcore are documented here, organized by date.

Format follows [Keep a Changelog](https://keepachangelog.com). Categories: **Added**, **Changed**, **Fixed**, **Removed**.

---

## Unreleased

### Added

* **blog:** add Cluster 8 career page articles — pillar (career-page-that-converts) and two supporting articles (career-page-seo, google-for-jobs-structured-data)
* **blog:** add incoming links to career page content from how-applicant-tracking-systems-work, open-source-applicant-tracking-system, and self-hosted-vs-cloud-ats

---

## [1.2.0](https://github.com/reqcore-inc/reqcore/compare/v1.1.0...v1.2.0) (2026-03-13)


### ✨ Features

* add email template management system ([616ada5](https://github.com/reqcore-inc/reqcore/commit/616ada516992a2fd7c33b941b7b12f7a6b5467c0))
* add email template validation schemas and pre-made templates ([7879e38](https://github.com/reqcore-inc/reqcore/commit/7879e38e2e54f7f3ac07d84faec3e36103ea0ded))
* add fullscreen toggle functionality to job detail view ([a94e4b6](https://github.com/reqcore-inc/reqcore/commit/a94e4b628922e41154abbeafd351be67e33e5685))
* add functionality to move applications directly to interview stage without scheduling ([22e6a0a](https://github.com/reqcore-inc/reqcore/commit/22e6a0ac2a80c41d5e38ca2164f7cf70fd3c4832))
* add Greenhouse vs Open Source ATS comparison article and enhance existing content with links ([8c2e225](https://github.com/reqcore-inc/reqcore/commit/8c2e2259b71cdf52405378c514594b3feed8b1c1))
* add iCalendar generation for interview invitations ([57e692a](https://github.com/reqcore-inc/reqcore/commit/57e692a253befb4675487e58ef2d5475b284a218))
* add interview scheduling functionality with sidebar integration ([0eb29b0](https://github.com/reqcore-inc/reqcore/commit/0eb29b068d38f04f7289589051e9d53d4c5a2f57))
* add interview validation schemas for creation, updating, and querying ([a93da4e](https://github.com/reqcore-inc/reqcore/commit/a93da4ec16862dacd43ebb9efbb339a84492f502))
* add interview validation schemas for creation, updating, and querying ([be8f623](https://github.com/reqcore-inc/reqcore/commit/be8f62375cb7a5798f9133dcf454eea7f835617b))
* add interviews dashboard page with filtering, editing, and deleting functionalities ([59bdb36](https://github.com/reqcore-inc/reqcore/commit/59bdb36d5ba33a280f20c39ceb9b9eb53fa2eeec))
* add middleware for 301 redirect from legacy domain to canonical domain ([5525cf6](https://github.com/reqcore-inc/reqcore/commit/5525cf6efa0c7e94220f58d2af2e7cf5e145affd))
* add script to backfill google_calendar_event_link for existing interviews ([c46d13d](https://github.com/reqcore-inc/reqcore/commit/c46d13da86b1bd5937b354647e98bf7e3561fe61))
* add teleport target prop to modals for improved flexibility in rendering ([78a3ae8](https://github.com/reqcore-inc/reqcore/commit/78a3ae8729fff28622104a7e8cdbca4d66c27dd7))
* add use case guide for open source ATS adoption by company size and industry ([f9770e5](https://github.com/reqcore-inc/reqcore/commit/f9770e56d947f6b1ca9e387febcb2cebc6115e68))
* **AppTopBar:** remove unused transition classes for user menu ([49976c3](https://github.com/reqcore-inc/reqcore/commit/49976c38d587ee05c09b59dd2226632529cadb33))
* **calendar:** add Google Calendar integration with OAuth2 flow ([08f778a](https://github.com/reqcore-inc/reqcore/commit/08f778a49feacfd41f3b78853b66251998bd499f))
* **calendar:** add Google Calendar sync status indicators in interview components ([bb5244a](https://github.com/reqcore-inc/reqcore/commit/bb5244adc2ce0e61e1ecd9b7f8a725de675ede66))
* **calendar:** update webhook renewal to require specific permissions and enhance error handling in sync process ([140d6ac](https://github.com/reqcore-inc/reqcore/commit/140d6ac690b0752d6205035df0d069f61ec2e418))
* centralize system email templates in shared module for improved maintainability ([e05b877](https://github.com/reqcore-inc/reqcore/commit/e05b8778defb25981658bdf197ff311d43f0cb71))
* create HMAC-signed tokens for candidate interview responses ([57e692a](https://github.com/reqcore-inc/reqcore/commit/57e692a253befb4675487e58ef2d5475b284a218))
* **dark mode:** enhance checkbox and radio styles for dark mode rendering ([728feb2](https://github.com/reqcore-inc/reqcore/commit/728feb2443087d893feacc7e0afa3db12c9ed5b0))
* **dashboard:** enhance job management and pipeline tracking ([a60f489](https://github.com/reqcore-inc/reqcore/commit/a60f4893a633768525adfdea7eaf1ed5b5a17f50))
* **dashboard:** update job pipeline display logic to use application count ([b75b0e5](https://github.com/reqcore-inc/reqcore/commit/b75b0e51442fa7d96b2d5bd07ea77baa5debd3eb))
* enhance interview management with inline editing and rescheduling features ([ef5cdbb](https://github.com/reqcore-inc/reqcore/commit/ef5cdbb68a2421c6c00c080edece1e93406417ff))
* enhance webhook handling with cron secret validation and improve interview ID validation ([457af10](https://github.com/reqcore-inc/reqcore/commit/457af10fe8f160c066e7ae4611e8c0e5a5e3b8a0))
* **google-calendar:** update integration instructions and add environment variable details ([be9ccbd](https://github.com/reqcore-inc/reqcore/commit/be9ccbd669c19f5eb9d60241abe3f70080246eac))
* implement advanced filtering and sorting options for job applications ([27f179e](https://github.com/reqcore-inc/reqcore/commit/27f179ec274545fb485cfc9aad56b986415a2ad7))
* implement sortable candidate and application tables with improved UI ([9188d3b](https://github.com/reqcore-inc/reqcore/commit/9188d3b5bb6dcdb4f105ae35a2c009721317a9f9))
* improve date formatting helper to return local timezone date string ([ddda624](https://github.com/reqcore-inc/reqcore/commit/ddda62492e58a38a79eb5f67a46311f32a0d6c58))
* integrate email template selection for interview invitations ([771917f](https://github.com/reqcore-inc/reqcore/commit/771917fd9b180b4babcfb6eb0c0192c4b5e44ebb))
* **interview:** add Google Calendar notification preferences and customization options ([6c942d0](https://github.com/reqcore-inc/reqcore/commit/6c942d0b6015f0a74d60c74612d8392e1ea6c4b4))
* **interview:** enhance interview scheduling with Google Calendar integration and email validation ([58810b1](https://github.com/reqcore-inc/reqcore/commit/58810b17e10064336d80a8de508a043070e7963d))
* make candidate email addresses clickable for improved user interaction ([2c01f77](https://github.com/reqcore-inc/reqcore/commit/2c01f77eacf98dc94a196d067cc5395532e0eb98))
* refactor interview management with enhanced status transitions and email template integration ([6033d06](https://github.com/reqcore-inc/reqcore/commit/6033d065e7bb1985af78dc12ee2091b96a52ca18))


### 🐛 Bug Fixes

* cast return type of getAuth function to Auth ([665e059](https://github.com/reqcore-inc/reqcore/commit/665e05932061f83c1c3b73aa729a54a3ef571ffb))
* correct promise chaining for Google Calendar event creation ([a935615](https://github.com/reqcore-inc/reqcore/commit/a935615e2eae720111672fa34d135163f31f4121))
* **issue-template:** enable blank issues in configuration ([b634752](https://github.com/reqcore-inc/reqcore/commit/b6347524088d46401b7ff48776666d839c0ee509))
* update G2 ranking link for Greenhouse in ATS comparison article ([c46549e](https://github.com/reqcore-inc/reqcore/commit/c46549ec9e258a85d8e9c3bd63cbea549f0ec630))


### ♻️ Refactoring

* simplify refreshNuxtData calls in useInterview composable and remove unused migration placeholder ([b9533fe](https://github.com/reqcore-inc/reqcore/commit/b9533fece569f9c2d4f1ae75960f28f17a115f29))

## [1.1.0](https://github.com/reqcore-inc/reqcore/compare/v1.0.0...v1.1.0) (2026-03-10)


### ✨ Features

* add new article on best free ATS software for startups and update related content ([021f8db](https://github.com/reqcore-inc/reqcore/commit/021f8db2351260cd5e2ac738aa571da85e91f4dc))
* add new article on the differences between open source and free ATS, including a comprehensive guide and internal links ([da31e77](https://github.com/reqcore-inc/reqcore/commit/da31e77ba6187f7c8faa6ddb1d626c1fdfe57d82))
* add release automation configuration and update versioning ([a37c1cc](https://github.com/reqcore-inc/reqcore/commit/a37c1cc8f032816ab10a184ad3b487d65b5997a7))
* **analytics:** integrate PostHog for user analytics and consent management ([8bd4bd5](https://github.com/reqcore-inc/reqcore/commit/8bd4bd50cb62254e9d39f8c92214c2af24b8671c))
* **analytics:** integrate PostHog for user analytics and consent management ([619f239](https://github.com/reqcore-inc/reqcore/commit/619f239c06a865a2d1a091a1d5f85a941548b5a7))
* **consent:** implement consent banner for analytics tracking and update privacy policy ([24a9201](https://github.com/reqcore-inc/reqcore/commit/24a920163ecf9a3a9a65d4476f115dd34357a34b))
* **consent:** simplify consent message for clarity in analytics tracking ([c28356a](https://github.com/reqcore-inc/reqcore/commit/c28356a27eea15715e686cd83686ac7cdb6bd29b))
* **consent:** update wording in consent banner for improved clarity ([91c6550](https://github.com/reqcore-inc/reqcore/commit/91c655032d8e3cf515b065b9fe13e216f460c90d))
* **database:** enhance database URL resolution with fallback handling for environment variables ([0302102](https://github.com/reqcore-inc/reqcore/commit/0302102c984b04642cd2e4de2bbb4cdcdf88b185))
* **dependencies:** update PostHog CLI and related packages for improved functionality ([f532a3e](https://github.com/reqcore-inc/reqcore/commit/f532a3e3c53d522b1d11c93314cf91252400a6f3))
* **interviews:** add Interview interface for managing interview data structure ([da4e78d](https://github.com/reqcore-inc/reqcore/commit/da4e78dc6552b14201432429229a10363eaf5748))
* **navbar:** replace static navbar with reusable PublicNavBar component across blog, catalog, docs, and roadmap pages ([a0d17db](https://github.com/reqcore-inc/reqcore/commit/a0d17dbcfe3613d2f5817f54ee9b46758a350ad5))
* **nuxt:** conditionally load PostHog module based on API key availability to prevent crashes ([ddb1f59](https://github.com/reqcore-inc/reqcore/commit/ddb1f599ea56b4d938cb8c50b754fac4561070fd))
* **posthog:** add PostHog configuration for server-side event capture ([9958fe5](https://github.com/reqcore-inc/reqcore/commit/9958fe5d37ea75366216bcbd5a2187346c62c938))
* **posthog:** enhance analytics consent management and data minimization in PostHog integration ([92588d9](https://github.com/reqcore-inc/reqcore/commit/92588d9a3a3801eea7e63bae46d773a9e2dc771c))
* **posthog:** enhance PostHog integration with consent handling and graceful shutdown ([5e708fa](https://github.com/reqcore-inc/reqcore/commit/5e708faf1b3808fc24f4a6c51285eb9a4920004b))
* **posthog:** replicate safe accessor for PostHog in composables and plugins to ensure compatibility when not configured ([1e948cb](https://github.com/reqcore-inc/reqcore/commit/1e948cbc2e9543e54756f553327454e70c726702))
* **posthog:** update PostHog integration with environment variables and consent handling ([4b745ec](https://github.com/reqcore-inc/reqcore/commit/4b745ec2f9e768ad11e113799d3b63e17a6cef60))
* **posthog:** update PostHog integration with environment variables and consent handling ([4c11f99](https://github.com/reqcore-inc/reqcore/commit/4c11f99c9bc1331989c80b78bf793dd63ec2584f))


### 🐛 Bug Fixes

* add config and manifest file parameters to release-please action ([ff30b11](https://github.com/reqcore-inc/reqcore/commit/ff30b11bbcaea0d7ab92be887e008edc656ba5cc))
* **posthog:** read server PostHog config from env vars directly ([74ae687](https://github.com/reqcore-inc/reqcore/commit/74ae6874e2019944bf8d71f314fb2dfc988b7658))
* **posthog:** update proxy targets for PostHog integration with environment variable notes ([da4e78d](https://github.com/reqcore-inc/reqcore/commit/da4e78dc6552b14201432429229a10363eaf5748))
* **release:** remove pull request header from release configuration ([9636fd5](https://github.com/reqcore-inc/reqcore/commit/9636fd5581032283af5c89b8be654ea01ae5fa6f))
* update token in release-please action for proper authentication ([5ae917e](https://github.com/reqcore-inc/reqcore/commit/5ae917e3c30cd5e819a1be97045e4890d4ac0f7b))

## 2026-03-08

### Added

- **Blog: Best Free ATS Software for Startups (2026)** — Cluster 2 supporting roundup article. Compares 7 free ATS tools across three "free" models (free-forever, free trial, open source), with startup-specific evaluation criteria and upgrade signals. Published to `content/blog/best-free-ats-software-for-startups.md`
- **Internal links** — added cross-links from `best-open-source-applicant-tracking-systems.md` (Cluster 2 pillar) and `open-source-vs-free-ats.md` (Cluster 1) to new article

## 2026-03-07

### Added

- **Blog: Open Source vs Free ATS: Why They Aren't the Same** — Cluster 1 supporting article. Explains the difference between free (proprietary) and open source ATS, introduces a 4-category ATS pricing spectrum framework, and includes real infrastructure cost data. Published to `content/blog/open-source-vs-free-ats.md`
- **Internal link** — added cross-link from `open-source-applicant-tracking-system.md` (Cluster 1 pillar) to new supporting article

## 2026-03-04

### Added

- **Blog: How Does an Applicant Tracking System Work?** — Cluster 1 supporting article. Covers the ATS workflow from job posting to hiring decision, resume parsing mechanics, pipeline stages, candidate scoring methods (keyword vs rules vs AI), data ownership, and integrations. Published to `content/blog/how-applicant-tracking-systems-work.md`
- **Internal link** — added cross-link from `open-source-applicant-tracking-system.md` (Cluster 1 pillar) to new supporting article

## 2026-02-28

### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post

## 2026-02-22

### Added

- **Blog: Best Open Source Applicant Tracking Systems [2026]** — Cluster 2 pillar page. 3,800-word comparison of 7 open source ATS platforms with TCO analysis, evaluation framework, and FAQ. Published to `content/blog/best-open-source-applicant-tracking-systems.md`
- **Internal link** — added cross-link from `self-hosted-vs-cloud-ats.md` to new pillar page

### Fixed

- **Railway PR seed execution** — removed hard `.env` dependency from `db:seed`; seeding now works with platform-injected env vars and still supports local `.env` loading in `seed.ts`

### Changed

- **Unified Railway seeding path** — Railway predeploy now runs `db:seed` (same script as standard demo data), removing PR-specific seed divergence between preview and production-like environments
- **Preview demo defaults aligned** — runtime preview fallbacks now target `reqcore-demo` and `demo@reqcore.com` to match `server/scripts/seed.ts`

### Removed

- **PR-only seed script** — removed `server/scripts/seed-pr.ts` and the `db:seed:pr` npm script

---
## 2026-02-28

### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post



### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post

## 2026-02-21

### Fixed

- **Dependency security remediation** — resolved all `npm audit --audit-level=high` findings by upgrading `@aws-sdk/client-s3` (pulling patched `@aws-sdk/xml-builder`) and regenerating lockfile resolution
- **Transitive vulnerability pinning** — added npm `overrides` for `fast-xml-parser`, `minimatch`, `tar`, and `readdir-glob` to keep vulnerable transitive ranges out of the install graph
- **Demo write-protection enforcement** — hardened server demo guard so `POST`/`PATCH`/`PUT`/`DELETE` requests are consistently blocked for the configured demo organization and no longer silently fail open when demo org lookup fails
- **Dashboard preview UX** — write attempts in preview mode now trigger a dedicated upsell modal instead of only inline/API errors, while keeping action buttons visible

### Changed

- **Lockfile hygiene** — refreshed dependency graph with `npm install` + `npm dedupe` to remove stale vulnerable transitive entries
- **Demo env guidance** — `.env.example` demo slug example now matches seeded demo organization slug (`reqcore-demo`) to reduce configuration drift

---
## 2026-02-28

### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post



### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post

## 2026-02-19

### Changed

- **Deployment platform migration** — migrated from Hetzner VPS (Caddy + systemd) to Railway (managed Nuxt service, Railway PostgreSQL, Railway Storage Buckets)
- **S3 path style now configurable** — `S3_FORCE_PATH_STYLE` env var controls path-style vs virtual-hosted-style S3 URLs (MinIO vs Railway Buckets/AWS S3)
- **S3 bucket plugin** — skips bucket initialization on managed providers (Railway/AWS) where buckets are pre-provisioned
- **`.env.example`** — expanded with full documentation, Railway-specific variable references, and all env vars

### Added

- **`start` script in `package.json`** — `node .output/server/index.mjs` for Railway Nixpacks detection

---
## 2026-02-28

### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post



### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post

## 2026-02-18

### Added

- **Organic SEO foundation** — `@nuxtjs/seo` (Sitemap, Robots, Schema.org, SEO Utils, Site Config) and `@nuxt/content` v3 (Markdown blog engine with typed collections)
- **Dynamic sitemap** — all open job postings auto-included via `/api/__sitemap__/urls`
- **Robots directives** — `/dashboard/`, `/auth/`, `/api/`, `/onboarding/` blocked from crawling; `noindex` on auth, onboarding, apply, and confirmation pages
- **JSON-LD structured data** — `JobPosting` on job detail (salary, location, remote, employment type), `Organization` + `WebSite` + `WebPage` on landing page, `Article` on blog posts
- **Job SEO fields** — `salaryMin`, `salaryMax`, `salaryCurrency`, `salaryUnit`, `remoteStatus`, `validThrough` added to job schema and all CRUD endpoints
- **Full OG + Twitter Card meta** on all public pages (landing, job board, job detail, roadmap, blog)
- **Blog** — listing page, article detail page with `@tailwindcss/typography` prose styling, seed article "Self-Hosted vs Cloud ATS: Pros, Cons, and When to Switch"
- **ISR route rules** — `/jobs/**` (3600s stale-while-revalidate), prerender for `/`, `/roadmap`, `/blog/**`
- **SVG favicon** — purple rounded rect with white "A"

### Changed

- **Landing page H1** — from "The recruitment engine you actually own" to "The open-source ATS you actually own" for keyword targeting
- **Landing page meta description** — optimized for "open source ATS", "self-hosted", "applicant tracking system" keywords
- **Public job API** — now joins organization table to expose `organizationName` for JSON-LD `hiringOrganization`
- **Navigation** — "Blog" link added to landing page navbar/footer and roadmap page navbar

---
## 2026-02-28

### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post



### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post

## 2026-02-16

### Added

- **In-app feedback** — floating button in the dashboard opens a modal to submit bug reports or feature requests directly as GitHub Issues. Server-side GitHub API integration with fine-grained PAT (token never exposed to client). Per-user rate limiting (5/hour). Auto-labels issues (`bug` / `enhancement`). Includes reporter context (name, email, page URL). Gracefully hidden when `GITHUB_FEEDBACK_TOKEN` / `GITHUB_FEEDBACK_REPO` env vars are not set.
- **Production deployment** — deployed to Hetzner Cloud CX23 (2 vCPU, 4GB RAM, Ubuntu 24.04) with Caddy reverse proxy, systemd service management, and one-command deploy script (`~/deploy.sh`)
- **Cloudflare CDN** — DNS, DDoS protection, edge caching, SSL termination (Full strict mode), and AI training bot blocking via Cloudflare Free plan
- **Deploy workflow** — `ssh deploy@server '~/deploy.sh'` pulls latest code, installs deps, builds, and restarts the systemd service
- **UFW firewall** — only ports 22 (SSH), 80 (HTTP), 443 (HTTPS) open

### Fixed

- **S3 bucket policy MinIO compatibility** — replaced `PutBucketPolicy` with `DeleteBucketPolicy` because MinIO doesn't support the `aws:PrincipalType` condition key used in the deny-anonymous policy; buckets without a policy are private by default in MinIO

### Changed

- **S3 bucket privacy strategy** — instead of setting an explicit deny-all policy (which used AWS-only condition keys), the startup plugin now deletes any existing bucket policy to ensure MinIO's default private behavior

---
## 2026-02-28

### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post



### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post

## 2026-02-15

### Added

- **Recruiter dashboard** (`app/pages/dashboard/index.vue`) — at-a-glance overview with four stat cards (Open Jobs, Total Candidates, Applications, Unreviewed), pipeline breakdown bar chart with color-coded status segments, jobs by status breakdown, recent applications list with relative timestamps, and top active jobs with new-application badges
- **Dashboard stats API** (`server/api/dashboard/stats.get.ts`) — single endpoint returning all dashboard data: summary counts, pipeline breakdown, jobs by status, recent 10 applications with candidate/job info, and top 5 active jobs by application count — all org-scoped with parallel query execution
- **Dashboard composable** (`app/composables/useDashboard.ts`) — wraps stats endpoint with computed unwrappers for all dashboard sections
- Quick action buttons (Create Job, Add Candidate) in dashboard header
- Welcome empty state for new organizations with CTA to create first job
- Loading skeleton states for all dashboard widgets
- **Public roadmap page** (`app/pages/roadmap.vue`) — cinematic horizontal-scrolling timeline with 15 glassmorphism milestone cards, color-coded by status (shipped/building/vision), scroll-tracking progress glow on the timeline axis, smooth mousewheel-to-horizontal scroll conversion via requestAnimationFrame, and intro card centered on page load
- **Roadmap showcase section on landing page** — "Built in the open" section with mini timeline showing Shipped/Building/Vision counts and prominent CTA to full roadmap
- **Roadmap navigation links** — Roadmap link added to landing page navbar and footer

---
## 2026-02-28

### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post



### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post

## 2026-02-15

### Added

- **IP-based rate limiting** — reusable `createRateLimiter()` utility (`server/utils/rateLimit.ts`) using a sliding window algorithm with automatic stale entry pruning; applied to public application endpoint (5 requests per IP per 15 minutes); returns standard `X-RateLimit-*` headers and `429 Too Many Requests` when exceeded
- **Candidates table view per job** — new `/dashboard/jobs/:id/candidates` page showing all applicants in a Supabase-style data table with columns for name, email, status, score, and applied date; includes status filter dropdown
- **Candidate detail sidebar** — clicking a row in the candidates table opens a slide-over panel (`CandidateDetailSidebar.vue`) with full application details: status transitions, candidate info, notes (editable inline), question responses, and links to full candidate/application pages
- **Sidebar "Candidates" tab** — job context sub-nav now includes a "Candidates" tab (with `Table2` icon) between Pipeline and Application Form
- **File upload question type** — recruiters can add `file_upload` fields to custom application forms, letting applicants upload resumes, cover letters, or other documents (PDF, DOC, DOCX — max 10 MB)
- **Multipart form support on public apply endpoint** — `POST /api/public/jobs/:slug/apply` now supports `multipart/form-data` when file uploads are present, with full security: magic byte MIME validation via `file-type`, server-generated S3 storage keys, per-file size limits
- **DynamicField file input** — `DynamicField.vue` renders drag-and-drop style file selector for `file_upload` questions with clear/remove support
- **Automatic document type detection** — uploaded files are auto-classified as `resume`, `cover_letter`, or `other` based on question label heuristics
- **Document records from public submissions** — files uploaded via the public apply form create `document` records linked to the candidate, visible on the recruiter's candidate detail page
- **Inline PDF preview** — recruiters can preview PDF documents directly in the candidate detail sidebar and candidate page without downloading; uses a same-origin server-proxied streaming endpoint (`GET /api/documents/:id/preview`) that pipes S3 bytes through the Nitro server
- **Document security hardening** — comprehensive security audit and fixes:
  - Private S3 bucket policy enforcement on startup (explicit deny-all-anonymous-access)
  - Filename sanitization utility (`sanitizeFilename`) preventing path traversal, XSS, and filesystem exploits
  - Per-candidate document limit (max 20) enforced on public apply endpoint
  - `storageKey` filtered from API responses (never exposed to clients)
  - Global security headers via Nitro route rules: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-XSS-Protection`, `Permissions-Policy`
  - Docker Compose ports bound to `127.0.0.1` (Postgres, MinIO, Adminer)

### Changed

- **Document downloads now server-proxied** — `GET /api/documents/:id/download` no longer returns a presigned S3 URL; instead streams file bytes directly through the authenticated server endpoint, eliminating the risk of URL sharing/leakage
- **Document preview now server-proxied** — `GET /api/documents/:id/preview` streams actual PDF bytes through the server instead of returning a presigned URL; iframe loads from same origin, eliminating cross-origin issues
- **Document cache headers hardened** — both download and preview endpoints now use `Cache-Control: private, no-store` instead of `private, max-age=300`, preventing browser/proxy caching of sensitive candidate documents on shared computers
- **`useDocuments` composable** — `downloadDocument()` now opens the server-proxied endpoint URL directly instead of fetching and redirecting to a presigned URL; `getPreviewUrl()` is now synchronous, returning the API endpoint path directly
- **`X-Frame-Options` route override** — global `DENY` policy with `SAMEORIGIN` exception for `/api/documents/*/preview` to allow inline PDF iframe rendering
- **Public apply form** — now uses `FormData` instead of JSON when the application form includes file upload questions; falls back to JSON for forms without files
- **QuestionForm type selector** — added "File Upload" option to the question type dropdown
- **JobQuestions type labels** — added `file_upload: 'File Upload'` to display labels

## 2026-02-14

### Added

- **Dynamic sidebar job tabs** — when viewing a specific job (`/dashboard/jobs/:id/*`), the sidebar shows contextual sub-navigation: Overview, Pipeline, Application Form
- **Application Form tab page** (`app/pages/dashboard/jobs/[id]/application-form.vue`) — dedicated page for custom questions management and shareable application link
- **Sidebar icons** — all main nav items now display Lucide icons (LayoutDashboard, Briefcase, Users, Inbox, LogOut)
- **"All Jobs" sidebar back-link** — quick return to jobs list from any job sub-page

### Changed

- **Sidebar redesign** — replaced scoped CSS with Tailwind utility classes; added dynamic job context section with tab-based navigation
- **Dashboard layout** — removed `max-w-4xl` wrapper from `dashboard.vue`; each page now controls its own `mx-auto max-w-*` for proper centering
- **All dashboard pages** — added `mx-auto` to root elements for centered content within the main area
- **Dashboard index** — converted from `<style scoped>` to Tailwind utility classes
- **Job detail page** — removed "Back to Jobs" link, "View Pipeline" button, application link section, and Application Form Questions section (all moved to sidebar tabs / dedicated application-form page)
- **Pipeline page** — removed "Back to Job" link (sidebar provides navigation)

### Removed

- **"Back to X" links** on job sub-pages — sidebar now provides all navigation context
- **Scoped CSS** in `AppSidebar.vue` and `dashboard/index.vue` — replaced with Tailwind utilities

---
## 2026-02-28

### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post



### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post

## 2026-02-14

### Added

- **SEO-friendly job slugs** — public job URLs now use human-readable slugs instead of UUIDs (e.g. `/jobs/senior-software-engineer-a1b2c3d4` instead of `/jobs/a1b2c3d4-...`)
- **Custom slug support** — recruiters can optionally set a custom slug when creating or editing a job; defaults to auto-generated from job title
- **Slug utility** — `server/utils/slugify.ts` with `generateJobSlug(title, id, customSlug?)` function, auto-imported by Nitro
- **Migration** — `0002_kind_inertia.sql` adds `slug` column to `job` table with unique constraint and backfills existing rows

### Changed

- **Public API routes** — `GET /api/public/jobs/:id` and `POST /api/public/jobs/:id/apply` replaced by slug-based routes (`/api/public/jobs/:slug` and `/api/public/jobs/:slug/apply`)
- **Public pages** — `app/pages/jobs/[id]/` renamed to `app/pages/jobs/[slug]/` (detail, apply, confirmation)
- **Job list links** — public job board now links to `/jobs/<slug>` instead of `/jobs/<id>`
- **Dashboard application link** — "Copy Application Link" now generates slug-based URLs
- **Job create/update APIs** — `POST /api/jobs` generates slug on creation; `PATCH /api/jobs/:id` regenerates slug when title or slug changes
- **Zod schemas** — `createJobSchema` and `updateJobSchema` now accept optional `slug` field

### Fixed

- **Honeypot bypass** — removed `z.string().max(0)` from honeypot schema that caused Zod to reject bot submissions with 422 instead of silently discarding them; honeypot validation now handled at runtime only
- **Candidate data overwrite** — public `apply.post.ts` no longer unconditionally overwrites existing candidate `firstName`/`lastName`/`phone`; now only backfills empty fields to prevent data corruption via re-application
- **Application ID leak** — public apply response no longer exposes the internal `applicationId`
- **Reorder atomicity** — question reorder endpoint now runs inside a database transaction instead of `Promise.all` to prevent partial reorder on failure
- **Unbounded applications eager-load** — `GET /api/jobs/:id` now limits eager-loaded applications to 100 with explicit column selection instead of loading all columns for all applications

---
## 2026-02-28

### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post



### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post

## 2026-02-15

### Added

- **Public job board** (`app/pages/jobs/index.vue`) — browse all open positions with search, type filter, and pagination (no auth required)
- **Public job detail page** (`app/pages/jobs/[id].vue`) — view full job description, requirements, and "Apply Now" CTA (no auth required)
- **API: `GET /api/public/jobs`** — lists open jobs with pagination, search (title/location), and type filter
- Zod validation schema `publicJobsQuerySchema` for public job listing query params
- "Open Positions" navbar link on landing page
- "View Open Positions" CTA button in landing page hero section
- "Back to job details" link on application form page
- "Browse more positions" button on application confirmation page
- Cross-linked navigation flow: Landing → Job Board → Job Detail → Apply → Confirmation → Job Board

---
## 2026-02-28

### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post



### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post

## 2026-02-15

### Added

- **Public landing page** (`app/pages/index.vue`) — dark-mode marketing page with Hero, Value Props, How It Works, Tech Stack, CTA, and Footer sections
- `lucide-vue-next` icon library — high-quality, tree-shakeable icons for the entire frontend
- Dark landing page design system: `#09090b` background, `white/[0.06]` glass borders, subtle glow effects, grid pattern overlay (Linear/Resend/Raycast aesthetic)
- SEO meta tags on landing page via `useSeoMeta` (title, description, OpenGraph)
- Auth-aware navbar on landing page — shows Dashboard link for authenticated users, Sign In / Get Started for guests
- Brand SVGs for tech stack section (Nuxt, PostgreSQL)

### Changed

- `app/pages/index.vue` — replaced auth redirect with full public landing page
- Disabled Nuxt DevTools in `nuxt.config.ts` (`devtools: { enabled: false }`)

### Fixed

- White bar at bottom of landing page — added `useHead({ bodyAttrs: { style: 'background-color: #09090b;' } })` to override light body background from `main.css`
- Extra scroll space at bottom — added `overflow-hidden` to CTA section to contain decorative glow blob using `translate-y-1/2`

---
## 2026-02-28

### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post



### Added

- **Blog: OpenCATS vs Reqcore: Open Source ATS Head-to-Head** — Published to `content/blog/opencats-vs-reqcore.md`
- **Internal link** — added cross-link from `best-open-source-applicant-tracking-systems.md` to new post

## 2026-02-14

### Added

- Tailwind CSS v4 integration via `@tailwindcss/vite` plugin
- Global CSS entry point at `app/assets/css/main.css` with `@theme` brand color tokens
- Semantic color palette: brand (indigo), accent (teal), surface (slate), success (emerald), warning (amber), danger (rose), info (sky)
- Class-based dark mode support via `@custom-variant dark`
- Base layer with antialiased rendering and dark mode body defaults
- Tailwind CSS context engineering: instruction file, skill file, copilot-instructions updates
- Nuxt 4 project scaffold with `app/` directory structure
- Docker Compose infrastructure: PostgreSQL 16, MinIO (S3), Adminer
- Drizzle ORM setup with postgres.js driver (`server/utils/db.ts`)
- Zod-validated environment variables (`server/utils/env.ts`)
- Auto-apply migrations on server startup with advisory lock (`server/plugins/migrations.ts`)
- Better Auth integration with organization plugin (`server/utils/auth.ts`)
- Auth catch-all route (`server/api/auth/[...all].ts`)
- Auth client composable (`app/utils/auth-client.ts`)
- Domain schema: `job`, `candidate`, `application`, `document` tables with relations
- Job status workflow enum: draft → open → closed → archived
- Application status workflow enum: new → screening → interview → offer → hired/rejected
- Document type enum: resume, cover_letter, other
- Per-org candidate deduplication (unique index on `organizationId` + `email`)
- `PRODUCT.md` — product vision, UVP, and target users
- `ARCHITECTURE.md` — system architecture, directory structure, and security boundaries
- `ROADMAP.md` — living roadmap with milestones and progress tracking
- `README.md` — project overview, setup instructions, and contributing guide
- Context engineering setup: copilot-instructions, architect/implement agents, plan prompt, domain instruction files
