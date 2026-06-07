# Good Local — Discovery Artifact 1: Research Synthesis

> **Date:** June 6, 2026 · **Input:** `docs/prfaq-good-local.md` · **Method:** 5 parallel research threads (coalition loyalty evidence, SMB willingness-to-pay, region data, check-in behavior, competitive/why-now), each adversarially scoped and cited.

## 1. Question & scope

Does a real, winnable opportunity underpin Good Local — a shared loyalty + trusted-discovery network for independent businesses in the Upper Delaware region — and do the PR/FAQ's load-bearing claims survive contact with evidence? Research informs the decision: **proceed / refine / pivot / kill** ahead of a June 30, 2026 launch.

## 2. Market context

**The region is bigger and busier than the PR/FAQ assumed.** A 40-mile radius of Barryville holds roughly **150,000–180,000 year-round residents** (PR/FAQ said 100–150k — low by up to ~2×). Sullivan County alone: 80,586 (2024 est.); Pike PA ~62,400; Wayne PA ~51,400. NPS counted **377,061 recreation visits** to the Upper Delaware river corridor in 2024 — up 39% in three years. Sullivan County visitor spending hit a record **$969M (2023)**, the highest per-resident tourism revenue in the Mid-Hudson region ($12,130/resident/yr). The weekender claim is solid: Sullivan's housing vacancy runs ~37% (Pike: 40.4%), dominated by second homes — among New York's highest concentrations.

**Seasonality is confirmed and severe.** River recreation is effectively zero October–April; an estimated 65–75% of visitor activity lands June–September. Businesses visibly contract in winter (Mon–Thu closures, outfitters relocating, farmers markets closed Nov–March). Inference (Med confidence): 20–30% of tourism-facing businesses close or heavily reduce hours off-season.

**Business base supports the plan.** Narrowsburg has ~35–50 operating storefronts; Callicoon ~40; Barryville ~17; Livingston Manor 30–50. The full region holds **150–250 independents**, of which ~60–100 fit the app's verticals. The PR/FAQ's 75-business launch network is plausible — it undershoots the regional ceiling.

**Why now — three real timing facts.** (1) **Foursquare exited consumer discovery in December 2024** — for the first time in 15 years no scaled consumer product ranks places by verified visits. (2) **QR/contactless is finally ubiquitous for small business** — 57% of US small businesses accept mobile wallets (2025, vs 42% in 2020); the hardware cost that killed Belly-era loyalty (iPad kiosks) is gone. (3) **First-party data urgency** — independents have no tooling for the post-cookie era; check-ins are the highest-signal first-party data an independent can collect.

## 3. Customer segments & jobs/pains

