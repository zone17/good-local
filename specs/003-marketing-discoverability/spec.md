# Feature Specification: Marketing Discoverability

**Feature Branch**: `003-marketing-discoverability`

**Created**: 2026-06-11

**Status**: Draft

**Input**: User description: "Marketing discoverability: make the public marketing surface visible to search engines, social scrapers, and link previews; per-route metadata; sitemap/robots; structured data; honest 404s; content engine enablement (richer authoring, target-query copy, supporting pages) — the engineering dependency of the GTM launch plan."

**Attestation chain**: subordinate to `docs/audits/production-readiness-2026-06-11.md` (SEO findings), `docs/marketing/gtm-launch-strategy.md` (channel plan this enables), `docs/prfaq-good-local.md`, and the marketing house style (D-026: plain voice, no dashes, no fake stats). Conflicts resolve toward the constitution and house style.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A shared link looks like a real product (Priority: P1)

A weekender shares goodlocal.app (or a blog post) into a local Facebook group, a town chat, or a text thread, and the preview shows the brand image, a real title, and a real description — for the homepage and for each individual post.

**Why this priority**: Local Facebook groups and word-of-mouth links are the product's primary patron channel (GTM plan §3). Social scrapers do not execute scripts, so today every share renders as a bare URL with one generic title — the channel is broken at the moment of launch (SEO-003, SEO-001). This is the single highest-leverage marketing fix.

**Independent Test**: Paste the homepage URL and one blog-post URL into the Facebook sharing debugger and a text message; both render branded image, correct title, correct description without any cache games.

**Acceptance Scenarios**:

1. **Given** the homepage URL is shared anywhere previews render, **When** the preview loads, **Then** it shows the brand share image, the site title, and the positioning description.
2. **Given** a published blog post URL is shared, **When** the preview loads, **Then** it shows that post's own title, excerpt, and cover image (not the generic site preview).
3. **Given** a scraper that never executes scripts fetches any marketing page, **When** it parses the response, **Then** the preview metadata is present in the initial document.

---

### User Story 2 - Search engines can find, read, and rank the marketing surface (Priority: P2)

Someone searching for the region, its towns, or a small-business loyalty solution finds Good Local's pages, each with its own title and description; crawlers receive real page content, a sitemap, and honest not-found responses.

**Why this priority**: The content engine (blog, podcast, town pages) is the GTM plan's organic compounding loop, but publishing into the current setup wastes the content: crawlers get an empty shell, every route shares one title, there is no sitemap, and any garbage URL returns a full copy of the landing page (SEO-001/002/004/005/006/007). Fixing discoverability *before* the launch-week content push is sequencing-critical.

**Independent Test**: Fetch every marketing route as a non-rendering crawler and verify readable content, unique titles/descriptions, and canonical URLs; request a nonsense path and verify a not-found result; submit the sitemap to a search console and verify it parses with all published content listed.

**Acceptance Scenarios**:

1. **Given** any marketing route (home, blog list, each post, podcast), **When** fetched without script execution, **Then** the response contains the page's real heading and body content, a unique title, a unique description, and a canonical URL.
2. **Given** a new blog post is published, **When** the sitemap is fetched, **Then** the post's URL is present without manual steps.
3. **Given** a crawler requests robots guidance, **When** it fetches the file, **Then** it receives valid directives: marketing surfaces allowed, app/admin/check-in surfaces excluded, sitemap referenced.
4. **Given** a URL that matches no real page, **When** it is requested, **Then** the visitor sees a branded not-found page and crawlers receive not-found semantics (no more infinite landing-page copies).
5. **Given** the secondary hosting domain is requested, **When** it loads, **Then** it permanently redirects to the canonical domain.
6. **Given** the app, business, admin, and check-in surfaces, **When** crawled, **Then** they are excluded from indexing.

---

### User Story 3 - The product earns rich results and local trust signals (Priority: P3)

Search engines understand what Good Local is (an organization with a site), what each post is (an article with an author and date), and eventually what each participating business is — and a skeptical owner or journalist can find who runs this and how to reach them.

**Why this priority**: Structured data and E-E-A-T pages (about, contact, authorship) multiply the value of US2 but depend on it landing first (SEO-008, SEO-013). For a $79/month ask from small-town owners, "who runs this" answerable on the site is also a sales requirement.

