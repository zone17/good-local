// ============================================================
// Wallet pass variations — sophisticated but fun
// ============================================================
//
// Each pass renders at 340×420 (PassKit 1x). The baseline lives
// in components/passport/WalletPass.jsx; these are alt directions
// inspired by the 59 NP poster book.

// ---- Shared shell -------------------------------------------

function PassShell({ children, bg, ink, style }) {
  return (
    <div style={{
      position: "relative", width: 340, height: 420,
      background: bg, color: ink, borderRadius: 14,
      boxShadow: "var(--shadow-pass)", padding: 22,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      overflow: "hidden", fontFamily: "var(--font-body)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function PassTopBar({ region, business, ink, scale = 1 }) {
  return (
    <div style={{
      position: "relative", zIndex: 2,
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    }}>
      <div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.16em",
          textTransform: "uppercase", opacity: 0.78, color: ink,
        }}>
          Good Local · {region}
        </div>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 30 * scale, fontWeight: 600,
          letterSpacing: "-0.012em", lineHeight: 1.05, marginTop: 6, color: ink,
          fontVariationSettings: '"opsz" 36',
        }}>
          {business}
        </div>
      </div>
      <MiniSeal ink={ink}/>
    </div>
  );
}

function MiniSeal({ ink, size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" style={{ color: ink, opacity: 0.95 }}>
      <circle cx="60" cy="60" r="56" stroke="currentColor" strokeWidth="3" fill="none"/>
      <circle cx="60" cy="60" r="48" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <g transform="translate(60 62)">
        <path d="M -22 8 L -11 -10 L -3 0 L 5 -14 L 16 6 L 22 8 Z" fill="currentColor"/>
        <path d="M -24 14 Q -13 10 -3 14 T 24 14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
      </g>
    </svg>
  );
}

function PassPerk({ label, sub, ink }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, position: "relative", zIndex: 2 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
        textTransform: "uppercase", opacity: 0.78, color: ink,
      }}>Next perk</div>
      <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, color: ink }}>{label}</div>
      {sub ? <div style={{ fontSize: 12, opacity: 0.78, color: ink }}>{sub}</div> : null}
    </div>
  );
}

function PassCount({ count, total, ink }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", position: "relative", zIndex: 2 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
        textTransform: "uppercase", opacity: 0.78, color: ink,
      }}>Stamps</div>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 56, fontWeight: 600,
        lineHeight: 1, letterSpacing: "-0.02em", color: ink,
        fontVariationSettings: '"opsz" 72',
      }}>
        {count}
        {total ? <span style={{ opacity: 0.55, fontSize: 36 }}> / {total}</span> : null}
      </div>
    </div>
  );
}

function PassFooter({ serial, footer, expires, ink, dividerColor }) {
  return (
    <div style={{
      position: "relative", zIndex: 2,
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      gap: 12, borderTop: `1px dashed ${dividerColor || "rgba(255,255,255,0.22)"}`, paddingTop: 12,
    }}>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em",
        opacity: 0.78, color: ink,
      }}>{serial || "UDP·NRWB·a7q9"}</div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        {footer ? <span style={{ fontSize: 11, opacity: 0.85, color: ink }}>{footer}</span> : null}
        {expires ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.7, color: ink }}>exp {expires}</span> : null}
      </div>
    </div>
  );
}

// ============================================================
// A · RIVER-LED (slate-blue primary)
// ============================================================
//   Same architecture as the pine baseline, but river-700 takes
//   over. Ochre sun replaces the river curve as the watermark.
//   Calm, water-forward, lets paper warmth (ochre) play accent.