| Segment | JTBD | Evidence on pain | Satisfaction today |
|---|---|---|---|
| **Independent business owner** ($200k–$2M, owner-operated) | "Bring my regulars back one more time a month, and convert passing visitors into customers — without becoming a marketer." | BBB/G2 complaint records show owners burned by loyalty SaaS at $200–300/mo with opaque ROI ("no other businesses in our town use the program" — the #1 cancellation reason for Fivestars in a small town). >1/3 of restaurant operators dissatisfied with loyalty programs (Nov 2025). | Low — punch cards or nothing; complaint-heavy incumbents |
| **NYC weekender / second-home owner** | "When we're upstate, I want to find and become a regular at the good local spots, so I can feel like I belong here, not just visit." | Customer quote-level evidence thin (gap), but demographics are the Starbucks-app cohort: QR-fluent, discovery-motivated; a 2020 survey found 70% of Starbucks app users would switch to a local shop with a similar experience. | Low for discovery (Google/Yelp noise); zero for cross-business rewards |
| **Seasonal river visitor** (377k visits/yr) | "Make the most of my day trip." | Strong inferred leakage (1–2 stops per trip) but **unverified** — no data on actual stops-per-visitor | n/a — they don't know what they're missing |
| **Year-round local (skews older)** | "Be recognized and rewarded at the places I already go." | Adults 60+ are 65% uncomfortable with QR codes; older adults scan at only 37% the rate of younger adults even controlling for smartphone ownership | Punch cards work fine for them — this is the hardest segment |

## 4. Competitive / alternatives landscape

**The category is a documented graveyard** — and the failures are instructive, not disqualifying:

| Player | Outcome | Cause of death / state |
|---|---|---|
| Belly | Dead (sold for $3M after $30M raised) | Hardware cost + **never reached local merchant density** |
| Plenti (Amex) | Dead 2018 | Members redeemed at only 1–2 partners; anchor-exit domino |
| Air Miles Canada | Bankrupt 2023 | Top-10 partners = 90% of earn; concentration collapse |
| Fly Buys NZ | Closed 2024 | Cloud killed shared-infra advantage; ~1% reward value |
| Colu | Dead 2020 | Survived only on municipal subsidy |
| Shopkick | Dead March 2026 | Walk-in reward worth ~$0.04 — effort ≫ reward |
| LevelUp, Perka, Punchd | Absorbed/dead | Acquired into POS/delivery stacks |
| **Fivestars/SumUp** | Alive inside SumUp POS | **Capitola test: merchant density did NOT produce cross-merchant visits** |
| **Joe Coffee** | Alive, 665 partners | Survives by staying vertical (coffee) and pooling reward costs |
| **Yiftee** | Alive, 700 communities | Gift-card denominated (no points liability), chamber-funded |
| **Bandwango** | Alive, 280+ DMOs | **Sells to DMOs, not merchants** — merchants join free |
| inKind | Alive, $450M raised | A financing product (buys credit at ~50¢/$1) — explicitly city-focused, model doesn't transfer to $79 SaaS |

**Key structural finding:** None of Square/Toast/Clover has shipped or announced cross-merchant community loyalty (June 2026) — and there's a structural reason: each wants exclusivity within its own merchant ecosystem; a community network requires a **neutral aggregator**. The PR/FAQ's 3–5 year moat window is plausible (upgraded from inference toward fact).

**White space confirmed:** no product ranks local businesses by verified repeat visits as consumer discovery (Foursquare abandoned it; Beli is urban-social only; Swarm's 16B check-ins sit in a B2B data product). And **no loyalty/discovery app operates in the Upper Delaware region** — SCVA's GO! app is a brochure-style guide; Shop Small Sullivan is a seasonal promotion.

**Pricing context:** Square Loyalty $45–49/mo, Toast loyalty ~$185/mo add-on, Fivestars ~$299/mo (complaint epicenter), Loopy Loyalty $25–95, Kangaroo ~$79. **$79/mo sits below the complaint band ($150–300+) and at the top of the no-contract challenger band.** SumUp/Fivestars' 2024 forced-annual-contract conversion created a churn pool of frustrated merchants.

## 5. Regulatory / technical context

- **Points/stored value**: NY and PA gift-card and escheatment exposure from day one (network crosses the river). Points-as-marketing-instrument (no cash value, business-funded perks) materially reduces but does not eliminate this; legal review required before any paid-value mechanics. (Unchanged from PR/FAQ; still open.)
- **PWA feasibility**: iOS camera/QR works in Safari (iOS 11+); push requires home-screen install (iOS 16.4+); **iOS 26 (2026) defaults home-screen sites to web-app mode** — timing favors PWA. The real friction is the 3-step iOS "Add to Home Screen" flow; mitigation is register-side staff prompting, which is a training dependency, not tech.
- **June 30 feasibility**: a check-in + points + perks + directory PWA on managed infrastructure is buildable in the window; payments, POS integration, and fraud hardening are not. (Consistent with PR/FAQ Phase 1.)

## 6. Evidence vs. inference (load-bearing rows)

| # | Claim | Type | Source | Confidence |
|---|---|---|---|---|
| 1 | Fivestars' Capitola, CA density test failed — but its verbatim hypothesis was cross-merchant **deal advertising** at density, NOT shared-currency redemption. *(Corrected per `04`/P5: Medium relevance to the points question, not High.)* | **Fact** (scope corrected) | Odio/Product Managers Substack, 2022 | Medium (for S1 relevance) |
| 2 | Plenti members redeemed at only 1–2 partners; program died of anchor-exit cascade | **Fact** | Coleman Insights, Retail Dive, 2018 | High |
| 3 | Adding a merchant to a coalition produces positive spillover to incumbents — but only downstream of initial single-merchant engagement | **Fact** (direction) | Ngwe et al., SSRN 4094153, 2022 | Medium |
| 4 | Nectar: ~33% of redemptions occur away from the dominant earn partner (at national scale, with grocery anchor) | Fact | WP Loyalty citing Nectar, 2026 | Medium |
| 5 | **No published benchmark exists for the ≥15% cross-business redemption gate** | Gap | — | — |
| 6 | NPS Upper Delaware: 377,061 visits (2024), +39% over 3 years | **Fact** | NPS press release, 2024 | High |
| 7 | Sullivan County visitor spending $969M (2023), record | **Fact** | Tourism Economics/SCVA, 2024 | High |
| 8 | ~150–180k year-round residents within 40 miles (PR/FAQ figure low) | Inference from Census | Census QuickFacts 2024 | Medium-High |
| 9 | Sullivan housing vacancy ~37% / Pike 40.4% (second-home dominance) | **Fact** | Census | High |
| 10 | Adults 60+ : 65% uncomfortable with QR; older adults scan at 37% the rate of younger | **Fact** | William Blair 2023; Census Bureau working paper 2024 | High/Med |
| 11 | 68% of US consumers scanned a QR in the past year; +323% growth 2021–24 | **Fact** | Multiple, 2024 | High |
| 12 | Bond: consumers hold ~17.4 loyalty memberships, active in ~8.8 (PR/FAQ's "16+, fewer than half" essentially correct) | **Fact** | Bond Loyalty Report 2024–25 | High |
| 13 | <5% of customers will download a standalone app for a single small business | **Fact** | Multiple, 2024–25 | High |
| 14 | $79/mo is below the loyalty-SaaS complaint band; challengers cluster at $25–95 no-contract | **Fact** | Pricing pages, BBB/G2, 2024–26 | High |
| 15 | SMB SaaS monthly churn 3–7%; month-to-month ~16%/mo; 43% of losses in first 90 days | Fact (benchmarks) | AgileGrowthLabs et al., 2025 | Medium |
| 16 | No POS incumbent has announced cross-merchant community loyalty (as of June 2026) | **Fact** (absence) | Changelogs/announcements review | High |
| 17 | SCVA + Sullivan County run a **$300k tourism grant program** — ~~rounds March & June 2026~~ **CORRECTED (`04`/P4): 2026 rounds closed Dec 16, 2025 and April 14, 2026; June 2026 is disbursement to selected winners. Next application ~Nov 2026, awarded ~Jan 2027.** Recipients are events/cultural orgs, not tech | **Fact** (timing corrected) | sullivanny.gov, iloveny.com (Mar 2026) | High |
| 17b | SCVA moved ALL members to **free membership** (May 2025), bundling listings/marketing free while selling Key Data/Datafy merchant analytics — an incumbent with overlapping product AND a $0 anchor on merchant WTP for visitor-marketing | **Fact** | I Love NY, Sullivan County Democrat, River Reporter, May 2025 | High |
| 18 | Bandwango's model proves DMOs pay for this category; merchants enroll free | **Fact** | Bandwango, 280+ DMO clients | High |
| 19 | "Visitors hit 1–2 businesses then drive home" (the visitor-leakage premise) | **Unverified inference** | none found | Low |
| 20 | Mel's relationships convert to 15–25 signed Narrowsburg businesses | Untested assumption | — | — |

## 7. Key insights (the so-whats)

1. **The redemption gate is wrong, not the network idea.** *(Justification corrected per `04`/P5.)* The Fivestars Capitola test indicts cross-merchant *deal advertising* at density — its verbatim hypothesis — not shared-currency redemption, so it carries Medium weight here, not "single best natural experiment." The points demotion instead rests on directly on-point evidence: Plenti's 1–2-partner redemption concentration and anchor-exit death, Air Miles' concentration collapse, points liability at partner exit, and the scale dependency (Payback needs ~35M members/700 partners to reach 6.35 partners/customer — structurally unreachable at 15–75 merchants). The academic spillover literature still says coalition membership lifts incumbents *after* initial engagement. The opportunity is **cross-business discovery and identity** — the ≥15% *redemption* gate becomes a cross-business *visitation* gate, paired with same-business *depth* metrics so passport breadth can't masquerade as retention (see `04`/P1).
2. **The beachhead patron is the weekender, not the local or the tourist.** Weekenders are QR-fluent, repeat-visiting (2–8×/season), discovery-hungry, and identity-motivated ("be a regular here"). Locals skew QR-averse (60+); day tourists structurally cannot produce repeat behavior. Design, copy, and gates should be weekender-first.
3. **There is an institutional buyer — but for 2027, not season one.** *(Corrected per `04`/P4.)* Bandwango's business proves DMOs pay for visitor-engagement platforms while merchants join free. But SCVA's 2026 grant rounds are already closed and awarded (the "June 2026 round" was a misread — June is disbursement), its program funds events/cultural orgs rather than tech, and SCVA itself is an incumbent with an overlapping free product (GO! app, free listings, paid merchant analytics). The DMO track is real and worth one meeting now (letter of support, co-marketing, complement positioning) — and a funded channel only after season-one data.
4. **Winter is a churn machine unless billing respects it.** "Free first season" ending in October = first invoice lands as the region empties (Nov–Jan is also the worst generic SaaS churn window). Bill at season start, or build a hibernate tier.
5. **The category's killers are all addressable in 2026**: hardware cost (gone — QR), app-download friction (PWA/wallet pass), merchant density (Mel + 40-mile cluster focus), and neutral-aggregator absence (the POS incumbents structurally won't build it). The graveyard is a map, not a verdict.

## 8. Open questions → assumption tests

- Will weekenders actually check in at ≥2 businesses? (No first-hand behavioral data — top-right assumption.)
- Will Mel's relationships convert to ≥15 signed businesses by June 20? (Single cheapest, fastest test available.)
- Will SCVA entertain sponsorship/grant framing? (One meeting resolves it; June grant round is a forcing date.)
- Does the visitor-leakage premise hold? (Observable in two weekend afternoons of field counting.)
- Will owners pay $79/mo after a free season — or is a hibernate/seasonal tier required? (Mom-Test interviews + pre-commitment letters.)

→ Carried into `03-assumption-tests.md`.