**Independent Test**: Run marketing pages through a rich-results validator with zero errors; verify an about page with real names/contact exists and is linked from the footer; verify each post shows an author.

**Acceptance Scenarios**:

1. **Given** the homepage, **When** validated, **Then** organization and website structured data pass with no errors.
2. **Given** a published post or episode, **When** validated, **Then** article/episode structured data (headline, author, date, image) passes.
3. **Given** a visitor wanting to know who is behind this, **When** they look in the footer, **Then** an about page with the team's real identity, the region story, and a contact path exists.

---

### User Story 4 - The content engine can express real content that targets real queries (Priority: P4)

An author can publish town guides and business spotlights that include lists and images; the landing page carries the words people actually search; and all marketing copy passes the house style.

**Why this priority**: The GTM content plan (town guides, spotlights, owner-intent pages) hits authoring limits on post one — the renderer supports no lists or images (SEO-015) — and the landing's hero copy contains none of the target query language (SEO-009). Copy fixes also close the three live dash violations (SEO-012) and remaining copy nits (SEO-014).

**Independent Test**: Publish a test post containing a list and an image and verify both render safely; review the landing copy against the target query set and house style checklist.

**Acceptance Scenarios**:

1. **Given** an author writes a post with bulleted lists and inline images, **When** it is published, **Then** both render correctly with the same safety guarantees as existing content.
2. **Given** the landing page, **When** reviewed against the target query set (region name, town names, "loyalty program", "digital punch card"), **Then** each appears naturally in crawlable copy without sacrificing the brand voice.
3. **Given** all marketing surface copy (pages, titles, descriptions), **When** scanned, **Then** zero dash-style violations remain and copy inconsistencies (blog teaser mismatch, public admin link) are resolved.

---

### User Story 5 - The operator has an off-site local visibility playbook (Priority: P5)

The operator knows exactly which off-site actions establish local presence — business profile listing, local citations, podcast directory submission, and the owner-onboarding step that asks each business to link Good Local — and tracks them as launch checklist items.

**Why this priority**: Off-site signals (SEO-017) are the cheapest authority builders for hyperlocal queries but are operator actions, not code. Documenting them as a checklist keeps them from being lost; they gate nothing else.

**Independent Test**: A written playbook exists in the runbooks with owner, action, and status for each item; at least the business profile listing is completed before launch week.

**Acceptance Scenarios**:

1. **Given** the launch checklist, **When** the operator works it, **Then** each off-site item (business profile, citations, podcast directories, owner cross-link ask) has an owner, steps, and a status.

---

### Edge Cases

- A post is published, then unpublished or its slug edited → previews, sitemap, and structured data must reflect the change without manual cache-busting steps; old slug should not 200.
- Content with characters that break markup (quotes, angle brackets) in titles/excerpts → metadata must be escaped everywhere it is emitted.
- A post without a cover image → previews fall back to the brand share image, never a broken image.
- The publish-to-visible pipeline fails (e.g. the regeneration step errors) → publishing must fail visibly to the author, not silently serve stale pages.
- Crawl-accessible content must never include unpublished drafts.
- Preview correctness must hold for both the canonical domain and any URL variant that 308-redirects to it.
- House-style scanning must not flag legitimate non-copy uses (code, dates) — scope is marketing copy and metadata.

## Requirements *(mandatory)*

### Functional Requirements

**Link previews (US1)**
- **FR-001**: Every marketing route MUST emit social preview metadata (title, description, image, canonical URL) readable without script execution. *(SEO-003, SEO-001)*
- **FR-002**: A branded share image MUST exist as the site-wide default; published posts MUST use their own cover image and title in previews, falling back to the default when absent. *(SEO-003)*

