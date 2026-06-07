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
import { ME, BUSINESSES } from "../data.js";
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
            <div className="gl-eyebrow">{ME.startedSeason} · {ME.region}</div>
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

// ---- Check-in flow ------------------------------------------

function CheckinScreen({ onComplete }) {
  const [phase, setPhase] = useState("scan"); // scan → success
  const biz = BUSINESSES[0];

  const triggerScan = () => {
    setPhase("scanning");
    setTimeout(() => setPhase("success"), 700);
  };

  if (phase === "success") {
    return <CheckinSuccess biz={biz} onContinue={onComplete}/>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <TopBar title="Check in" trailing={<IconButton label="Help"><Icon name="info" size={20}/></IconButton>}/>

      <div style={{ padding: "20px 16px 0", textAlign: "center" }}>
        <div className="gl-eyebrow">Narrowsburg, NY</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, lineHeight: 1.15, margin: "6px 0 4px", letterSpacing: "-0.012em" }}>
          Hold your camera over the QR by the register.
        </div>
        <div style={{ color: "var(--ink-500)", fontSize: 14, lineHeight: 1.5 }}>
          We&apos;ll find which business this is and stamp it.
        </div>
      </div>

      {/* Camera viewport — mock */}
      <div
        onClick={triggerScan}
        style={{
          margin: "22px 22px 0", aspectRatio: "1/1", borderRadius: 16,
          background: "var(--ink-1000)", color: "var(--paper-100)",
          position: "relative", overflow: "hidden", cursor: "pointer",
        }}
      >
        {/* Crosshair */}
        <div style={{
          position: "absolute", inset: 28, border: "2px solid var(--paper-100)",
          borderRadius: 12, opacity: 0.85,
        }}>
          <Corner pos="tl"/><Corner pos="tr"/><Corner pos="bl"/><Corner pos="br"/>
          {phase === "scanning" ? (
            <div style={{
              position: "absolute", left: 0, right: 0, top: "50%",
              height: 2, background: "var(--ochre-500)",
              boxShadow: "0 0 20px var(--ochre-500)",
              animation: "gl-scan 700ms linear",
            }}/>
          ) : null}
        </div>
        {/* Tap hint */}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center",
          fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em",
          textTransform: "uppercase", opacity: 0.7,
        }}>
          Tap to scan
        </div>
        <style>{`
          @keyframes gl-scan {
            0% { transform: translateY(-90px); }
            100% { transform: translateY(90px); }
          }
        `}</style>
      </div>

      {/* Alt: phone-number path */}
      <div style={{ padding: "20px 16px 4px" }}>
        <Divider dashed/>
        <div style={{ textAlign: "center", color: "var(--ink-500)", fontSize: 13, margin: "10px 0" }}>
          Not your thing? Give the register your phone number.
        </div>
        <Field label="Phone number">
          <Input type="tel" placeholder="(845) 555-0142"/>
        </Field>
        <Button variant="secondary" block style={{ marginTop: 12 }}>Send me a one-time link</Button>
      </div>
    </div>
  );
}

function Corner({ pos }) {
  const styles = {
    tl: { top: -1, left: -1, borderTop: "3px solid var(--paper-100)", borderLeft: "3px solid var(--paper-100)" },
    tr: { top: -1, right: -1, borderTop: "3px solid var(--paper-100)", borderRight: "3px solid var(--paper-100)" },
    bl: { bottom: -1, left: -1, borderBottom: "3px solid var(--paper-100)", borderLeft: "3px solid var(--paper-100)" },
    br: { bottom: -1, right: -1, borderBottom: "3px solid var(--paper-100)", borderRight: "3px solid var(--paper-100)" },
  };
  return <span style={{ position: "absolute", width: 28, height: 28, borderRadius: 4, ...styles[pos] }}/>;
}

function CheckinSuccess({ biz, onContinue }) {
  const [showWalletSheet, setShowWalletSheet] = useState(false);
  const [addedToWallet, setAddedToWallet] = useState(false);

  if (showWalletSheet) {
    return <WalletAddSheet biz={biz} onAdd={() => { setAddedToWallet(true); setShowWalletSheet(false); }} onClose={() => setShowWalletSheet(false)}/>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", background: "var(--paper-100)" }}>
      <TopBar title="Stamped" trailing={null}/>

      <div style={{ padding: "28px 20px 0", textAlign: "center" }}>
        <div className="gl-eyebrow" style={{ color: "var(--stamp-700)" }}>Stamp #{biz.stamps + 1}</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, lineHeight: 1.1, margin: "6px 0 10px", letterSpacing: "-0.012em" }}>
          Stamped at {biz.name}.
        </div>
        <div style={{ color: "var(--ink-700)", fontSize: 15, lineHeight: 1.5 }}>
          {biz.perkTotal - biz.stamps - 1 > 0
            ? <>You&apos;re <strong>{visits(biz.perkTotal - biz.stamps - 1)}</strong> from {biz.perkLabel.toLowerCase()}.</>
            : <>Your <strong>{biz.perkLabel}</strong> is ready.</>}
        </div>
      </div>

      {/* Stamp animation */}
      <div style={{ display: "grid", placeItems: "center", padding: "28px 0 12px" }}>
        <Stamp state="earned" label={biz.code} date="06·14" size={120} just rotate={-4}/>
      </div>

      {/* Progress */}
      <div style={{ padding: "0 20px" }}>
        <Card style={{ padding: "14px 16px" }}>
          <ProgressMeter count={biz.stamps + 1} total={biz.perkTotal} label={biz.perkLabel} remainingLabel={`${visits(biz.perkTotal - biz.stamps - 1)} to go`}/>
          <div style={{ marginTop: 12 }}>
            <StampGrid
              size={42} gap={8} columns={biz.perkTotal} total={biz.perkTotal}
              stamps={Array.from({ length: biz.stamps + 1 }).map((_, i) => ({
                label: biz.code, date: "06·14", rotate: [-3,2,-2,3,-1][i] || 0,
              }))}
            />
          </div>
        </Card>
      </div>

      {/* CTAs */}
      <div style={{ padding: "20px 20px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {!addedToWallet ? (
          <Button variant="wallet" block leadingIcon={<Icon name="wallet" size={20}/>} onClick={() => setShowWalletSheet(true)}>
            Add Passport to Apple Wallet
          </Button>
        ) : (
          <Notice tone="pine" icon={<Icon name="check"/>} title="Pass added">
            Your Upper Delaware Passport is in your wallet.
          </Notice>
        )}
        <Button variant="secondary" block onClick={onContinue}>Done</Button>
      </div>

      <div style={{ flex: 1 }}/>
    </div>
  );
}

