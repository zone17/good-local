// ============================================================
// App icon — universal directions (region-neutral)
// ============================================================
//
// These work whether the next town is a coastal village, a
// desert main street, or a Brooklyn block. No mountains, no
// conifers, no specific river. They lean into:
//   - identity (G monogram, seal)
//   - product action (stamp, return loop)
//   - feeling (sunrise, welcome doorway)
//
// All sit on the iOS squircle.

const ICON_R2 = 232;

function Squircle2({ children, bg = "var(--pine-700)" }) {
  return (
    <svg viewBox="0 0 1024 1024" width="100%" height="100%" style={{ display: "block" }}>
      <rect width="1024" height="1024" rx={ICON_R2} fill={bg}/>
      {children}
    </svg>
  );
}

// ---- G · G Monogram ------------------------------------------
// Newsreader display "G" inside a thin ring. Varsity-stamp feel
// — the most identity-led. Carries the brand name on its own.

function IconGMonogram({ scheme = "pine" }) {
  const bg = scheme === "river" ? "var(--river-700)" :
             scheme === "kraft" ? "var(--paper-300)" : "var(--pine-700)";
  const fg = scheme === "kraft" ? "var(--pine-700)" : "var(--paper-100)";
  const accent = "var(--ochre-500)";
  return (
    <Squircle2 bg={bg}>
      <circle cx="512" cy="512" r="400" stroke={fg} strokeWidth="14" fill="none"/>
      <circle cx="512" cy="512" r="360" stroke={fg} strokeWidth="3" fill="none" opacity="0.7"/>
      <text x="512" y="700" textAnchor="middle" fill={fg}
        style={{ fontFamily: "var(--font-display)", fontSize: 620, fontWeight: 600, fontVariationSettings: '"opsz" 72', letterSpacing: "-0.02em" }}>
        G
      </text>
      <circle cx="512" cy="112" r="14" fill={accent}/>
    </Squircle2>
  );
}

// ---- H · Stamped Moment --------------------------------------
// The icon IS a stamp impression — the act of being stamped. On
// cream paper, ochre-red impression slightly rotated. Most
// "this app gives you stamps."

function IconStampedMoment({ scheme = "paper" }) {
  const bg = scheme === "pine" ? "var(--pine-700)" :
             scheme === "kraft" ? "var(--paper-300)" : "var(--paper-100)";
  const stamp = scheme === "pine" ? "var(--ochre-500)" : "var(--stamp-700)";
  return (
    <Squircle2 bg={bg}>
      {/* paper grain */}
      <defs>
        <pattern id="g-grain" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="7" r="1.2" fill="var(--ink-1000)" opacity="0.07"/>
        </pattern>
      </defs>
      <rect width="1024" height="1024" fill="url(#g-grain)" opacity={scheme === "pine" ? 0 : 1}/>
      {/* The stamp impression — rotated -6deg */}
      <g transform="translate(512 512) rotate(-6)">
        <circle r="370" stroke={stamp} strokeWidth="22" fill="none"/>
        <circle r="320" stroke={stamp} strokeWidth="6" fill="none" opacity="0.7"/>
        {/* arc text top */}
        <defs>
          <path id="stamp-arc-top" d="M -310 0 A 310 310 0 0 1 310 0" fill="none"/>
          <path id="stamp-arc-bot" d="M -310 0 A 310 310 0 0 0 310 0" fill="none"/>
        </defs>
        <text fill={stamp}
          style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 64, letterSpacing: "0.32em" }}>
          <textPath href="#stamp-arc-top" startOffset="50%" textAnchor="middle">GOOD · LOCAL</textPath>
        </text>
        <text fill={stamp}
          style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 50, letterSpacing: "0.18em" }}>
          <textPath href="#stamp-arc-bot" startOffset="50%" textAnchor="middle">EST · 2026</textPath>
        </text>
        {/* center G monogram */}
        <text y="80" textAnchor="middle" fill={stamp}
          style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 320, letterSpacing: "-0.02em" }}>
          G
        </text>
      </g>
    </Squircle2>
  );
}

// ---- I · Waypoint Pin ----------------------------------------
// A drop-pin shape, paper-color, with a circular stamp in its
// head. "You walked in here, you got stamped." Most discovery-
// focused — reads instantly as a map / place marker.

function IconWaypointPin({ scheme = "pine" }) {
  const bg = scheme === "river" ? "var(--river-700)" : "var(--pine-700)";
  const pin = "var(--paper-100)";
  const stamp = "var(--stamp-700)";
  const accent = "var(--ochre-500)";
  return (
    <Squircle2 bg={bg}>
      {/* Pin shape: circle head + tapered foot */}
      <path d="M 512 220
               C 320 220 220 380 220 540
               C 220 720 412 800 512 920
               C 612 800 804 720 804 540
               C 804 380 704 220 512 220 Z" fill={pin}/>
      {/* Stamp circle inside pin head */}
      <circle cx="512" cy="520" r="180" stroke={stamp} strokeWidth="14" fill="none"/>
      <circle cx="512" cy="520" r="156" stroke={stamp} strokeWidth="4" fill="none" opacity="0.6"/>
      {/* G in stamp */}
      <text x="512" y="620" textAnchor="middle" fill={stamp}
        style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 220, fontStyle: "italic", letterSpacing: "-0.02em" }}>
        G
      </text>
      {/* Ochre dot above pin — "you are here / sun" */}
      <circle cx="512" cy="120" r="34" fill={accent}/>
    </Squircle2>
  );
}