function PassRiverLed({ businessName = "The Heron", region = "Narrowsburg, NY", count = 3, total = 5, perkLabel = "The Regular's Pour", perkSub = "Two more visits, on the house", serial, expires = "11·2026" }) {
  const bg = "var(--river-700)";
  const ink = "var(--paper-100)";
  return (
    <PassShell bg={bg} ink={ink}>
      {/* Ochre sun watermark, top-right */}
      <svg style={{ position: "absolute", right: -60, top: -60, opacity: 0.18, pointerEvents: "none" }} width="220" height="220" viewBox="0 0 220 220">
        <circle cx="110" cy="110" r="100" fill="var(--ochre-500)"/>
      </svg>
      {/* Subtle river lines bottom */}
      <svg viewBox="0 0 340 120" style={{ position: "absolute", left: 0, right: 0, bottom: 56, width: "100%", opacity: 0.18, pointerEvents: "none" }}>
        <path d="M -10 30 Q 60 0 130 30 T 270 30 T 410 30" stroke={ink} fill="none" strokeWidth="1.5"/>
        <path d="M -10 60 Q 60 30 130 60 T 270 60 T 410 60" stroke={ink} fill="none" strokeWidth="1.5"/>
        <path d="M -10 90 Q 60 60 130 90 T 270 90 T 410 90" stroke={ink} fill="none" strokeWidth="1.5"/>
      </svg>
      <PassTopBar region={region} business={businessName} ink={ink}/>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <PassPerk label={perkLabel} sub={perkSub} ink={ink}/>
        <PassCount count={count} total={total} ink={ink}/>
      </div>
      <PassFooter serial={serial} footer="Lock-screen on" expires={expires} ink={ink}/>
    </PassShell>
  );
}

// ============================================================
// B · SUNRISE POSTER — the "59 NP book" pass
// ============================================================
//   Full landscape illustration spans the lower half of the
//   pass. Top half is solid pine for text contrast. The pass
//   feels like a folded park poster you carry in your pocket.

