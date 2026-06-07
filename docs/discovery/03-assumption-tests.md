# Good Local — Discovery Artifact 3: Assumption Tests

> **Date:** June 6, 2026 · **Method:** Assumptions map (importance × evidence) → experiment cards for the top-right quadrant. Directional estimates are desk-research calls; they prioritize tests, they never replace them.

## Assumptions map

**Top-right = important + no evidence → TEST NOW (leap-of-faith)**

| ID | Assumption | Type | Importance | Evidence | Quadrant |
|---|---|---|---|---|---|
| A1 | Weekenders will check in at 2+ businesses and let the app steer a new visit | Desirability | Fatal if wrong | None (first-hand) | **TOP-RIGHT** |
| A2 | Mel's relationships convert to ≥15 **paying ($79/mo, day-one billing)** Narrowsburg businesses by June 20 — founder decision raised this gate from signatures to cash | Viability (GTM + WTP) | Fatal for June 30 | None — untested | **TOP-RIGHT** |
| A3 | Owners **stay paying through winter**: ≥60% on $79 or the $49 winter tier on November 1 (initial WTP is now observed at signup via A2; retention replaces intent as the renewal metric) | Viability | Fatal at scale | Indirect (pricing bands) | **TOP-RIGHT** (resolves Nov 1) |
| A4 | SCVA/DMO becomes a funded channel **in 2027** (2026 rounds closed — `04`/P4); near-term: letter of support only | Viability (channel) | Medium (no longer a season-one de-risker) | Analogous (Bandwango) | Top-left (one meeting, then monitor) |
| A5 | Visitor leakage is real (day visitors stop at 1–2 businesses) | Desirability (premise) | Medium-high | None | **TOP-RIGHT** |
| A6 | ≥15% cross-business **redemption** is achievable via points | Desirability | Was fatal — now **demoted** by S2 pivot | **Contrary evidence** (Fivestars, Plenti) | Top-LEFT (monitor; treat as likely false) |
| A7 | Check-in PWA buildable + 25 businesses onboarded by June 30 | Feasibility | High | Strong (scoping) | Top-left (monitor) |
| A8 | Locals 55+ adopt QR check-ins | Desirability | Low (weekender-first) | Contrary evidence | Bottom-left (ignore for v1) |
| A9 | Square/Toast won't ship community loyalty within 3 years | Viability | Medium | Good (structural) | Top-left (monitor) |
| A10 | Points/perk mechanics don't trigger NY/PA stored-value law | Ethical/legal | High | None | Top-right (cheap legal review — do it) |
| A11 | Network survives winter (Oct ≥25% of July activity) | Viability | High | Contrary-leaning (seasonality data) | Not testable before launch → design around it (billing, winter perks, **non-QR local enrollment path** — `04`/P3), measure in Oct |
| A12 | **Runway: ~11 months to first revenue (June 2026 → May 2027) is funded at planned burn** (`04`/G5) | Viability | Fatal | None — never stated | **TOP-RIGHT — write the number down before any code** |
| A13 | Check-ins are trustworthy (rotating QR + per-device daily rate limits) — every gate metric rides on this (`04`/G4) | Feasibility/Integrity | High (gates void without it) | Standard practice exists | Top-left → v1 scope requirement, fold into A10 legal memo |
| A14 | Perks are incremental, not cannibalized margin (promo cannibalization runs 30–50% — `04`/G2) | Viability | High (silent A3 killer) | Contrary-leaning (promo literature) | **TOP-RIGHT — test inside A2 (perk-design question)** |

## Experiment cards (top-right, cheapest-first)

