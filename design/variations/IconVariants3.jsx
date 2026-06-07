// ============================================================
// App icon — round 3: tactile, hand-made, product-literal
// ============================================================
//
// The first batch was landscape. The second was monogram. This
// batch goes for things you can hold, touch, count, or read off
// the side of a building — the stamp itself, a tally, a pennant,
// a hand-painted sign, a dog-eared passport page.
//
// Conceptually distinct from each other; pick by what story
// resonates, not by which shape looks coolest.

const ICON_R3 = 232;

function SquircleX({ children, bg = "var(--pine-700)" }) {
  return (
    <svg viewBox="0 0 1024 1024" width="100%" height="100%" style={{ display: "block" }}>
      <rect width="1024" height="1024" rx={ICON_R3} fill={bg}/>
      {children}
    </svg>
  );
}

// ---- M · Tally Mark ------------------------------------------
// IIII / — the universal count-to-five mark. Most honest about
// the product mechanic (stamps build up). Fresh angle — no one
// else in the loyalty space uses tally marks. Hand-brushed feel.

function IconTallyMark({ scheme = "pine" }) {
  const bg = scheme === "kraft" ? "var(--paper-300)" :
             scheme === "river" ? "var(--river-700)" : "var(--pine-700)";
  const mark = scheme === "kraft" ? "var(--stamp-700)" : "var(--paper-100)";
  const accent = "var(--ochre-500)";
  // 4 strokes + 1 diagonal — slightly hand-drawn rotations
  const strokes = [
    { x: 250, rot: -2 },
    { x: 380, rot: 1 },
    { x: 510, rot: -1 },
    { x: 640, rot: 2 },
  ];
  return (
    <SquircleX bg={bg}>
      {/* 4 vertical strokes */}
      {strokes.map((s, i) => (
        <g key={i} transform={`translate(${s.x} 512) rotate(${s.rot})`}>
          <rect x="-30" y="-260" width="60" height="520" rx="30" fill={mark}/>
        </g>
      ))}
      {/* Diagonal cross stroke — the 5th, in ochre */}
      <g transform="translate(450 512) rotate(28)">
        <rect x="-30" y="-340" width="60" height="680" rx="30" fill={accent}/>
      </g>
    </SquircleX>
  );
}

// ---- N · Hand-Stamped Circle ---------------------------------
// A slightly-wobbly, organic stamp impression on cream paper.
// The icon IS the moment of being stamped. Imperfect by design.

function IconHandStamped({ scheme = "paper" }) {
  const bg = scheme === "pine" ? "var(--pine-700)" :
             scheme === "kraft" ? "var(--paper-300)" : "var(--paper-100)";
  const stamp = scheme === "pine" ? "var(--ochre-500)" : "var(--stamp-700)";
  return (
    <SquircleX bg={bg}>
      {/* Paper grain */}
      <defs>
        <pattern id="grain-m" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="7" r="1.2" fill="var(--ink-1000)" opacity="0.07"/>
        </pattern>
        <filter id="rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="3"/>
          <feDisplacementMap in="SourceGraphic" scale="6"/>
        </filter>
      </defs>
      <rect width="1024" height="1024" fill="url(#grain-m)" opacity={scheme === "pine" ? 0 : 1}/>
      {/* Stamp impression — rough-edged via displacement filter */}
      <g transform="translate(512 512) rotate(-5)" filter="url(#rough)">
        {/* Outer ring — broken in two spots so it looks pressed unevenly */}
        <circle r="360" stroke={stamp} strokeWidth="26" fill="none" strokeDasharray="540 60 1500 40"/>
        <circle r="312" stroke={stamp} strokeWidth="6" fill="none" opacity="0.7"/>
        {/* Center text — display italic, slightly tilted */}
        <text y="-30" textAnchor="middle" fill={stamp}
          style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 180, letterSpacing: "-0.01em" }}>
          Good
        </text>
        <text y="120" textAnchor="middle" fill={stamp}
          style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 180, letterSpacing: "-0.01em" }}>
          Local
        </text>
        {/* Tiny date */}
        <text y="240" textAnchor="middle" fill={stamp}
          style={{ fontFamily: "var(--font-mono)", fontSize: 60, letterSpacing: "0.16em", fontWeight: 500 }}>
          EST · 2026
        </text>
      </g>
    </SquircleX>
  );
}