function PassSunrisePoster({ businessName = "The Heron", region = "Narrowsburg, NY", count = 3, total = 5, perkLabel = "The Regular's Pour", perkSub = "Two more visits, on the house", serial, expires = "11·2026" }) {
  const ink = "var(--paper-100)";
  return (
    <PassShell bg="var(--pine-900)" ink={ink}>
      {/* Landscape — fills the whole card; top half is overlaid by a
          pine wash for legibility. */}
      <svg viewBox="0 0 340 420" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {/* Sky band */}
        <rect width="340" height="240" fill="var(--pine-700)"/>
        {/* Sun */}
        <circle cx="170" cy="210" r="80" fill="var(--ochre-500)"/>
        {/* Back ridge */}
        <path d="M 0 260 L 60 220 L 110 250 L 160 215 L 220 250 L 280 225 L 340 245 L 340 320 L 0 320 Z" fill="var(--pine-1000)" opacity="0.85"/>
        {/* Front ridge */}
        <path d="M 0 310 L 50 270 L 110 305 L 170 275 L 230 310 L 290 275 L 340 305 L 340 360 L 0 360 Z" fill="var(--pine-1000)"/>
        {/* Water */}
        <rect y="360" width="340" height="80" fill="var(--river-700)"/>
        {/* Ripples */}
        <path d="M 0 380 Q 60 372 120 380 T 240 380 T 380 380" stroke={ink} strokeWidth="1.5" fill="none" opacity="0.45"/>
        <path d="M 0 400 Q 60 392 120 400 T 240 400 T 380 400" stroke={ink} strokeWidth="1.2" fill="none" opacity="0.3"/>
        {/* Top wash for legibility */}
        <rect width="340" height="170" fill="url(#sunrise-wash)"/>
        <defs>
          <linearGradient id="sunrise-wash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--pine-1000)" stopOpacity="0.85"/>
            <stop offset="1" stopColor="var(--pine-1000)" stopOpacity="0"/>
          </linearGradient>
        </defs>
      </svg>
      <PassTopBar region={region} business={businessName} ink={ink}/>
      <div style={{ flex: 1 }}/>
      <div style={{
        position: "relative", zIndex: 2,
        background: "color-mix(in srgb, var(--pine-1000) 78%, transparent)",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        margin: "0 -22px", padding: "16px 22px 14px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <PassPerk label={perkLabel} sub={perkSub} ink={ink}/>
          <PassCount count={count} total={total} ink={ink}/>
        </div>
      </div>
      <PassFooter serial={serial} footer="Lock-screen on" expires={expires} ink={ink} dividerColor="rgba(246,241,228,0.3)"/>
    </PassShell>
  );
}

// ============================================================
// C · KRAFT PASSPORT — paper book, actual stamp impression
// ============================================================
//   Kraft cream surface, pine ink. A real stamped impression
//   (rectangular, slightly off-axis) lives in the corner like
//   you'd find it in your park-passport book. The most literal
//   "passport" of the three.

function PassKraftPassport({ businessName = "The Heron", region = "Narrowsburg, NY", count = 3, total = 5, perkLabel = "The Regular's Pour", perkSub = "Two more visits, on the house", serial, expires = "11·2026" }) {
  const ink = "var(--pine-1000)";
  return (
    <PassShell bg="var(--paper-300)" ink={ink} style={{ border: "1px solid rgba(35,77,58,0.18)" }}>
      {/* Paper grain — repeating tiny dots */}
      <svg style={{ position: "absolute", inset: 0, opacity: 0.08, pointerEvents: "none" }} width="100%" height="100%">
        <defs>
          <pattern id="grain" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="0.6" fill="var(--ink-1000)"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grain)"/>
      </svg>
      {/* Edge perforations — like a real ticket / passport page */}
      <svg style={{ position: "absolute", top: 6, left: 0, right: 0, opacity: 0.32, pointerEvents: "none" }} width="100%" height="10">
        {Array.from({ length: 24 }).map((_,i) => (
          <circle key={i} cx={`${(i+0.5) * (100/24)}%`} cy="5" r="2" fill="var(--ink-1000)"/>
        ))}
      </svg>

      {/* Top */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.7, color: ink }}>
            Good Local · {region}
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600,
            letterSpacing: "-0.012em", lineHeight: 1.05, marginTop: 6, color: ink,
            fontVariationSettings: '"opsz" 36',
          }}>
            {businessName}
          </div>
        </div>
        <MiniSeal ink={ink}/>
      </div>

      {/* Stamp impression — real visible stamp in the upper-right area */}
      <div style={{ position: "absolute", top: 130, right: -10, transform: "rotate(-8deg)", zIndex: 2, opacity: 0.95 }}>
        <svg width="140" height="100" viewBox="0 0 200 140" style={{ overflow: "visible" }}>
          <rect x="6" y="6" width="188" height="128" rx="4" fill="none" stroke="var(--stamp-700)" strokeWidth="3.5"/>
          <rect x="14" y="14" width="172" height="112" rx="2" fill="none" stroke="var(--stamp-700)" strokeWidth="1.2"/>
          <text x="100" y="50" textAnchor="middle" fill="var(--stamp-700)"
            style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 22 }}>Narrowsburg</text>
          <text x="100" y="78" textAnchor="middle" fill="var(--stamp-700)"
            style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 11, letterSpacing: "0.28em" }}>VERIFIED · REGULAR</text>
          <text x="100" y="108" textAnchor="middle" fill="var(--stamp-700)"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 11, letterSpacing: "0.08em" }}>06·14·2026 · NY</text>
        </svg>
      </div>

      <div style={{ flex: 1 }}/>

      {/* Bottom — perk + count, with handwritten serif feel */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.65, color: ink }}>
            Next perk
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 19, fontWeight: 500, lineHeight: 1.2, color: ink }}>
            {perkLabel}
          </div>
          {perkSub ? <div style={{ fontSize: 12, opacity: 0.72, color: ink }}>{perkSub}</div> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.65, color: ink }}>Stamps</div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 56, fontWeight: 600,
            lineHeight: 1, letterSpacing: "-0.02em", color: ink,
          }}>
            {count}
            {total ? <span style={{ opacity: 0.45, fontSize: 36 }}> / {total}</span> : null}
          </div>
        </div>
      </div>

      <PassFooter serial={serial} footer="Stamped at the register" expires={expires} ink={ink} dividerColor="rgba(35,77,58,0.28)"/>
    </PassShell>
  );
}

