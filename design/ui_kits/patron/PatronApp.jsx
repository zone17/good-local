// ============================================================
// Good Local — Patron mobile-web UI kit
// ============================================================
//
// One phone-sized container with a small in-kit nav that lets
// you jump between the five core patron screens. The check-in
// → wallet flow is the most interactive (tap the QR card to
// run the stamp animation; the wallet sheet then animates in).
//
// Uses the design-system bundle via window.GoodLocalDesignSystem_db344c.

const { useState, useEffect } = React;
const {
  Button, IconButton, Card, Badge, Tag, Icon,
  Field, Input, Switch, Tabs, Stat, Notice, Row, Divider,
  Stamp, StampGrid, WalletPass, ProgressMeter, SealMark
} = window.GoodLocalDesignSystem_db344c;

// ---- Fake data ---------------------------------------------

const ME = {
  firstName: "Maya",
  region: "Upper Delaware",
  startedSeason: "Season 1",
};

const BUSINESSES = [
  {
    id: "heron",
    name: "The Heron",
    town: "Narrowsburg, NY",
    kind: "Restaurant · river-view",
    distance: "0.4 mi",
    stamps: 3, perkTotal: 5,
    perkLabel: "The Regular's Pour",
    perkSub: "Two more visits, on the house",
    regulars: 38,
    eyebrow: "Founding pick",
    eyebrowTone: "stamp",
    code: "HRN",
    open: true,
  },
  {
    id: "boomer",
    name: "Boomer's Diner",
    town: "Barryville, NY",
    kind: "Diner · breakfast all day",
    distance: "0.8 mi",
    stamps: 2, perkTotal: 5,
    perkLabel: "Bottomless drip",
    perkSub: "Show this on your sixth visit",
    regulars: 24,
    code: "BMR",
    open: true,
  },
  {
    id: "outfitter",
    name: "Catskill Outfitters",
    town: "Eldred, NY",
    kind: "Paddle rental + gear",
    distance: "1.2 mi",
    stamps: 1, perkTotal: 4,
    perkLabel: "$10 off your next paddle",
    perkSub: "Three more visits",
    regulars: 19,
    eyebrow: "New this week",
    eyebrowTone: "ochre",
    code: "CAT",
    open: false,
  },
  {
    id: "loomroom",
    name: "Loom Room Bookshop",
    town: "Narrowsburg, NY",
    kind: "Indie books · weekly readings",
    distance: "0.5 mi",
    stamps: 4, perkTotal: 5,
    perkLabel: "The regular's shelf",
    perkSub: "One more visit",
    regulars: 41,
    eyebrow: "Verified regular pick",
    eyebrowTone: "pine",
    code: "LRM",
    open: true,
  },
  {
    id: "kingsten",
    name: "Kingsten Gallery",
    town: "Callicoon, NY",
    kind: "Local artists · open Fri–Sun",
    distance: "5.7 mi",
    stamps: 0, perkTotal: 5,
    perkLabel: "Member's preview night",
    perkSub: "Five visits gets you in early",
    regulars: 12,
    code: "KGS",
    open: false,
  },
];

const MY_STAMPS = [
  { code: "HRN", date: "06·07", rotate: -3 },
  { code: "HRN", date: "06·12", rotate: 2 },
  { code: "HRN", date: "06·14", rotate: -2 },
  { code: "BMR", date: "06·09", rotate: 3 },
  { code: "BMR", date: "06·13", rotate: -1 },
  { code: "LRM", date: "06·05", rotate: -4 },
  { code: "LRM", date: "06·08", rotate: 1 },
  { code: "LRM", date: "06·11", rotate: -2 },
  { code: "LRM", date: "06·14", rotate: 3 },
  { code: "CAT", date: "06·10", rotate: -1 },
];

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