**Crawlability & indexing (US2)**
- **FR-003**: Marketing routes (home, blog list, each published post, podcast) MUST serve their real content in the initial document so non-rendering crawlers can read them. *(SEO-001, SEO-011)*
- **FR-004**: Every route MUST have a unique, accurate title and description; marketing routes MUST declare canonical URLs. *(SEO-002, SEO-007)*
- **FR-005**: A sitemap MUST exist, list all published marketing URLs, update automatically on publish, and be referenced by a valid robots file that excludes the app, business, admin, and check-in surfaces. *(SEO-004, SEO-005, SEO-016)*
- **FR-006**: Unknown paths MUST present a branded not-found page with not-found semantics for crawlers; unknown blog slugs likewise. *(SEO-006)*
- **FR-007**: The secondary hosting domain MUST permanently redirect to the canonical domain. *(SEO-007, INFRA-012)*
- **FR-008**: Publishing, unpublishing, or re-slugging content MUST propagate to crawlable pages, previews, and the sitemap without manual operator steps, and failures of that propagation MUST be visible to the author. *(SEO-001 fix path)*

**Rich results & trust (US3)**
- **FR-009**: Organization and website structured data MUST be present site-wide; published posts and episodes MUST carry valid article/episode structured data. *(SEO-008)*
- **FR-010**: An about page (who runs Good Local, the region story, contact path) MUST exist and be linked from the footer; posts MUST display an author. *(SEO-013)*

**Content engine & copy (US4)**
- **FR-011**: The content renderer MUST support bulleted/numbered lists and inline images with the existing escape-first safety guarantees. *(SEO-015)*
- **FR-012**: Landing copy MUST incorporate the target query language (region, towns, category terms) in crawlable text while preserving the brand voice and house style. *(SEO-009)*
- **FR-013**: All marketing copy and metadata MUST pass house style (no dashes, no fake stats, plain voice); the three known violations and the copy inconsistencies MUST be fixed, and the public admin footer link removed. *(SEO-012, SEO-014, UX-025)*

**Off-site playbook (US5)**
- **FR-014**: A documented off-site visibility playbook MUST exist in the runbooks covering business-profile listing, local citations, podcast directory submission, and the owner cross-link onboarding step, each with owner and status. *(SEO-017)*

### Key Entities

- **Page metadata**: per-route title, description, canonical URL, preview image; for content pages, derived from the published record (title, excerpt, cover image, author, dates).
- **Share image**: the site-wide branded preview image and per-post cover images, with fallback rules.
- **Sitemap entry**: a published URL with last-modified information, regenerated on publish events.
- **Off-site checklist item**: action, destination, owner, status — lives in the operations runbook.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sharing the homepage and any published post into the major preview surfaces (Facebook debugger, iMessage, Slack) renders the correct image, title, and description on first fetch.
- **SC-002**: Fetching every marketing route without script execution returns its real heading and body copy; zero routes share a title or description.
- **SC-003**: 100% of published posts appear in the sitemap within minutes of publishing with no manual step; a search console accepts the sitemap with zero errors.
- **SC-004**: Ten random nonsense URLs all yield not-found semantics; zero duplicate copies of the landing page remain indexable; exactly one canonical domain serves content.
- **SC-005**: Rich-results validation passes with zero errors on the homepage and a sample post and episode.
- **SC-006**: A test post containing lists and images publishes and renders correctly with no safety regressions (verified against the existing content-safety tests).
- **SC-007**: A house-style scan of all marketing copy and metadata reports zero dash violations and zero unverifiable stats.
- **SC-008**: Within 30 days of the launch content push, the site receives measurable non-branded organic search impressions for at least 3 target queries (verified in the search console — leading indicator, not a gate).

## Assumptions

- The marketing surface keeps its current architecture; crawlability is achieved by generating static marketing documents at publish/build time (or equivalent metadata injection), not by migrating frameworks — the audit explicitly recommends against a framework migration for 4 routes.
- Publishing frequency is low (weekly cadence per the GTM plan), so regenerate-on-publish is acceptable; sub-minute propagation is not required.
- Per-town landing pages and per-business public pages (the larger local-page strategy, SEO-010) are deliberately out of scope here — they deserve their own spec once founding businesses exist; this spec makes the platform able to rank content at all.
- The web analytics dependency (measuring SC-008) ships in spec `002-launch-hardening` (FR-005 there).
- Off-site actions (US5) are operator work; the engineering deliverable is the playbook document only.
- The about page uses real names per the E-E-A-T recommendation; if the founders prefer pseudonymity, the page still names a reachable human contact (weakens but does not block the story).