// ============================================================
// D · COLOR-BLOCK — Saul-Bass sophisticated
// ============================================================
//   Diagonal color split (pine top-right, ochre bottom-left).
//   Big numeral takes the corner. Most "designed" of the four
//   — feels like a 50s/60s travel poster.

function PassColorBlock({ businessName = "The Heron", region = "Narrowsburg, NY", count = 3, total = 5, perkLabel = "The Regular's Pour", perkSub = "Two more visits, on the house", serial, expires = "11·2026" }) {
  const ink = "var(--paper-100)";
  const id = "wedge-" + Math.random().toString(36).slice(2, 8);
  return (
    <PassShell bg="var(--pine-700)" ink={ink}>
      {/* Diagonal ochre wedge */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 340 420" preserveAspectRatio="none">
        <defs>
          <clipPath id={`wedge-${id}`}>
            <polygon points="0,420 0,200 340,420"/>
          </clipPath>
        </defs>
        <g clipPath={`url(#wedge-${id})`}>
          <rect width="340" height="420" fill="var(--ochre-500)"/>
          {/* Tiny mountain motif inside the ochre wedge */}
          <path d="M -10 380 L 60 320 L 120 360 L 190 310 L 260 360 L 340 320 L 340 420 L -10 420 Z" fill="var(--stamp-700)" opacity="0.85"/>
        </g>
        {/* Hairline between the blocks */}
        <polyline points="0,200 340,420" stroke="var(--paper-100)" strokeWidth="1.5" fill="none" opacity="0.7"/>
      </svg>
      <PassTopBar region={region} business={businessName} ink={ink}/>
      <div style={{ flex: 1 }}/>
      {/* Big numeral mid-bottom; perk top-right of the pass */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 130, fontWeight: 600,
          lineHeight: 0.85, letterSpacing: "-0.03em", color: "var(--paper-100)",
        }}>
          {count}
          <span style={{ fontSize: 42, opacity: 0.7, marginLeft: 2 }}>/{total}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", textAlign: "right", maxWidth: 150 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.85, color: ink }}>Next perk</div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25, marginTop: 4, color: ink }}>{perkLabel}</div>
          {perkSub ? <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2, color: ink }}>{perkSub}</div> : null}
        </div>
      </div>
      <PassFooter serial={serial} footer="Lock-screen on" expires={expires} ink={ink} dividerColor="rgba(246,241,228,0.4)"/>
    </PassShell>
  );
}

// ============================================================
// C-PINE · KRAFT PASSPORT (PINE NIGHT) — forest leather edition
// ============================================================
//   Same architecture as the oxblood night version, but the
//   leather is deep pine instead of red-brown. Reads as the
//   forest-tier seasonal passport cover. Gold-foil accents stay.