// ---- O · Pennant ---------------------------------------------
// A triangular flag on a tilted pole. Says "good local was
// here" — the act of claiming a spot. Most "founded here" feel.

function IconPennant({ scheme = "pine" }) {
  const bg = scheme === "river" ? "var(--river-700)" :
             scheme === "kraft" ? "var(--paper-300)" : "var(--pine-700)";
  const flag = "var(--ochre-500)";
  const flagInk = "var(--stamp-700)";
  const pole = scheme === "kraft" ? "var(--ink-1000)" : "var(--paper-100)";
  return (
    <SquircleX bg={bg}>
      {/* Pole — tilted */}
      <g transform="translate(280 200) rotate(8)">
        <rect x="-10" y="0" width="20" height="800" rx="6" fill={pole}/>
        {/* Pole cap (small ball) */}
        <circle cx="0" cy="-10" r="22" fill={pole}/>
      </g>
      {/* Triangular pennant */}
      <g transform="translate(290 250) rotate(8)">
        <path d="M 0 30 L 580 80 L 0 220 Z" fill={flag}/>
        {/* G on the pennant */}
        <text x="180" y="170" fill={flagInk}
          style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 200, letterSpacing: "-0.02em" }}>
          G
        </text>
      </g>
    </SquircleX>
  );
}

// ---- P · Shop Sign -------------------------------------------
// A hanging hand-painted shop sign — like the kind on the front
// of a New England inn. Two chains, a wooden plaque, "GOOD
// LOCAL" hand-lettered in display serif.

function IconShopSign({ scheme = "pine" }) {
  const bg = scheme === "river" ? "var(--river-700)" : "var(--pine-700)";
  const chain = "var(--paper-100)";
  const board = "var(--paper-300)";
  const ink = "var(--pine-1000)";
  return (
    <SquircleX bg={bg}>
      {/* Bracket / arm at top */}
      <rect x="200" y="180" width="624" height="22" rx="6" fill={chain}/>
      <rect x="320" y="200" width="14" height="60" fill={chain}/>
      <rect x="690" y="200" width="14" height="60" fill={chain}/>
      {/* Chains — small circle links */}
      {Array.from({ length: 4 }).map((_, i) => (
        <circle key={`l-${i}`} cx="327" cy={272 + i * 30} r="14" stroke={chain} strokeWidth="6" fill="none"/>
      ))}
      {Array.from({ length: 4 }).map((_, i) => (
        <circle key={`r-${i}`} cx="697" cy={272 + i * 30} r="14" stroke={chain} strokeWidth="6" fill="none"/>
      ))}
      {/* Sign board */}
      <rect x="220" y="400" width="584" height="380" rx="14" fill={board}/>
      <rect x="240" y="420" width="544" height="340" rx="6" fill="none" stroke={ink} strokeWidth="4" opacity="0.4"/>
      {/* Hand-lettered text */}
      <text x="512" y="560" textAnchor="middle" fill={ink}
        style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 130, letterSpacing: "-0.01em" }}>
        Good
      </text>
      <text x="512" y="700" textAnchor="middle" fill={ink}
        style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 130, letterSpacing: "-0.01em" }}>
        Local
      </text>
    </SquircleX>
  );
}

// ---- Q · Folded Pass -----------------------------------------
// A dog-eared paper page with a stamp pressed into it. Most
// literally "passport." The page sits slightly off-axis,
// casting a soft shadow. Most editorial/print of the bunch.

