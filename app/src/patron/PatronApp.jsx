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
            <Icon name={it.icon} size={22}/>
            <span>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---- Patron Home --------------------------------------------

function PatronHome({ onSelectBiz }) {
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

      {/* Hero — top-progress pass */}
      <div style={{ padding: "18px 16px 8px" }}>
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          gap: 12, marginBottom: 14,
        }}>
          <div>
            {/* v1 single region — names become API data when region #2 exists (Art. XVI) */}
            <div className="gl-eyebrow">Season 1 · Upper Delaware</div>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600,
              lineHeight: 1.1, marginTop: 4, letterSpacing: "-0.012em",
              fontVariationSettings: '"opsz" 32',
            }}>
              {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
            </div>
          </div>
        </div>

        {hero ? (
          <div style={{ transform: "scale(0.92)", transformOrigin: "top center", marginBottom: -22 }}>
            <WalletPass
              businessName={hero.name}
              region={hero.town}
              count={heroPerk ? heroPerk.current : hero.stampCount}
              total={heroPerk ? heroPerk.threshold : hero.stampCount}
              perkLabel={heroPerk ? heroPerk.name : "Your pass"}
              perkSub={heroPerk && heroPerk.ready ? PERK_READY_COPY : (heroPerk ? `${visits(heroRemaining)} to go` : "")}
              stampCode={hero.slug}
              expires="11·2026"
              style={{ margin: "0 auto" }}
            />
          </div>
        ) : (
          <Card style={{ padding: "16px" }}>
            <div style={{ fontSize: 14, color: "var(--ink-700)", lineHeight: 1.5 }}>
              Your passport is ready. Scan the QR at any participating register to earn your first stamp.
            </div>
          </Card>
        )}
      </div>

      {/* Hero perk progress (T039 — ready treatment) */}
      {heroPerk ? (
        <div style={{ padding: "8px 16px 14px" }}>
          <Card style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ fontWeight: 600 }}>{heroPerk.name}</span>
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
            {businesses.map((biz) => {
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

      {/* Region progress — "N of 12 towns" + milestones */}
      <div style={{ padding: "0 16px 8px" }}>
        <Card variant="kraft" style={{ padding: "16px" }}>
          <div className="gl-eyebrow" style={{ color: "var(--pine-700)" }}>This season</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, lineHeight: 1.15, margin: "4px 0 12px", letterSpacing: "-0.01em" }}>
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

      <div style={{ padding: "16px 20px 0" }}>
        <Divider dashed/>
        <div style={{ textAlign: "center", color: "var(--ink-500)", fontSize: 13, marginTop: 12, lineHeight: 1.6 }}>
          Not your thing? Give the counter your phone number and they&apos;ll
          stamp you in — your passport arrives by text.
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

function BusinessDetail({ bizId, onBack }) {
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
        height: 140, background: "var(--river-700)", position: "relative", overflow: "hidden",
      }}>
        <svg viewBox="0 0 400 140" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.25 }}>
          <path d="M -10 80 Q 60 50 130 80 T 270 80 T 410 80" stroke="var(--paper-100)" fill="none" strokeWidth="2"/>
          <path d="M -10 100 Q 60 70 130 100 T 270 100 T 410 100" stroke="var(--paper-100)" fill="none" strokeWidth="1.5"/>
          <path d="M -10 120 Q 60 90 130 120 T 270 120 T 410 120" stroke="var(--paper-100)" fill="none" strokeWidth="1"/>
        </svg>
        <div style={{ position: "absolute", left: 20, bottom: 14, color: "var(--paper-100)" }}>
          <div className="gl-eyebrow" style={{ color: "var(--paper-100)", opacity: 0.85 }}>{biz.town}</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, lineHeight: 1.05, marginTop: 4, letterSpacing: "-0.012em" }}>
            {biz.name}
          </div>
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
                  label: biz.slug, rotate: [-3, 2, -2, 3, -1][i % 5],
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
        <Button
          variant="secondary"
          leadingIcon={<Icon name="map-pin" size={18}/>}
          onClick={() => { if (biz.directionsUrl) window.open(biz.directionsUrl, "_blank", "noopener"); }}
        >
          Directions
        </Button>
        {biz.hours ? (
          <Button variant="ghost" leadingIcon={<Icon name="calendar" size={18}/>}>{biz.hours}</Button>
        ) : null}
      </div>
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
          <SealMark size={88}/>
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
    </div>
  );
}

// ---- App shell ----------------------------------------------

function PatronApp({ initialTab = "home" }) {
  const [tab, setTab] = useState(initialTab);
  const [detail, setDetail] = useState(null);

  useEffect(() => { setDetail(null); }, [tab]);

  let body;
  if (detail) {
    body = <BusinessDetail bizId={detail} onBack={() => setDetail(null)}/>;
  } else if (tab === "home") {
    body = <PatronHome onSelectBiz={setDetail}/>;
  } else if (tab === "discover") {
    body = <DiscoverScreen onSelectBiz={setDetail}/>;
  } else if (tab === "checkin") {
    body = <CheckinScreen/>;
  } else if (tab === "me") {
    body = <MeScreen/>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative", overflow: "hidden", background: "var(--paper-50)" }}>
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {body}
      </div>
      <TabBar value={tab} onChange={(t) => { setDetail(null); setTab(t); }}/>
    </div>
  );
}

export default PatronApp;