### A2 — The Mel Test *(run first: cheapest, fastest, gates everything)*
```
Assumption:     Mel's Narrowsburg relationships convert to real commitments.
Hypothesis:     ≥15 of the first 25 owners Mel approaches sign AND PAY —
                $79/mo from day one (founder decision; no free season), with
                the founding pitch being the STANDALONE product: their own
                rewards program (stamps, perks, dashboard, QR kit) live the
                same day, network upside compounding on top. Founding-rate
                lock + launch-marketing placement + $49 winter tier.
Method:         Paid pre-sale (Mom Test: money > commitment > compliments —
                this is now the strongest evidence class available).
                The conversation now carries three verified additions (04):
                (1) PERK QUESTION (A14): "what could you give a 5th-visit
                regular that costs you almost nothing but feels special?"
                — perk-design constraint goes in the agreement (low-marginal-
                cost, visit-shaped, off-peak, status goods).
                (2) VALUE CHECK (04/P1): confirm owners are buying the
                repeat-customer dashboard + ranking, not the stamps —
                Loopy sells stamps at $25.
                (3) CHAMPION SCOUT (04/G3): identify one candidate second
                local relationship-holder among the founding owners.
Metric:         Paying founding subscriptions at $79/mo.
PASS ≥15 paying · FAIL <10 → launch date moves (scope does not); 10–14 →
                shrink cluster. A miss at $79 distinguishes price-vs-product
                within 14 days — itself valuable data.
Cost:           ~0 dollars; 1–2 weeks of Mel's conversations.
                Evidence: STRONGEST (pays).
Estimate:       Uncertain — harder than the signature version by design;
                wholly dependent on relationship depth + the standalone
                pitch landing. Confidence L.
```

### A1 — Weekender check-in behavior *(the bet's core)*
```
Assumption:     Weekenders adopt check-ins, return to the same places, and
                let the app steer a first visit somewhere new.
Hypothesis:     Among ≥200 active patrons by Aug 15: ≥40% of one-time
                check-in patrons reach a 2nd business within 21 days
                (breadth — target, not floor); same-business repeat-visit
                rate ≥15% AND median check-ins per active ≥2 (depth — the
                collection-toy detectors, 04/P1); ≥25% of ACTIVE patrons
                make a verified first visit the app steered.
Method:         The launch MVP IS the experiment (piecemeal MVP). Pre-launch
                proxy: goodlocal.app landing page + $200 geo-targeted IG/FB
                at NYC-weekender interest sets — PASS if email-signup CVR ≥8%.
                The landing test ALSO A/Bs "Add to Wallet" vs "Add to Home
                Screen" (resolves the open distribution question, 04/P7) and
                asks the empty-ranking question (04/G1).
Metric:         2nd-business rate · same-business repeat rate · median
                check-ins/active · steered-first-visit rate.
PASS as above · KILL/PIVOT the mechanic if 2nd-business <20% OR steered
                <10% OR median check-ins <2 OR same-business repeat <15%.
SAMPLE RULE:    <500 installs by July 31 → INCONCLUSIVE (extend or widen the
                cluster); never score a thin sample as pass or fail (04/P3).
INTEGRITY:      Reads are valid only on the A13 trust model (rotating QR +
                rate limits) — gates from unverifiable check-ins are void.
Cost:           landing test ~$250 / 2 days; full test = the launch itself.
Estimate:       Breadth likely true at moderate rates (QR fluency, passport
                analogy, Starbucks-transfer survey) — confidence M. DEPTH is
                the honest unknown: DMO passports show one-and-done behavior
                (0.29–1.3 check-ins/user), which is exactly why the depth
                gates exist — confidence L. The 15% REDEMPTION version
                remains likely false (Plenti/scale evidence) — confidence M-H.
```

### A4 — DMO channel *(demoted per 04/P4 — a 2027 track, one meeting now)*
```
Assumption:     SCVA becomes a funded channel in 2027; season one needs only
                goodwill from it, not money.
                CORRECTED FACT: there is no June 2026 grant round — 2026
                rounds closed Dec 16, 2025 and April 14, 2026; June is
                disbursement. Next application ~Nov 2026, awarded ~Jan 2027
                — after the Aug 15 kill gate. The program funds events and
                cultural orgs, not tech. SCVA is also an incumbent with an
                overlapping free product (GO! app, free listings since May
                2025, paid Key Data/Datafy analytics).
Hypothesis:     One meeting (scheduled when convenient — NOT competing with
                the build window) yields a non-binding letter of support and
                a co-marketing relationship.
Method:         Pitch Good Local as a COMPLEMENT: verified-return-visit data
                SCVA lacks; itinerary extension and shoulder-season steering
                (what its mandate cares about). Never as merchant SaaS, never
                as a rival to its free listings.
Metric:         Letter of support; agreement to revisit with season-one data
                for the ~Nov 2026 application or a 2027 sponsorship line.
PASS letter + 2027 path · FAIL explicit no → merchant-funded only; retry post-season.
Cost:           a deck + a meeting.   Evidence: weak until money moves (2027).
Estimate:       Letter likely; money uncertain and irrelevant to season one
                — confidence M. Founder hours stay on A2 and the build.
```