function PatronHome({ onSelectBiz, onGoTo, justStampedId }) {
  const hero = BUSINESSES.find(b => b.id === "heron");
  const grouped = {};
  MY_STAMPS.forEach((s) => {
    grouped[s.code] = grouped[s.code] || [];
    grouped[s.code].push(s);
  });

  return (
    <div style={{ paddingBottom: 24 }}>
      <TopBar title="Passport"
        trailing={<IconButton label="Settings"><Icon name="settings" size={20}/></IconButton>}
      />

      {/* Hero — current featured pass */}
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
              Welcome back, {ME.firstName}.
            </div>
          </div>
        </div>

        <div style={{ transform: "scale(0.92)", transformOrigin: "top center", marginBottom: -22 }}>
          <WalletPass
            businessName={hero.name}
            region={hero.town}
            count={hero.stamps} total={hero.perkTotal}
            perkLabel={hero.perkLabel}
            perkSub={hero.perkSub}
            stampCode={hero.code}
            serial="UDP·NRWB·a7q9"
            expires="11·2026"
            style={{ margin: "0 auto" }}
          />
        </div>
      </div>

      {/* Perk progress */}
      <div style={{ padding: "8px 16px 14px" }}>
        <Card style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontWeight: 600 }}>{hero.perkLabel}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-500)" }}>
              {hero.stamps}/{hero.perkTotal}
            </span>
          </div>
          <ProgressMeter count={hero.stamps} total={hero.perkTotal} remainingLabel={`${hero.perkTotal - hero.stamps} visits to go`}/>
          <div style={{ fontSize: 13, color: "var(--ink-700)", marginTop: 10 }}>
            Mira left a note on yours — <em>"Save your fifth for a slow afternoon."</em>
          </div>
        </Card>
      </div>

      {/* My stamps */}
      <div style={{ padding: "8px 16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Your stamps</h3>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-500)" }}>
            {MY_STAMPS.length} · season 1
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {Object.entries(grouped).map(([code, stamps]) => {
            const biz = BUSINESSES.find(b => b.code === code);
            return (
              <div key={code} onClick={() => onSelectBiz(biz.id)} style={{ cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{biz.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-500)" }}>{biz.town} · {stamps.length} visits</div>
                  </div>
                  {stamps.length >= biz.perkTotal ? <Badge variant="solid-pine">Perk ready</Badge> : null}
                </div>
                <StampGrid
                  size={48}
                  gap={8}
                  columns={biz.perkTotal}
                  total={biz.perkTotal}
                  stamps={stamps.map(s => ({
                    label: s.code, date: s.date, rotate: s.rotate,
                    state: justStampedId === biz.id && s === stamps[stamps.length-1] ? "earned" : "earned",
                  }))}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Region progress */}
      <div style={{ padding: "0 16px 8px" }}>
        <Card variant="kraft" style={{ padding: "16px" }}>
          <div className="gl-eyebrow" style={{ color: "var(--pine-700)" }}>This season</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, lineHeight: 1.15, margin: "4px 0 12px", letterSpacing: "-0.01em" }}>
            4 of 12 Upper Delaware towns
          </div>
          <ProgressMeter count={4} total={12} tone="ochre" remainingLabel="8 towns to go"/>
          <div style={{ fontSize: 13, color: "var(--ink-700)", marginTop: 10 }}>
            Visit a business in any new town to add it to your passport.
          </div>
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
            ? <>You&apos;re <strong>{biz.perkTotal - biz.stamps - 1} visits</strong> from {biz.perkLabel.toLowerCase()}.</>
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
          <ProgressMeter count={biz.stamps + 1} total={biz.perkTotal} label={biz.perkLabel} remainingLabel={`${biz.perkTotal - biz.stamps - 1} visits to go`}/>
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
  const [view, setView] = useState("Nearby");
  return (
    <div style={{ paddingBottom: 24 }}>
      <TopBar title="Discover" trailing={<IconButton label="Search"><Icon name="search" size={20}/></IconButton>}/>

      <div style={{ padding: "12px 16px 0", display: "flex", justifyContent: "center" }}>
        <Tabs tabs={["Nearby", "Founding picks", "Saved"]} value={view} onChange={setView}/>
      </div>

      <div style={{ padding: "16px 16px 8px" }}>
        <div className="gl-eyebrow">Ranked by verified return visits this season</div>
        <div style={{ color: "var(--ink-500)", fontSize: 13, marginTop: 6 }}>
          No paid placement, ever. <a href="#" style={{ color: "var(--text-link)" }}>How this ranks →</a>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 16px" }}>
        {BUSINESSES.map((biz) => (
          <BusinessCard key={biz.id} biz={biz} onClick={() => onSelectBiz(biz.id)}/>
        ))}
      </div>
    </div>
  );
}

function BusinessCard({ biz, onClick }) {
  return (
    <Card onClick={onClick} style={{ padding: 16, cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          {biz.eyebrow ? (
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.14em", color:
                biz.eyebrowTone === "stamp" ? "var(--stamp-700)" :
                biz.eyebrowTone === "ochre" ? "var(--ochre-700)" :
                "var(--pine-700)",
              marginBottom: 4,
            }}>
              {biz.eyebrow}
            </div>
          ) : null}
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
            {biz.name}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 2 }}>
            {biz.town} · {biz.kind}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <Badge variant={biz.open ? "pine" : undefined}>
            {biz.open ? "Open now" : "Closed today"}
          </Badge>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-500)" }}>
            {biz.distance}
          </span>
        </div>
      </div>

      <div style={{
        marginTop: 12, padding: "10px 12px",
        background: "var(--paper-100)", borderRadius: 10,
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="users" size={18} style={{ color: "var(--pine-700)" }}/>
          <span style={{ fontSize: 13, color: "var(--ink-1000)" }}>
            <strong>{biz.regulars}</strong> verified regulars
          </span>
        </div>
        {biz.stamps > 0 ? (
          <span style={{ fontSize: 12, color: "var(--ink-700)" }}>
            You&apos;re <strong>{biz.perkTotal - biz.stamps}</strong> visits from {biz.perkLabel.toLowerCase()}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "var(--ink-500)" }}>You haven&apos;t been yet</span>
        )}
      </div>
    </Card>
  );
}