function WalletAddSheet({ biz, onAdd, onClose }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(26,22,18,0.55)", display: "flex", flexDirection: "column", justifyContent: "flex-end", zIndex: 10 }}>
      <div style={{
        background: "var(--paper-50)", borderTopLeftRadius: 22, borderTopRightRadius: 22,
        padding: "10px 16px 24px",
        animation: "gl-sheet-up 220ms var(--ease-out)",
      }}>
        <style>{`@keyframes gl-sheet-up { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
        <div style={{ width: 36, height: 4, background: "var(--ink-200)", borderRadius: 2, margin: "0 auto 14px" }}/>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div className="gl-eyebrow">Preview</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, lineHeight: 1.15, marginTop: 4, letterSpacing: "-0.012em" }}>
            Your Upper Delaware Passport
          </div>
        </div>
        <div style={{ transform: "scale(0.85)", transformOrigin: "top center", marginBottom: -50, display: "grid", placeItems: "center" }}>
          <WalletPass
            businessName={biz.name}
            region={biz.town}
            count={biz.stamps + 1} total={biz.perkTotal}
            perkLabel={biz.perkLabel}
            perkSub={biz.perkSub}
            stampCode={biz.code}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          <Button variant="wallet" block leadingIcon={<Icon name="wallet" size={20}/>} onClick={onAdd}>Add to Apple Wallet</Button>
          <Button variant="ghost" block onClick={onClose}>Not now</Button>
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

// ---- Me ------------------------------------------------------

function MeScreen() {
  return (
    <div style={{ paddingBottom: 24 }}>
      <TopBar title="Me" trailing={<IconButton label="Settings"><Icon name="settings" size={20}/></IconButton>}/>
      <div style={{ padding: "18px 16px 8px", textAlign: "center" }}>
        <div style={{ color: "var(--pine-700)", display: "grid", placeItems: "center" }}>
          <SealMark size={88}/>
        </div>
        <div className="gl-eyebrow" style={{ marginTop: 12 }}>Upper Delaware Passport</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, marginTop: 4 }}>
          Maya Reyes
        </div>
        <div style={{ color: "var(--ink-500)", fontSize: 13, marginTop: 2 }}>
          Joined June 2026 · Narrowsburg cluster
        </div>
      </div>

      <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card style={{ padding: 14 }}><Stat label="Stamps" value="10"/></Card>
        <Card style={{ padding: 14 }}><Stat label="Towns" value="4" suffix="/12"/></Card>
        <Card style={{ padding: 14 }}><Stat label="Places" value="5"/></Card>
        <Card style={{ padding: 14 }}><Stat label="Perks ready" value="1"/></Card>
      </div>

      <div style={{ padding: "8px 16px" }}>
        <Card variant="bordered" style={{ padding: 0 }}>
          <Row title="Lock-screen surfacing" sub="Suggest your pass near a participating business"
               trailing={<Switch checked={true} onChange={()=>{}} label="Toggle"/>}/>
          <Row title="Wallet pass · UDP·NRWB·a7q9" sub="Refresh from Apple Wallet"
               trailing={<Icon name="chevron-right" size={18}/>}/>
          <Row title="Privacy" sub="Owners see aggregate, not your history"
               trailing={<Icon name="chevron-right" size={18}/>}/>
          <Row title="Help & contact"
               trailing={<Icon name="chevron-right" size={18}/>}/>
        </Card>
      </div>
    </div>
  );
}

// ---- App shell ----------------------------------------------

function PatronApp({ initialTab = "home" }) {
  const [tab, setTab] = useState(initialTab);
  const [detail, setDetail] = useState(null);
  const [postCheckinTo, setPostCheckinTo] = useState("home");

  useEffect(() => { setDetail(null); }, [tab]);

  let body;
  if (detail) {
    body = <BusinessDetail bizId={detail} onBack={() => setDetail(null)}/>;
  } else if (tab === "home") {
    body = <PatronHome onSelectBiz={setDetail}/>;
  } else if (tab === "discover") {
    body = <DiscoverScreen onSelectBiz={setDetail}/>;
  } else if (tab === "checkin") {
    body = <CheckinScreen onComplete={() => setTab(postCheckinTo)}/>;
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