function IconFoldedPass({ scheme = "pine" }) {
  const bg = scheme === "river" ? "var(--river-700)" :
             scheme === "ink" ? "var(--ink-1000)" : "var(--pine-700)";
  const paper = "var(--paper-100)";
  const fold = "var(--paper-300)";
  const stamp = "var(--stamp-700)";
  return (
    <SquircleX bg={bg}>
      {/* Drop shadow under page */}
      <g transform="translate(512 580) rotate(-4)">
        <rect x="-310" y="-360" width="620" height="720" rx="10" fill="rgba(0,0,0,0.25)"/>
      </g>
      {/* Page */}
      <g transform="translate(508 568) rotate(-4)">
        <path d="M -310 -360 L 200 -360 L 310 -250 L 310 360 L -310 360 Z" fill={paper}/>
        {/* Folded corner */}
        <path d="M 200 -360 L 310 -250 L 200 -250 Z" fill={fold}/>
        {/* Page rule lines */}
        <line x1="-260" y1="-180" x2="220" y2="-180" stroke="var(--ink-300)" strokeWidth="2"/>
        <line x1="-260" y1="-140" x2="220" y2="-140" stroke="var(--ink-300)" strokeWidth="2" opacity="0.7"/>
        {/* Stamp impression on the page */}
        <g transform="translate(40 100) rotate(-8)">
          <rect x="-180" y="-110" width="360" height="220" rx="6" fill="none" stroke={stamp} strokeWidth="9"/>
          <rect x="-168" y="-98" width="336" height="196" rx="3" fill="none" stroke={stamp} strokeWidth="3" opacity="0.7"/>
          <text x="0" y="-30" textAnchor="middle" fill={stamp}
            style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 64 }}>
            Verified
          </text>
          <text x="0" y="42" textAnchor="middle" fill={stamp}
            style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 30, letterSpacing: "0.28em" }}>
            REGULAR
          </text>
          <text x="0" y="80" textAnchor="middle" fill={stamp}
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 24, letterSpacing: "0.08em" }}>
            06·14·2026
          </text>
        </g>
      </g>
    </SquircleX>
  );
}

// ---- R · Awning ----------------------------------------------
// A striped storefront awning over a doorway. The icon is
// hyperlocal small-business shorthand — Main Street, USA, but
// not regionally specific. Stripes are ochre + paper.

function IconAwning({ scheme = "pine" }) {
  const bg = scheme === "river" ? "var(--river-700)" :
             scheme === "kraft" ? "var(--paper-300)" : "var(--pine-700)";
  const stripeA = "var(--ochre-500)";
  const stripeB = "var(--paper-100)";
  const interior = scheme === "kraft" ? "var(--pine-1000)" :
                   scheme === "river" ? "var(--river-900)" : "var(--pine-1000)";
  const trim = "var(--stamp-700)";
  return (
    <SquircleX bg={bg}>
      {/* Wall behind */}
      <rect x="180" y="600" width="664" height="424" fill={interior}/>
      {/* Storefront door dark opening */}
      <rect x="380" y="700" width="264" height="324" rx="6" fill={bg}/>
      {/* Awning body — trapezoid */}
      <path d="M 180 380 L 844 380 L 760 600 L 264 600 Z" fill={stripeA}/>
      {/* Awning stripes — vertical via clip */}
      <clipPath id="awning-clip">
        <path d="M 180 380 L 844 380 L 760 600 L 264 600 Z"/>
      </clipPath>
      <g clipPath="url(#awning-clip)">
        {[0, 2, 4, 6, 8].map((i) => (
          <rect key={i} x={180 + i * 83} y="380" width="83" height="220" fill={stripeB}/>
        ))}
      </g>
      {/* Awning valance (scalloped lower edge) */}
      <g fill={stripeA}>
        {Array.from({ length: 8 }).map((_, i) => {
          const cx = 264 + 31 + i * 62;
          return <circle key={i} cx={cx} cy="600" r="31"/>;
        })}
      </g>
      {/* Sign on the awning */}
      <rect x="320" y="420" width="384" height="100" rx="10" fill={stripeB}/>
      <text x="512" y="495" textAnchor="middle" fill={trim}
        style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 78, letterSpacing: "-0.012em" }}>
        Good Local
      </text>
    </SquircleX>
  );
}

Object.assign(window, {
  IconTallyMark, IconHandStamped, IconPennant,
  IconShopSign, IconFoldedPass, IconAwning,
});
