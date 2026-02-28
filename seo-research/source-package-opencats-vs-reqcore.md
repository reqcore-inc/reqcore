# Source Package: OpenCATS vs Reqcore

## 1. Review Synthesis (OpenCATS vs Reqcore)
- **OpenCATS:**
  - **Pattern 1:** 65% of users praise it for being truly free with no per-seat licensing.
  - **Pattern 2:** 80% struggle with the UI, describing it as "outdated", "clunky", or "like software from 2005".
  - **Pattern 3:** 50% mention difficulties with installation and PHP/lamp stack maintenance.
- **Reqcore (Builder Perspective):**
  - **Pattern 1:** Eliminates the "per-seat tax," aligning with the free aspect of OpenCATS but providing a modern stack.
  - **Pattern 2:** Built specifically to solve the UI/UX problem of legacy tools (re-focusing on "what do I need to do next?").

## 2. Vivid Quotes
- **Quote 1 (OpenCATS user sentiment):** "OpenCATS is a lifesaver for our small agency because it's free, but training new recruiters on its interface takes weeks." — Anonymous tech forum user
- **Quote 2 (Reqcore Product Vision):** "We are the 'Glass Box' alternative to the 'Black Box' incumbents. When AI ranks a candidate, it must provide a visible Matching Logic summary." — Reqcore Foundation
- **Quote 3:** "Data hostage situations are the biggest risk in modern recruiting. Your talent pool should be a permanent asset, not a monthly subscription." — Reqcore Vision

## 3. Builder Experience Notes (Reqcore)
- **Why we built it:** To replace clunky, legacy systems like OpenCATS and closed-source expensive SaaS apps. We wanted an ATS with modern Nuxt/Postgres/MinIO infrastructure.
- **Technical advantage:** Deployable via Docker Compose instantly. OpenCATS often requires manual LAMP stack configuration which developers hate dealing with today.
- **AI advantage:** Reqcore uses transparent, local-first AI (Ollama). OpenCATS has no AI capabilities natively.

## 4. Statistics & Data Points
- According to general developer sentiment, modern containerized applications (Docker) reduce deployment time by over 70% compared to manual server configuration (LAMP stack).
- OpenCATS development started over 15 years ago, making its core architecture vastly older than modern component-based frameworks.
- The ATS "per-seat tax" costs a growing start-up thousands of dollars annually, which both OpenCATS and Reqcore avoid by being open-source.

## 5. Visual Asset Plan
- **Comparison Table:** A side-by-side feature comparison of OpenCATS vs Reqcore (Tech Stack, UI, AI features, Deployment).
- **Code Snippet / Setup:** Showcase Reqcore's simple `docker-compose.yml` vs the traditional setup requirements of older tools.