### A3 — winter retention *(superseded twice: 04/P6 hardened intent→cash; the June 6 founder decision then moved first cash to signup via A2)*
```
Assumption:     Owners who started paying $79/mo in June stay paying through
                the off-season — the product earns its winter.
Hypothesis:     On November 1, ≥60% of founding businesses are still active
                ($79 full rate or the $49 winter-value tier).
Method:         September interviews (Mom Test: "what did it change for you?"
                — and the attribution question, 04/G3: "if Mel weren't
                involved, would you still be paying?") + observed billing.
                Initial WTP is no longer this card's job — A2 observes it at
                signup. This card watches CHURN, the metric the seasonality
                evidence says is the real killer.
Metric:         Nov 1 paying rate; Mel-attribution split; winter-tier uptake.
PASS ≥60% paying Nov 1 · FAIL <40% → reprice/restructure the off-season
                (winter-value tier rework, seasonal pause with spring
                auto-resume, 2027 DMO subsidy — or accept seasonal revenue).
ANTI-$0 ANCHOR: positioning sells retention ROI + verified-regulars data —
                never listings/visitor marketing, which SCVA gives away free.
Cost:           ~10 hours of interviews in September; billing data is free.
Estimate:       Uncertain. Day-one billing makes October the first true
                churn test; the $49 tier and winter perks are the levers;
                perk economics (A14) is the silent killer to watch.
                Confidence M.
```

### A5 — Visitor-leakage premise
```
Assumption:     Day visitors stop at only 1–2 businesses.
Hypothesis:     Median stops per visiting party ≤2 (excluding the river outfitter).
Method:         Field observation + 20 Mom-Test micro-interviews at takeouts/
                parking areas over two July weekends ("walk me through where
                you stopped today").
Metric:         Median reported stops.
PASS ≤2 (premise holds) · If >3, the leakage story weakens — reweight toward
                weekender messaging entirely.
Cost:           2 afternoons.   Evidence: moderate (recall-based).
Estimate:       Likely true — confidence L-M (pure inference today).
```

### A10 — Stored-value legal check
```
Assumption:     Streak/milestone perks + non-cash points avoid NY/PA gift-card,
                escheatment, and money-transmission exposure.
Method:         2–3 hours of specialist counsel review of the v1 mechanics
                memo BEFORE launch (not an experiment — a gate).
PASS: written confirmation v1 mechanics are out of scope of both states' regimes.
Cost:           ~$500–1,500.   Estimate: likely fine for closed-loop, no-cash-value
                v1 — confidence M. Phase-2 money mechanics WILL need real work.
```

## Sequencing (next 24 days → season one) *(v2 per `04`)*

0. **Before any code:** A12 — write down the runway number (~11 months to first revenue at planned burn, who funds it).
1. **Now → June 20:** A2 (Mel Test, with perk + value + champion questions) + A10 (legal memo, now including A13 anti-gaming scope) run in parallel with the build. The $250 landing test runs the wallet-vs-home-screen A/B and the empty-ranking question. A2 <10 signatures = move launch date, not scope. **June 18: build-readiness pre-gate** — vertical slice (check-in → wallet pass/PWA) demoable, else launch slides to July 15.
2. **A4 (SCVA):** one meeting for a letter of support, scheduled around the build — not a June dependency.
3. **Launch → Aug 15:** A1 measured live (breadth + depth + steered, on the A13 trust model); A5 field-checked in July; July 31 sample-adequacy check (≥500 installs or A1 goes inconclusive).
4. **September:** Mel-attribution + what-did-it-change interviews; second-champion deliverable (G3) confirmed. (First cash already observed in June via A2 — day-one billing.)
5. **October–November 1:** A3 winter-retention reading (≥60% still paying) + A11 winter-activity reading — together they decide Phase 2's shape and the ~Nov 2026 SCVA application.

## The riskiest assumption (named)

**A1 — weekenders will check in at a second business, come back to the same places, and let the app steer a first visit somewhere new.** Everything else (Mel, SCVA, pricing, runway) can be true and the company still dies if A1 is false; A1 true makes the rest fixable. It sits top-right: fatal if wrong, zero first-hand evidence. The *redemption* version of it is likely false on Plenti/scale evidence; the *breadth* version is well-supported by passport analogs — and the *depth* version (same-business repeat) is the honest unknown those analogs warn about (one-and-done collection), which is exactly why the kill condition now carries collection-toy detectors alongside the breadth gate.