function PassKraftPassportPineNight({ businessName = "The Heron", region = "Narrowsburg, NY", count = 3, total = 5, perkLabel = "The Regular's Pour", perkSub = "Two more visits, on the house", serial, expires = "11·2026" }) {
  const bg = "var(--pine-1000)";
  const ink = "var(--paper-100)";
  const gold = "var(--ochre-300)";
  const stamp = "var(--paper-100)";
  return (
    <PassShell bg={bg} ink={ink} style={{ border: "1px solid rgba(246,241,228,0.10)" }}>
      {/* Leather grain */}
      <svg style={{ position: "absolute", inset: 0, opacity: 0.06, pointerEvents: "none" }} width="100%" height="100%">
        <defs>
          <pattern id="leather-grain-pn" x="0" y="0" width="3" height="9" patternUnits="userSpaceOnUse">
            <rect width="3" height="9" fill="none"/>
            <circle cx="1.5" cy="2" r="0.6" fill="var(--paper-100)"/>
            <circle cx="1.5" cy="6" r="0.4" fill="var(--paper-100)" opacity="0.6"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#leather-grain-pn)"/>
      </svg>
      {/* Embossed gold-dot perforations */}
      <svg style={{ position: "absolute", top: 6, left: 0, right: 0, opacity: 0.55, pointerEvents: "none" }} width="100%" height="10">
        {Array.from({ length: 24 }).map((_,i) => (
          <circle key={i} cx={`${(i+0.5) * (100/24)}%`} cy="5" r="2" fill={gold}/>
        ))}
      </svg>

      <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: gold, opacity: 0.9 }}>
            Good Local · {region}
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600,
            letterSpacing: "-0.012em", lineHeight: 1.05, marginTop: 6, color: ink,
            fontVariationSettings: '"opsz" 36',
          }}>
            {businessName}
          </div>
        </div>
        <MiniSeal ink={gold}/>
      </div>

      {/* Stamp impression — round, debossed cream-on-pine */}
      <div style={{ position: "absolute", top: 130, right: 10, transform: "rotate(-6deg)", zIndex: 2, opacity: 0.95 }}>
        <svg width="120" height="120" viewBox="0 0 160 160" style={{ overflow: "visible" }}>
          <circle cx="80" cy="80" r="68" fill="none" stroke={stamp} strokeWidth="3" opacity="0.9"/>
          <circle cx="80" cy="80" r="58" fill="none" stroke={stamp} strokeWidth="1" opacity="0.6"/>
          <defs>
            <path id="kr-arc-t" d="M 22 80 A 58 58 0 0 1 138 80" fill="none"/>
            <path id="kr-arc-b" d="M 24 84 A 56 56 0 0 0 136 84" fill="none"/>
          </defs>
          <text fill={stamp} style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 10, letterSpacing: "0.26em" }}>
            <textPath href="#kr-arc-t" startOffset="50%" textAnchor="middle">NARROWSBURG · NY</textPath>
          </text>
          <text fill={stamp} style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 9, letterSpacing: "0.18em" }}>
            <textPath href="#kr-arc-b" startOffset="50%" textAnchor="middle">06 · 14 · 2026</textPath>
          </text>
          <text x="80" y="92" textAnchor="middle" fill={stamp}
            style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 36 }}>HRN</text>
        </svg>
      </div>

      <div style={{ flex: 1 }}/>

      <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: gold, opacity: 0.85 }}>
            Next perk
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 19, fontWeight: 500, lineHeight: 1.2, color: ink }}>
            {perkLabel}
          </div>
          {perkSub ? <div style={{ fontSize: 12, opacity: 0.78, color: ink }}>{perkSub}</div> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: gold, opacity: 0.85 }}>Stamps</div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 56, fontWeight: 600,
            lineHeight: 1, letterSpacing: "-0.02em", color: ink,
          }}>
            {count}
            {total ? <span style={{ opacity: 0.55, fontSize: 36 }}> / {total}</span> : null}
          </div>
        </div>
      </div>

      <PassFooter serial={serial} footer="Stamped at the register" expires={expires} ink={ink} dividerColor="rgba(246,241,228,0.2)"/>
    </PassShell>
  );
}

Object.assign(window, { PassKraftPassportPineNight });

// ============================================================
// C-DARK · KRAFT PASSPORT (NIGHT) — leather cover edition
// ============================================================
//   Same architecture as the Kraft Passport but on a deep
//   oxblood leather. Cream type, gold-foil accent, cream stamp
//   impression instead of red — feels like the OUTSIDE of a
//   passport book rather than the page inside.

