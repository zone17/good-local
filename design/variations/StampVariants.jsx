// ============================================================
// Stamp mark variations
// ============================================================
//
// Each stamp is drawn at 320×320 viewbox for portability, then
// rendered at the size requested. They all use --stamp-700 by
// default but can swap to ink/pine via `tone`.
//
// Mood: pulled from the 59 NP poster book + the Park Service's
// real cancellation stamps. Slight rotation lets them feel
// hand-pressed, not vector-perfect.

function StampSvg({ size = 200, tone = "stamp", rotate = -3, viewBox = "0 0 320 320", children }) {
  const color = tone === "ink" ? "var(--ink-1000)" : tone === "pine" ? "var(--pine-700)" : "var(--stamp-700)";
  return (
    <div style={{
      width: size, height: size, display: "grid", placeItems: "center",
      transform: `rotate(${rotate}deg)`, color,
    }}>
      <svg width={size} height={size} viewBox={viewBox} fill="none" stroke="currentColor" style={{ overflow: "visible" }}>
        {children}
      </svg>
    </div>
  );
}

// ---- A · Rectangle (current) — the customs-stamp baseline ----

function StampRectangle({ size = 200, tone, rotate = -3, town = "NARROWSBURG", date = "06·14·2026", code = "NY" }) {
  return (
    <StampSvg size={size} tone={tone} rotate={rotate}>
      <rect x="14" y="40" width="292" height="220" rx="6" stroke="currentColor" strokeWidth="6"/>
      <rect x="26" y="52" width="268" height="196" rx="3" stroke="currentColor" strokeWidth="2"/>
      <text x="160" y="120" textAnchor="middle" fill="currentColor" stroke="none"
        style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 38, letterSpacing: "-0.01em" }}>
        {town.slice(0,1) + town.slice(1).toLowerCase()}
      </text>
      <text x="160" y="170" textAnchor="middle" fill="currentColor" stroke="none"
        style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 22, letterSpacing: "0.32em" }}>
        VERIFIED · REGULAR
      </text>
      <text x="160" y="220" textAnchor="middle" fill="currentColor" stroke="none"
        style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 22, letterSpacing: "0.06em" }}>
        {date} · {code}
      </text>
    </StampSvg>
  );
}

// ---- B · Round NP-passport classic ---------------------------
// The shape you actually see in National Park passport books:
// a circle with arc text, a glyph dead-center, and a date band.

function StampRoundPassport({ size = 200, tone, rotate = -2, town = "NARROWSBURG · NY", date = "06·14·2026" }) {
  return (
    <StampSvg size={size} tone={tone} rotate={rotate} viewBox="0 0 320 320">
      <circle cx="160" cy="160" r="150" stroke="currentColor" strokeWidth="6" fill="none"/>
      <circle cx="160" cy="160" r="138" stroke="currentColor" strokeWidth="2" fill="none"/>
      <circle cx="160" cy="160" r="84" stroke="currentColor" strokeWidth="2" fill="none"/>
      <defs>
        <path id={`arc-t-${size}`} d="M 36 160 A 124 124 0 0 1 284 160" fill="none"/>
        <path id={`arc-b-${size}`} d="M 36 168 A 124 124 0 0 0 284 168" fill="none"/>
      </defs>
      <text fill="currentColor" stroke="none"
        style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 18, letterSpacing: "0.32em" }}>
        <textPath href={`#arc-t-${size}`} startOffset="50%" textAnchor="middle">{town}</textPath>
      </text>
      <text fill="currentColor" stroke="none"
        style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 16, letterSpacing: "0.24em" }}>
        <textPath href={`#arc-b-${size}`} startOffset="50%" textAnchor="middle">UPPER · DELAWARE</textPath>
      </text>
      {/* Center mountain + river glyph */}
      <g transform="translate(160 156)">
        <polygon points="-50,28 -20,-16 -2,4 20,-26 50,28 60,30 -60,30" fill="currentColor"/>
        <path d="M -56 44 Q -28 36 0 44 T 56 44" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round"/>
      </g>
      {/* Date band */}
      <text x="160" y="270" textAnchor="middle" fill="currentColor" stroke="none"
        style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 18, letterSpacing: "0.08em" }}>
        {date}
      </text>
    </StampSvg>
  );
}

// ---- C · Sunset Rectangle — the poster-stamp -----------------
// A rectangle with a sunset landscape *inside* the stamp.
// This is the most "59 NP book" of the bunch.