// ---- Business detail ----------------------------------------

function BusinessDetail({ bizId, onBack }) {
  const biz = BUSINESSES.find((b) => b.id === bizId);
  if (!biz) return null;
  const mine = MY_STAMPS.filter(s => s.code === biz.code);

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
        <Stat label="Verified regulars" value={biz.regulars}/>
        <Stat label="Your visits" value={mine.length}/>
      </div>

      <div style={{ padding: "8px 16px" }}>
        <Card style={{ padding: "14px 16px" }}>
          <div className="gl-eyebrow" style={{ color: "var(--stamp-700)" }}>Your perk</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, lineHeight: 1.15, marginTop: 4, letterSpacing: "-0.01em" }}>
            {biz.perkLabel}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-700)", marginTop: 4, marginBottom: 12 }}>
            {biz.perkSub}
          </div>
          <ProgressMeter count={biz.stamps} total={biz.perkTotal} remainingLabel={`${biz.perkTotal - biz.stamps} visits to go`}/>
          <div style={{ marginTop: 12 }}>
            <StampGrid
              size={44} gap={8} columns={biz.perkTotal} total={biz.perkTotal}
              stamps={mine.slice(0, biz.stamps).map((s) => ({ label: biz.code, date: s.date, rotate: s.rotate }))}
            />
          </div>
        </Card>
      </div>

      <div style={{ padding: "12px 16px" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>Owner&apos;s note</h3>
        <Card variant="kraft" style={{ padding: "14px 16px", borderLeft: "3px solid var(--stamp-700)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 16, lineHeight: 1.4, color: "var(--ink-1000)" }}>
            "Save your fifth for a slow afternoon. We&apos;ll set up by the window."
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-500)", marginTop: 8, letterSpacing: "0.04em" }}>
            — Mira, owner since 2019
          </div>
        </Card>
      </div>

      <div style={{ padding: "12px 16px 0", display: "flex", gap: 8 }}>
        <Button variant="secondary" leadingIcon={<Icon name="map-pin" size={18}/>}>Directions</Button>
        <Button variant="ghost" leadingIcon={<Icon name="calendar" size={18}/>}>Hours</Button>
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
    body = <PatronHome onSelectBiz={setDetail} onGoTo={setTab}/>;
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

window.PatronApp = PatronApp;