// ---- J · Welcome Doorway -------------------------------------
// An arched doorway opening at the bottom of the squircle. Above
// it, a small seal floats like a transom-window emblem. Reads
// as "walk in — locally yours."

function IconWelcomeDoor({ scheme = "kraft" }) {
  const bg = scheme === "pine" ? "var(--pine-700)" :
             scheme === "river" ? "var(--river-700)" : "var(--paper-300)";
  const door = scheme === "kraft" ? "var(--pine-700)" : "var(--paper-100)";
  const interior = scheme === "kraft" ? "var(--paper-300)" :
                   scheme === "pine" ? "var(--pine-1000)" : "var(--river-900)";
  const accent = "var(--ochre-500)";
  return (
    <Squircle2 bg={bg}>
      {/* Doorframe */}
      <path d="M 240 1024 L 240 540 C 240 380 360 280 512 280 C 664 280 784 380 784 540 L 784 1024 Z" fill={door}/>
      {/* Door opening */}
      <path d="M 320 1024 L 320 560 C 320 432 416 360 512 360 C 608 360 704 432 704 560 L 704 1024 Z" fill={interior}/>
      {/* Transom seal above door */}
      <g transform="translate(512 200)">
        <circle r="80" stroke={door} strokeWidth="10" fill="none"/>
        <circle r="64" stroke={door} strokeWidth="3" fill="none" opacity="0.7"/>
        <text y="32" textAnchor="middle" fill={door}
          style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 100 }}>
          G
        </text>
      </g>
      {/* Door knob (ochre) */}
      <circle cx="640" cy="720" r="20" fill={accent}/>
    </Squircle2>
  );
}

// ---- K · Return Loop -----------------------------------------
// A 270° circular arrow that completes back into itself, with a
// stamp dot in the middle. Captures the "being a regular = you
// return" loop. Most modern / abstract of the bunch.

function IconReturnLoop({ scheme = "pine" }) {
  const bg = scheme === "river" ? "var(--river-700)" : "var(--pine-700)";
  const loop = "var(--paper-100)";
  const dot = "var(--ochre-500)";
  return (
    <Squircle2 bg={bg}>
      {/* Loop — almost full circle, arrowhead at top */}
      <path d="M 760 380
               A 320 320 0 1 0 720 700"
            stroke={loop} strokeWidth="80" fill="none" strokeLinecap="round"/>
      {/* Arrowhead */}
      <path d="M 760 380 L 700 280 L 850 320 Z" fill={loop}/>
      {/* Center stamp dot */}
      <circle cx="512" cy="512" r="100" fill={dot}/>
      <circle cx="512" cy="512" r="74" stroke="var(--stamp-700)" strokeWidth="6" fill="none" opacity="0.7"/>
    </Squircle2>
  );
}

// ---- L · Sun Crest -------------------------------------------
// A half-sun rising from the bottom, rays radiating through a
// pine sky. Landscape-free — no specific geography. The most
// optimistic / welcome-mat read.

function IconSunCrest({ scheme = "pine" }) {
  const bg = scheme === "river" ? "var(--river-700)" :
             scheme === "kraft" ? "var(--paper-300)" : "var(--pine-700)";
  const sun = "var(--ochre-500)";
  const ray = scheme === "kraft" ? "var(--pine-700)" : "var(--paper-100)";
  return (
    <Squircle2 bg={bg}>
      {/* Rays — 5 radiating from the sun */}
      <g transform="translate(512 720)">
        {[-60, -30, 0, 30, 60].map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <rect x="-18" y="-740" width="36" height="500" fill={ray} opacity="0.18" rx="18"/>
          </g>
        ))}
      </g>
      {/* Sun — half-circle peeking up */}
      <g transform="translate(512 720)">
        <circle r="340" fill={sun}/>
        <circle r="260" stroke={ray} strokeWidth="6" fill="none" opacity="0.35"/>
        <circle r="180" stroke={ray} strokeWidth="4" fill="none" opacity="0.25"/>
      </g>
      {/* Crop bottom — sun appears to rise from the squircle edge */}
      <rect y="900" width="1024" height="124" fill={bg}/>
      {/* Wordmark dot above sun */}
      <circle cx="512" cy="280" r="20" fill={ray}/>
    </Squircle2>
  );
}

Object.assign(window, {
  IconGMonogram, IconStampedMoment, IconWaypointPin,
  IconWelcomeDoor, IconReturnLoop, IconSunCrest,
});