function StampSunsetPoster({ size = 240, tone = "stamp", rotate = -2, town = "Narrowsburg", date = "06·14·2026" }) {
  // Multi-color, intentionally — sun is ochre, water is river, land is pine.
  // The outer rule still inherits the stamp tone.
  return (
    <div style={{
      width: size, height: size * 0.72, display: "grid", placeItems: "center",
      transform: `rotate(${rotate}deg)`,
    }}>
      <svg viewBox="0 0 320 230" width={size} height={size * 0.72} style={{ overflow: "visible" }}>
        {/* Outer + inner border in stamp tone */}
        <rect x="10" y="10" width="300" height="210" rx="6" fill="none" stroke="var(--stamp-700)" strokeWidth="6"/>
        <rect x="20" y="20" width="280" height="190" rx="3" fill="none" stroke="var(--stamp-700)" strokeWidth="2"/>
        {/* Inside: WPA poster */}
        <clipPath id={`poster-clip-${size}`}>
          <rect x="26" y="26" width="268" height="178" rx="2"/>
        </clipPath>
        <g clipPath={`url(#poster-clip-${size})`}>
          <rect x="26" y="26" width="268" height="178" fill="var(--paper-100)"/>
          <circle cx="160" cy="120" r="50" fill="var(--ochre-500)"/>
          <path d="M 26 150 L 96 92 L 138 130 L 178 80 L 230 130 L 294 100 L 294 180 L 26 180 Z" fill="var(--pine-700)" opacity="0.85"/>
          <path d="M 26 175 L 80 138 L 134 168 L 198 130 L 250 168 L 294 145 L 294 204 L 26 204 Z" fill="var(--pine-1000)"/>
          <rect x="26" y="186" width="268" height="18" fill="var(--river-700)"/>
        </g>
        {/* Type — town + date overlaid on the border */}
        <text x="160" y="60" textAnchor="middle" fill="var(--stamp-700)"
          style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 30 }}>{town}</text>
        <text x="160" y="220" textAnchor="middle" fill="var(--stamp-700)"
          style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 14, letterSpacing: "0.12em" }}>
          VERIFIED · {date} · NY
        </text>
      </svg>
    </div>
  );
}

// ---- D · Oval cancellation -----------------------------------
// Postal cancellation feel — oval, with arc text + bars.
// Compact; works on a thin space.

function StampOvalCancel({ size = 220, tone, rotate = 1, town = "NARROWSBURG · NY", date = "06·14" }) {
  return (
    <div style={{
      width: size, height: size * 0.62, display: "grid", placeItems: "center",
      transform: `rotate(${rotate}deg)`,
      color: tone === "ink" ? "var(--ink-1000)" : tone === "pine" ? "var(--pine-700)" : "var(--stamp-700)",
    }}>
      <svg viewBox="0 0 320 200" width={size} height={size * 0.62} fill="none" stroke="currentColor" style={{ overflow: "visible" }}>
        <ellipse cx="160" cy="100" rx="148" ry="88" stroke="currentColor" strokeWidth="4" fill="none"/>
        <ellipse cx="160" cy="100" rx="138" ry="80" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <defs>
          <path id={`oval-arc-${size}`} d="M 32 100 A 128 70 0 0 1 288 100" fill="none"/>
        </defs>
        <text fill="currentColor" stroke="none"
          style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 16, letterSpacing: "0.36em" }}>
          <textPath href={`#oval-arc-${size}`} startOffset="50%" textAnchor="middle">{town}</textPath>
        </text>
        <line x1="50" y1="120" x2="270" y2="120" stroke="currentColor" strokeWidth="1.5"/>
        <text x="160" y="148" textAnchor="middle" fill="currentColor" stroke="none"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontStyle: "italic", fontSize: 30 }}>{date}</text>
        <line x1="50" y1="164" x2="270" y2="164" stroke="currentColor" strokeWidth="1.5"/>
        <text x="160" y="184" textAnchor="middle" fill="currentColor" stroke="none"
          style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 12, letterSpacing: "0.28em" }}>UPPER · DELAWARE</text>
      </svg>
    </div>
  );
}

// ---- E · Hexagonal trail marker ------------------------------
// Inspired by trail blazes / fire-lookout patches. Geometric,
// modern. Each business code lives big in the center.

function StampHexBlaze({ size = 200, tone, rotate = -4, code = "HRN", town = "NARROWSBURG", date = "06·14" }) {
  return (
    <StampSvg size={size} tone={tone} rotate={rotate} viewBox="0 0 320 320">
      <polygon points="160,18 296,98 296,222 160,302 24,222 24,98" stroke="currentColor" strokeWidth="6" fill="none"/>
      <polygon points="160,32 282,104 282,216 160,288 38,216 38,104" stroke="currentColor" strokeWidth="2" fill="none"/>
      <text x="160" y="100" textAnchor="middle" fill="currentColor" stroke="none"
        style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 16, letterSpacing: "0.34em" }}>{town}</text>
      <line x1="80" y1="118" x2="240" y2="118" stroke="currentColor" strokeWidth="2"/>
      <text x="160" y="200" textAnchor="middle" fill="currentColor" stroke="none"
        style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 80, letterSpacing: "-0.02em" }}>{code}</text>
      <line x1="80" y1="222" x2="240" y2="222" stroke="currentColor" strokeWidth="2"/>
      <text x="160" y="252" textAnchor="middle" fill="currentColor" stroke="none"
        style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 16, letterSpacing: "0.18em" }}>{date}</text>
    </StampSvg>
  );
}

Object.assign(window, {
  StampRectangle, StampRoundPassport, StampSunsetPoster,
  StampOvalCancel, StampHexBlaze,
});
