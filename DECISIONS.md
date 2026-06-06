# Good Local — Architectural Decision Log

> Index of binding decisions. Detail lives in the attestation chain (`docs/`, `specs/`,
> `.specify/memory/constitution.md`) — entries here are pointers, not duplicated prose
> (Constitution Art. XXXII).

| ID | Date | Decision | Status | Detail |
|----|------|----------|--------|--------|
| D-001 | 2026-06-06 | **Mechanism: two-loop regional passport, not a points coalition.** Depth = same-business repeat visits; breadth = season-cumulative regional progress. Shared currency demoted to a gated Phase-2 experiment. | Adopted (verified) | `docs/discovery/02-opportunity-map.md`, `04-verification-verdicts.md` P1/P5 |
| D-002 | 2026-06-06 | **Pricing: $79/mo from day one** (founder decision, overriding the free-season recommendation); founding-rate lock; $49 winter tier Nov–Apr. | Adopted (founder) | `04-verification-verdicts.md` addendum; PR/FAQ v2 internal FAQ |
| D-003 | 2026-06-06 | **Standalone-first architecture** — every business's program fully functional with zero other participants; network compounds on top. | Adopted (founder) | PR/FAQ v2; Constitution Art. IV |
| D-004 | 2026-06-06 | **Check-in trust model is constitutional**: rotating codes + server-side validation + 1/patron/business/day + two attribution paths only; unverifiable check-ins void all gates. | Adopted | Constitution Art. II; spec FR-013–018 |
| D-005 | 2026-06-06 | **Patron privacy boundary enforced at domain layer**: owners see own-business aggregates only; cross-business history never exposed. | Adopted | Constitution Art. V; spec FR-029 |
| D-006 | 2026-06-06 | **Stamps carry no monetary value** (closed-loop NY/PA posture); change requires legal review + constitutional amendment. | Adopted | Constitution Art. VI |
| D-007 | 2026-06-06 | **The launch is pre-registered experiment A1** — gates, thresholds, kill condition (Aug 15), sample floor (Jul 31), retention read (Nov 1) are binding; instrumentation is launch-blocking. | Adopted (verified) | `docs/discovery/00-discovery-brief.md`; Constitution Art. III |
| D-008 | 2026-06-06 | **Design system vendored at `design/` as canonical** (Claude Design handoff): pine/stamp/ochre/river/paper tokens, Newsreader + Public Sans + DM Mono, round NP stamps, pine-leather pass, Stamped Moment icon. Product surfaces consume, never fork. | Adopted | `design/README.md`; Constitution Art. VIII; skill `.claude/skills/good-local-design` |
| D-009 | 2026-06-06 | **Frontend stack: Vite + React, two runtime deps**, mobile-web-first; `app/src/data.js` is the single mock data seam to swap for the API. Distribution issuance (wallet-pass-first vs home-screen) is an open A/B resolved in the pre-launch landing test. | Adopted (A/B open) | `app/README.md`; `04-verification-verdicts.md` P7 |
| D-010 | 2026-06-06 | **Domain hierarchy: Region → Town → Business; Patron outside the tree.** Passports, seasons, milestones, picks are region-scoped; v1 ships one region as data; no multi-region infrastructure before region #2 exists. | Adopted | spec Key Entities + FR-035; Constitution Art. XVI |
| D-011 | 2026-06-06 | **Constitution v1.0.0 ratified** — modeled on the Diamond Ledger agent-native constitution; product-integrity Articles I–IX rebuilt for Good Local; Articles I, II, V, VI have no exception path short of amendment. | Ratified | `.specify/memory/constitution.md` |
| D-012 | 2026-06-06 | **Spec Kit drives delivery** — constitution → specify → plan → tasks → implement on `NNN-feature` branches; the holistic spec is bound to the attestation chain (conflicts resolve toward attestations). | Adopted | `specs/001-upper-delaware-passport/spec.md` |
| D-013 | 2026-06-06 | **Interim document styling** — Good Vibes Coding design system used strictly for docs/attestation HTML (self-contained files via `docs/assets/gvc/inline.py`), never for the product. | Adopted | `docs/assets/gvc/` |
