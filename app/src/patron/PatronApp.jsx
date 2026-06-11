// ============================================================
// Good Local — Patron mobile web (production adaptation)
// Adapted from design/ui_kits/patron/PatronApp.jsx — the design
// system at ../design is the visual source of truth.
// Changes from the kit: ES module imports, data moved to the
// mock data layer (../data.js), default export. Visuals unchanged.
// ============================================================
import React, { useState, useEffect } from "react";
import {
  Button, IconButton, Card, Badge, Tag, Icon,
  Field, Input, Switch, Tabs, Stat, Notice, Row, Divider,
  Stamp, StampGrid, WalletPass, ProgressMeter, SealMark,
} from "../ds.js";
import { usePassport } from "./usePassport.js";
import { useDiscovery, useBusinessDetail } from "./useDiscovery.js";

// Copy rule (design README): "2 visits to go" — with correct singulars.
const visits = (n) => `${n} ${n === 1 ? "visit" : "visits"}`;

// T039 — patron-facing perk-ready copy (shown wherever a perk hits threshold).
const PERK_READY_COPY = "Ready — show this at the register";

// "N of 12 towns" (singular helper, no rating affordances — brand rules).
const townLabel = (n) => `${n} ${n === 1 ? "town" : "towns"}`;

// ---- Screen chrome -----------------------------------------

function TopBar({ title, onBack, trailing }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "12px 14px 10px",
      borderBottom: "1px solid var(--ink-100)",
      background: "var(--paper-50)",
      position: "sticky", top: 0, zIndex: 5,
    }}>
      {onBack ? (
        <IconButton label="Back" onClick={onBack}><Icon name="arrow-left" size={20}/></IconButton>
      ) : (
        <div style={{ width: 44, height: 44, display: "grid", placeItems: "center", color: "var(--pine-700)" }}>
          <SealMark size={32}/>
        </div>
      )}
      <div style={{ flex: 1, fontWeight: 600, fontSize: 17, textAlign: onBack ? "left" : "center" }}>{title}</div>
      <div style={{ display: "flex", gap: 4 }}>{trailing}</div>
    </div>
  );
}