function PassKraftPassportDark({ businessName = "The Heron", region = "Narrowsburg, NY", count = 3, total = 5, perkLabel = "The Regular's Pour", perkSub = "Two more visits, on the house", serial, expires = "11·2026" }) {
  // Custom oxblood-leather hex — sits between stamp-900 and ink-1000.
  const bg = "#3A1810";
  const ink = "var(--paper-100)";
  const gold = "var(--ochre-300)";
  const stamp = "var(--paper-100)";
  return (
    <PassShell bg={bg} ink={ink} style={{ border: "1px solid rgba(246,241,228,0.10)" }}>
      {/* Leather grain — finer than kraft, more directional */}
      <svg style={{ position: "absolute", inset: 0, opacity: 0.06, pointerEvents: "none" }} width="100%" height="100%">
        <defs>
          <pattern id="leather-grain" x="0" y="0" width="3" height="9" patternUnits="userSpaceOnUse">
            <rect width="3" height="9" fill="none"/>
            <circle cx="1.5" cy="2" r="0.6" fill="var(--paper-100)"/>
            <circle cx="1.5" cy="6" r="0.4" fill="var(--paper-100)" opacity="0.6"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#leather-grain)"/>
      </svg>
      {/* Edge perforations — embossed gold dots */}
      <svg style={{ position: "absolute", top: 6, left: 0, right: 0, opacity: 0.65, pointerEvents: "none" }} width="100%" height="10">
        {Array.from({ length: 24 }).map((_,i) => (
          <circle key={i} cx={`${(i+0.5) * (100/24)}%`} cy="5" r="2" fill={gold}/>
        ))}
      </svg>

      {/* Top */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: gold, opacity: 0.9 }}>
            Good Local · {region}
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600,
            letterSpacing: "-0.012em", lineHeight: 1.05, marginTop: 6, color: ink,
            fontVariationSettings: '"opsz" 36',
          }}>
            {businessName}
          </div>
        </div>
        <MiniSeal ink={gold}/>
      </div>

      {/* Stamp impression — cream-on-leather, like a debossed mark */}
      <div style={{ position: "absolute", top: 130, right: -10, transform: "rotate(-8deg)", zIndex: 2, opacity: 0.95 }}>
        <svg width="140" height="100" viewBox="0 0 200 140" style={{ overflow: "visible" }}>
          <rect x="6" y="6" width="188" height="128" rx="4" fill="none" stroke={stamp} strokeWidth="3.5" opacity="0.9"/>
          <rect x="14" y="14" width="172" height="112" rx="2" fill="none" stroke={stamp} strokeWidth="1.2" opacity="0.7"/>
          <text x="100" y="50" textAnchor="middle" fill={stamp}
            style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 22 }}>Narrowsburg</text>
          <text x="100" y="78" textAnchor="middle" fill={stamp}
            style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 11, letterSpacing: "0.28em" }}>VERIFIED · REGULAR</text>
          <text x="100" y="108" textAnchor="middle" fill={stamp}
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 11, letterSpacing: "0.08em" }}>06·14·2026 · NY</text>
        </svg>
      </div>

      <div style={{ flex: 1 }}/>

      {/* Bottom — perk + count */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: gold, opacity: 0.85 }}>
            Next perk
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 19, fontWeight: 500, lineHeight: 1.2, color: ink }}>
            {perkLabel}
          </div>
          {perkSub ? <div style={{ fontSize: 12, opacity: 0.78, color: ink }}>{perkSub}</div> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: gold, opacity: 0.85 }}>Stamps</div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 56, fontWeight: 600,
            lineHeight: 1, letterSpacing: "-0.02em", color: ink,
          }}>
            {count}
            {total ? <span style={{ opacity: 0.55, fontSize: 36 }}> / {total}</span> : null}
          </div>
        </div>
      </div>

      <PassFooter serial={serial} footer="Stamped at the register" expires={expires} ink={ink} dividerColor="rgba(246,241,228,0.2)"/>
    </PassShell>
  );
}