function TabBar({ value, onChange }) {
  const items = [
    { id: "home", label: "Passport", icon: "wallet" },
    { id: "discover", label: "Discover", icon: "compass" },
    { id: "checkin", label: "Check in", icon: "qr" },
    { id: "me", label: "Me", icon: "user" },
  ];
  return (
    <div style={{
      position: "sticky", bottom: 0, zIndex: 5,
      display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
      gap: 2, padding: "8px 10px 14px",
      background: "color-mix(in srgb, var(--paper-50) 92%, transparent)",
      backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
      borderTop: "1px solid var(--ink-100)",
    }}>
      {items.map((it) => {
        const active = value === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              padding: "8px 4px", background: "none", border: 0, cursor: "pointer",
              color: active ? "var(--pine-700)" : "var(--ink-500)",
              fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600,
              borderRadius: 10,
            }}
          >
            <Icon name={it.icon} size={22} strokeWidth={active ? 2 : 1.75}/>
            <span>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---- Patron Home --------------------------------------------

function PatronHome({ onSelectBiz, onGoTab }) {
  const { passport, loading } = usePassport();

  if (loading || !passport) {
    return (
      <div style={{ paddingBottom: 24 }}>
        <TopBar title="Passport"
          trailing={<IconButton label="Settings"><Icon name="settings" size={20}/></IconButton>}
        />
        <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--ink-500)", fontSize: 14 }}>
          Loading your passport…
        </div>
      </div>
    );
  }

  const { hero, businesses, region } = passport;
  const totalStamps = businesses.reduce((sum, b) => sum + b.stampCount, 0);
  const placeCount = businesses.length;
  const perksReady = businesses.filter((b) => b.perk?.ready).length;
  const heroPerk = hero?.perk ?? null;
  const heroRemaining = heroPerk ? Math.max(0, heroPerk.threshold - heroPerk.current) : 0;
  // Honest greeting: a real patron with no display name gets no invented one
  // (mock fallback still supplies ME.firstName when there is no backend).
  const firstName = passport.patron.displayName;
  const milestoneCount = region.milestones.length;

  return (
    <div style={{ paddingBottom: 24 }}>
      <TopBar title="Passport"
        trailing={<IconButton label="Settings"><Icon name="settings" size={20}/></IconButton>}
      />

      {/* Greeting — first-visit vs returning, with the honest season summary */}
      <div style={{ padding: "16px 18px 6px" }}>
        {/* v1 single region — names become API data when region #2 exists (Art. XVI) */}
        <div className="gl-eyebrow">Season 1 · Upper Delaware</div>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600,
          lineHeight: 1.05, marginTop: 6, letterSpacing: "-0.014em",
          fontVariationSettings: '"opsz" 32',
          textWrap: "balance",
        }}>
          {totalStamps === 0
            ? (firstName ? `Welcome to the river, ${firstName}.` : "Welcome to the river.")
            : (firstName ? `Welcome back, ${firstName}.` : "Welcome back.")}
        </div>
        <div style={{ color: "var(--ink-700)", fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>
          {totalStamps === 0
            ? "Walk into any participating spot and scan their QR. Your first stamp lands here."
            : <>You&apos;ve earned <strong>{totalStamps} {totalStamps === 1 ? "stamp" : "stamps"}</strong> across <strong>{placeCount} {placeCount === 1 ? "place" : "places"}</strong>{perksReady > 0 ? <> — <strong style={{ color: "var(--stamp-700)" }}>{perksReady} {perksReady === 1 ? "perk" : "perks"} ready</strong>.</> : "."}</>}
        </div>
      </div>

      {/* Hero — top-progress pass, sized natively (no scale hack — the pass
          box overflowed three separate ways in the design iteration) */}
      <div style={{ padding: "14px 16px 8px", display: "grid", placeItems: "center" }}>
        {hero ? (
          <WalletPass
            businessName={hero.name}
            region={hero.town}
            count={heroPerk ? heroPerk.current : hero.stampCount}
            total={heroPerk ? heroPerk.threshold : hero.stampCount}
            perkLabel={heroPerk ? heroPerk.name : "Your pass"}
            perkSub={heroPerk && heroPerk.ready ? PERK_READY_COPY : (heroPerk ? `${visits(heroRemaining)} to go` : "")}
            stampCode={hero.stampCode}
            expires="11·2026"
            style={{ "--pass-w": "308px", "--pass-h": "380px", boxSizing: "border-box" }}
          />
        ) : (
          <Card style={{ padding: "16px", width: "100%" }}>
            <div style={{ fontSize: 14, color: "var(--ink-700)", lineHeight: 1.5 }}>
              Your passport is ready. Scan the QR at any participating register to earn your first stamp.
            </div>
          </Card>
        )}
      </div>

      {/* CTA — the one action that matters */}
      <div style={{ padding: "10px 18px 14px" }}>
        <Button variant="primary" block leadingIcon={<Icon name="qr" size={18}/>} onClick={() => onGoTab("checkin")}>
          {totalStamps === 0 ? "Scan a register QR" : "Check in"}
        </Button>
      </div>

      {/* Hero perk progress (T039 — ready treatment); tappable through to the business */}
      {heroPerk ? (
        <div style={{ padding: "4px 16px 12px" }}>
          <Card style={{ padding: "14px 16px", cursor: "pointer" }} onClick={() => onSelectBiz(hero.slug)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div>
                <div className="gl-eyebrow" style={{ color: "var(--stamp-700)" }}>Closest to ready</div>
                <div style={{ fontWeight: 600, marginTop: 4, fontSize: 15 }}>{heroPerk.name}</div>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-500)" }}>
                {heroPerk.current}/{heroPerk.threshold}
              </span>
            </div>
            <ProgressMeter
              count={heroPerk.current}
              total={heroPerk.threshold}
              remainingLabel={heroPerk.ready ? "Ready" : `${visits(heroRemaining)} to go`}
            />
            {heroPerk.ready ? (
              <div style={{ marginTop: 12 }}>
                <Badge variant="solid-pine">{PERK_READY_COPY}</Badge>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--ink-700)", marginTop: 10 }}>
                You&apos;re <strong>{visits(heroRemaining)}</strong> from {heroPerk.name.toLowerCase()}.
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {/* My stamps — grouped per business with real dates */}
      <div style={{ padding: "8px 16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Your stamps</h3>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-500)" }}>
            {totalStamps} · season 1
          </span>
        </div>
        {businesses.length === 0 ? (
          <Card style={{ padding: "16px" }}>
            <div style={{ fontSize: 13, color: "var(--ink-500)", lineHeight: 1.5 }}>
              No stamps yet. Your first visit starts the season.
            </div>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {[...businesses]
              .sort((a, b) => {
                // Closest-to-perk first (design intent: momentum at the top).
                const ratio = (x) => (x.perk ? x.stampCount / x.perk.threshold : 0);
                return ratio(b) - ratio(a);
              })
              .map((biz) => {
              const ready = biz.perk?.ready;
              const total = biz.perk?.threshold ?? Math.max(biz.stampCount, 1);
              return (
                <div key={biz.slug} onClick={() => onSelectBiz(biz.slug)} style={{ cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{biz.name}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)" }}>{biz.town} · {visits(biz.stampCount)}</div>
                    </div>
                    {ready ? <Badge variant="solid-pine">{PERK_READY_COPY}</Badge> : null}
                  </div>
                  <StampGrid
                    size={48}
                    gap={8}
                    columns={total}
                    total={total}
                    stamps={biz.stamps.map((s) => ({ label: s.label, date: s.date, rotate: s.rotate, state: "earned" }))}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Region progress — "N of 12 towns" + milestones, river-curve watermark */}
      <div style={{ padding: "0 16px 8px" }}>
        <Card variant="kraft" style={{ padding: "16px", position: "relative", overflow: "hidden" }}>
          <svg viewBox="0 0 300 80" style={{ position: "absolute", right: -30, bottom: -10, width: 220, height: 80, opacity: 0.18, pointerEvents: "none" }} aria-hidden="true">
            <path d="M0 50 Q 40 20 80 50 T 160 50 T 240 50 T 320 50" stroke="var(--pine-700)" fill="none" strokeWidth="2"/>
            <path d="M0 62 Q 40 32 80 62 T 160 62 T 240 62 T 320 62" stroke="var(--pine-700)" fill="none" strokeWidth="1.5"/>
          </svg>
          <div style={{ position: "relative" }}>
            <div className="gl-eyebrow" style={{ color: "var(--pine-700)" }}>This season</div>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 600,
              lineHeight: 1.15, margin: "4px 0 10px", letterSpacing: "-0.012em",
              fontVariationSettings: '"opsz" 24',
            }}>
              {region.townsVisited} of {region.townsTotal} Upper Delaware towns
            </div>
            <ProgressMeter
              count={region.townsVisited}
              total={region.townsTotal}
              tone="ochre"
              remainingLabel={`${townLabel(Math.max(0, region.townsTotal - region.townsVisited))} to go`}
            />
            {milestoneCount > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {region.milestones.map((m) => (
                  <Badge key={m.id} variant="pine">{m.name}</Badge>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--ink-700)", marginTop: 10 }}>
                Visit a business in any new town to add it to your passport.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---- Check-in (T064: honest explainer) -----------------------
// The real check-in is the register QR -> the lean /c/{slug} entry (its own
// bundle, full trust model). This tab explains the mechanic; it never fakes a
// scan or a stamp (Art. I/II — no simulated check-ins in the product).

function CheckinScreen() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <TopBar title="Check in" trailing={<IconButton label="Help"><Icon name="info" size={20}/></IconButton>}/>

      <div style={{ padding: "24px 20px 0", textAlign: "center" }}>
        <div style={{ color: "var(--pine-700)", display: "grid", placeItems: "center" }}>
          <SealMark size={72}/>
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, lineHeight: 1.15, margin: "14px 0 6px", letterSpacing: "-0.012em" }}>
          Hold your camera over the QR by the register.
        </div>
        <div style={{ color: "var(--ink-700)", fontSize: 15, lineHeight: 1.55, maxWidth: 420, margin: "0 auto" }}>
          No app needed — your phone opens the stamp page, and the visit lands in
          this passport.
        </div>
      </div>

      <div style={{ padding: "22px 20px 0" }}>
        <Card style={{ padding: "16px" }}>
          <div className="gl-eyebrow">How it works</div>
          <ol style={{ margin: "10px 0 0", paddingLeft: 18, color: "var(--ink-700)", fontSize: 14, lineHeight: 1.7 }}>
            <li>Find the kraft card by the register.</li>
            <li>Point your camera at the code.</li>
            <li>That&apos;s the stamp — one per business per day.</li>
          </ol>
        </Card>
      </div>

      {/* Camera-off fallback — the staff path, framed as the design's
          dashed disclosure. The send happens at the register (staff_check_in
          → claim link by text); the patron's side stays honest: no form here
          can stamp anything (Art. II). */}
      <div style={{ padding: "18px 20px 0" }}>
        <div style={{
          display: "flex", flexDirection: "column", gap: 4,
          padding: "12px 16px", textAlign: "center",
          border: "1px dashed var(--ink-200)", borderRadius: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-700)" }}>
            Camera off? Use your phone number instead.
          </span>
          <span style={{ color: "var(--ink-500)", fontSize: 13, lineHeight: 1.6 }}>
            Give the counter your number and they&apos;ll stamp you in. Your
            stamps stay with your number, ready whenever you claim your passport.
          </span>
        </div>
      </div>
    </div>
  );
}

// ---- Discover ------------------------------------------------

function DiscoverScreen({ onSelectBiz }) {
  // useDiscovery fires recordImpressions ONCE per render over all visible ids.
  const { businesses, loading } = useDiscovery();

  return (
    <div style={{ paddingBottom: 24 }}>
      <TopBar title="Discover" trailing={<IconButton label="Search"><Icon name="search" size={20}/></IconButton>}/>

      <div style={{ padding: "16px 16px 8px" }}>
        <div className="gl-eyebrow">Founding picks across the Upper Delaware</div>
        <div style={{ color: "var(--ink-500)", fontSize: 13, marginTop: 6 }}>
          Hand-picked, never ranked. No paid placement, ever.
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--ink-500)", fontSize: 14 }}>
          Loading the region…
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 16px" }}>
          {businesses.map((biz) => (
            <BusinessCard key={biz.slug} biz={biz} onClick={() => onSelectBiz(biz.slug)}/>
          ))}
        </div>
      )}
    </div>
  );
}

function BusinessCard({ biz, onClick }) {
  return (
    <Card onClick={onClick} style={{ padding: 16, cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          {biz.curationLabel ? (
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.14em", color: "var(--stamp-700)",
              marginBottom: 4,
            }}>
              {biz.curationLabel}
            </div>
          ) : null}
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
            {biz.name}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 2 }}>
            {biz.town}{biz.category ? ` · ${biz.category}` : ""}
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 12, padding: "10px 12px",
        background: "var(--paper-100)", borderRadius: 10,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <Icon name="users" size={18} style={{ color: "var(--pine-700)" }}/>
        {biz.regularsEmpty ? (
          <span style={{ fontSize: 13, color: "var(--ink-700)" }}>
            Nobody&apos;s been a regular here yet. Be the first.
          </span>
        ) : (
          <span style={{ fontSize: 13, color: "var(--ink-1000)" }}>
            <strong>{biz.regulars}</strong> verified {biz.regulars === 1 ? "regular" : "regulars"} this season
          </span>
        )}
      </div>
    </Card>
  );
}

// ---- Business detail ----------------------------------------

function BusinessDetail({ bizId, onBack, onCheckIn }) {
  // bizId is a business slug. useBusinessDetail fires one business_detail
  // impression on open (the steer pipeline).
  const { detail: biz, loading } = useBusinessDetail(bizId);

  if (loading || !biz) {
    return (
      <div style={{ paddingBottom: 24 }}>
        <TopBar title="Loading…" onBack={onBack}/>
        <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--ink-500)", fontSize: 14 }}>
          Loading…
        </div>
      </div>
    );
  }

  const myPerk = biz.myProgress?.perks?.[0] ?? null;
  const myStampCount = biz.myProgress?.stampCount ?? 0;
  const perkReady = myPerk ? myPerk.current >= myPerk.threshold : false;
  const perkRemaining = myPerk ? Math.max(0, myPerk.threshold - myPerk.current) : 0;

  return (
    <div style={{ paddingBottom: 24 }}>
      <TopBar title={biz.name} onBack={onBack} trailing={<IconButton label="Share"><Icon name="share" size={20}/></IconButton>}/>

      <div style={{
        height: 150, background: "var(--river-700)", position: "relative", overflow: "hidden",
      }}>
        <svg viewBox="0 0 400 150" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.28 }} aria-hidden="true">
          <path d="M -10 60 Q 60 30 130 60 T 270 60 T 410 60" stroke="var(--paper-100)" fill="none" strokeWidth="2"/>
          <path d="M -10 90 Q 60 60 130 90 T 270 90 T 410 90" stroke="var(--paper-100)" fill="none" strokeWidth="1.5"/>
          <path d="M -10 120 Q 60 90 130 120 T 270 120 T 410 120" stroke="var(--paper-100)" fill="none" strokeWidth="1"/>
        </svg>
        <div style={{ position: "absolute", right: 16, top: 14, color: "var(--paper-100)", opacity: 0.85 }}>
          <SealMark size={56}/>
        </div>
        <div style={{ position: "absolute", left: 18, bottom: 14, color: "var(--paper-100)" }}>
          <div className="gl-eyebrow" style={{ color: "var(--paper-100)", opacity: 0.85 }}>{biz.town}</div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600,
            lineHeight: 1.05, marginTop: 4, letterSpacing: "-0.014em",
            fontVariationSettings: '"opsz" 30',
          }}>
            {biz.name}
          </div>
          {biz.category ? (
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.85 }}>{biz.category}</div>
          ) : null}
        </div>
      </div>

      <div style={{ padding: "18px 16px 8px", display: "flex", gap: 16 }}>
        {biz.regularsEmpty ? (
          <div style={{ fontSize: 13, color: "var(--ink-700)", lineHeight: 1.4 }}>
            Nobody&apos;s been a regular here yet. Be the first.
          </div>
        ) : (
          <Stat label="Verified regulars" value={biz.regulars}/>
        )}
        <Stat label="Your visits" value={myStampCount}/>
      </div>

      {myPerk ? (
        <div style={{ padding: "8px 16px" }}>
          <Card style={{ padding: "14px 16px" }}>
            <div className="gl-eyebrow" style={{ color: "var(--stamp-700)" }}>Your perk</div>
            <ProgressMeter
              count={myPerk.current}
              total={myPerk.threshold}
              remainingLabel={perkReady ? "Ready" : `${visits(perkRemaining)} to go`}
            />
            {perkReady ? (
              <div style={{ marginTop: 12 }}>
                <Badge variant="solid-pine">{PERK_READY_COPY}</Badge>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--ink-700)", marginTop: 10 }}>
                You&apos;re <strong>{visits(perkRemaining)}</strong> from your perk.
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <StampGrid
                size={44} gap={8} columns={myPerk.threshold} total={myPerk.threshold}
                stamps={Array.from({ length: Math.min(myPerk.current, myPerk.threshold) }).map((_, i) => ({
                  label: biz.stampCode, rotate: [-3, 2, -2, 3, -1][i % 5],
                }))}
              />
            </div>
          </Card>
        </div>
      ) : null}

      {biz.ownerNote ? (
        <div style={{ padding: "12px 16px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>Owner&apos;s note</h3>
          <Card variant="kraft" style={{ padding: "14px 16px", borderLeft: "3px solid var(--stamp-700)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 16, lineHeight: 1.4, color: "var(--ink-1000)" }}>
              {biz.ownerNote}
            </div>
          </Card>
        </div>
      ) : null}

      <div style={{ padding: "12px 16px 0", display: "flex", gap: 8 }}>
        <Button variant="primary" block leadingIcon={<Icon name="qr" size={18}/>} onClick={onCheckIn}>
          Check in here
        </Button>
        <IconButton
          bordered
          label="Directions"
          onClick={() => { if (biz.directionsUrl) window.open(biz.directionsUrl, "_blank", "noopener"); }}
        >
          <Icon name="map-pin" size={20}/>
        </IconButton>
      </div>
      {biz.hours ? (
        <div style={{ padding: "10px 16px 0", display: "flex", alignItems: "center", gap: 8, color: "var(--ink-700)", fontSize: 13 }}>
          <Icon name="calendar" size={16}/>
          <span>{biz.hours}</span>
        </div>
      ) : null}
    </div>
  );
}

// ---- Me (T064: real passport data, honest identity) ----------

function MeScreen() {
  const { passport, loading } = usePassport();

  if (loading || !passport) {
    return (
      <div style={{ paddingBottom: 24 }}>
        <TopBar title="Me"/>
        <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--ink-500)", fontSize: 14 }}>
          Loading your passport…
        </div>
      </div>
    );
  }

  const { businesses, region, patron } = passport;
  const totalStamps = businesses.reduce((sum, b) => sum + b.stampCount, 0);
  const perksReady = businesses.filter((b) => b.perk?.ready).length;

  return (
    <div style={{ paddingBottom: 24 }}>
      <TopBar title="Me" trailing={<IconButton label="Settings"><Icon name="settings" size={20}/></IconButton>}/>
      <div style={{ padding: "18px 16px 8px", textAlign: "center" }}>
        <div style={{ color: "var(--pine-700)", display: "grid", placeItems: "center" }}>
          <SealMark size={88} topLine="UPPER · DELAWARE" bottomLine="SEASON · 1"/>
        </div>
        <div className="gl-eyebrow" style={{ marginTop: 12 }}>Upper Delaware Passport</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, marginTop: 4 }}>
          {patron.displayName ?? "Your passport"}
        </div>
        <div style={{ color: "var(--ink-500)", fontSize: 13, marginTop: 2 }}>
          {patron.claimed
            ? "Claimed — your stamps follow your phone number."
            : "Not claimed yet — give any register your number to keep your stamps across phones."}
        </div>
      </div>

      <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card style={{ padding: 14 }}><Stat label="Stamps" value={String(totalStamps)}/></Card>
        <Card style={{ padding: 14 }}><Stat label="Towns" value={String(region.townsVisited)} suffix={`/${region.townsTotal}`}/></Card>
        <Card style={{ padding: 14 }}><Stat label="Places" value={String(businesses.length)}/></Card>
        <Card style={{ padding: 14 }}><Stat label="Perks ready" value={String(perksReady)}/></Card>
      </div>

      {/* Plain-language commitments — every line is true today (Art. I/V) */}
      <div style={{ padding: "6px 16px" }}>
        <Card variant="bordered" style={{ padding: 0 }}>
          <Row title="Privacy" sub="Owners see their own aggregates — never your history at other places"/>
          <Row title="Your stamps" sub="Stamps never expire mid-season and never lose value"/>
        </Card>
      </div>

      <div style={{ padding: "14px 18px 0", color: "var(--ink-500)", fontSize: 12, textAlign: "center", lineHeight: 1.6 }}>
        Good Local is run by river-town residents.<br/>
        We never sell ranking and never share your visit history.
      </div>
    </div>
  );
}

// ---- App shell ----------------------------------------------

function PatronApp({ initialTab = "home" }) {
  const [tab, setTab] = useState(initialTab);
  const [detail, setDetail] = useState(null);

  useEffect(() => { setDetail(null); }, [tab]);

  const goTab = (t) => { setDetail(null); setTab(t); };

  let body;
  if (detail) {
    body = <BusinessDetail bizId={detail} onBack={() => setDetail(null)} onCheckIn={() => goTab("checkin")}/>;
  } else if (tab === "home") {
    body = <PatronHome onSelectBiz={setDetail} onGoTab={goTab}/>;
  } else if (tab === "discover") {
    body = <DiscoverScreen onSelectBiz={setDetail}/>;
  } else if (tab === "checkin") {
    body = <CheckinScreen/>;
  } else if (tab === "me") {
    body = <MeScreen/>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative", overflow: "hidden", background: "var(--paper-50)" }}>
      {/* key re-fires the entrance animation on tab/detail change (design intent) */}
      <div key={detail || tab} className="gl-screen-in" style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {body}
      </div>
      <TabBar value={tab} onChange={goTab}/>
    </div>
  );
}

export default PatronApp;
