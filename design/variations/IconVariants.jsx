// ============================================================
// App icon variations — 59 NP poster inspiration
// ============================================================
//
// Each icon is drawn as an SVG, clipped to the iOS squircle.
// Designed at 1024 viewBox, displayed at the size you choose.
// Two-color and three-color compositions only — no gradients,
// no glow, no detail past 1024px. WPA-poster discipline.

const ICON_R = 232; // squircle radius @ 1024 = ~22.7%

function Squircle({ children, bg = "var(--pine-700)" }) {
  return (
    <svg viewBox="0 0 1024 1024" width="100%" height="100%" style={{ display: "block" }}>
      <rect width="1024" height="1024" rx={ICON_R} fill={bg}/>
      {children}
    </svg>
  );
}

// ---- A · Sunrise Layers --------------------------------------
// Three-band horizon — sky · land · water — with the ochre sun
// rising. The "Where the river meets the day" frame.

function IconSunriseLayers({ scheme = "pine" }) {
  const palette = scheme === "river" ? {
    sky: "var(--river-700)", land: "var(--pine-1000)", water: "var(--river-900)",
    sun: "var(--ochre-500)", ripple: "rgba(255,255,255,0.5)",
  } : {
    sky: "var(--pine-700)", land: "var(--pine-1000)", water: "var(--river-700)",
    sun: "var(--ochre-500)", ripple: "rgba(255,255,255,0.45)",
  };
  return (
    <Squircle bg={palette.sky}>
      <g>
        {/* Sun */}
        <circle cx="512" cy="500" r="190" fill={palette.sun}/>
        {/* Back ridge */}
        <path d="M 0 600 L 180 460 L 320 550 L 470 410 L 620 540 L 780 430 L 920 530 L 1024 480 L 1024 760 L 0 760 Z" fill={palette.land} opacity="0.85"/>
        {/* Front ridge */}
        <path d="M 0 700 L 140 600 L 280 680 L 440 580 L 600 700 L 760 600 L 900 690 L 1024 640 L 1024 760 L 0 760 Z" fill={palette.land}/>
        {/* Water */}
        <rect y="760" width="1024" height="264" fill={palette.water}/>
        {/* Ripples */}
        <path d="M 80 830 Q 220 815 360 830 T 640 830 T 960 830" stroke={palette.ripple} strokeWidth="6" fill="none" strokeLinecap="round"/>
        <path d="M 60 900 Q 220 880 380 900 T 700 900 T 980 900" stroke={palette.ripple} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.7"/>
        <path d="M 100 960 Q 260 945 420 960 T 720 960 T 980 960" stroke={palette.ripple} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.5"/>
      </g>
    </Squircle>
  );
}

// ---- B · River Bend ------------------------------------------
// Bird's-eye / cartographic. The river S-curves through the
// icon. Single ochre sun-dot top right. Slate-blue led.

function IconRiverBend({ scheme = "river" }) {
  const palette = scheme === "river" ? {
    bg: "var(--river-700)", land: "var(--pine-700)", river: "var(--paper-100)",
    deep: "var(--river-900)", sun: "var(--ochre-500)",
  } : {
    bg: "var(--pine-700)", land: "var(--pine-1000)", river: "var(--paper-100)",
    deep: "var(--pine-900)", sun: "var(--ochre-500)",
  };
  return (
    <Squircle bg={palette.bg}>
      {/* Land — two soft humps suggesting the bend's inner banks */}
      <path d="M 0 0 L 1024 0 L 1024 320 Q 760 380 640 520 Q 540 640 380 700 Q 200 760 0 730 Z" fill={palette.land}/>
      <path d="M 0 720 Q 200 760 380 720 Q 540 680 660 580 Q 800 460 1024 420 L 1024 1024 L 0 1024 Z" fill={palette.land} opacity="0.75"/>
      {/* River */}
      <path d="M 0 360 Q 280 380 460 500 Q 620 610 760 660 Q 880 700 1024 700 L 1024 600 Q 880 580 760 540 Q 620 480 460 380 Q 280 280 0 280 Z" fill={palette.river}/>
      {/* River depth lines */}
      <path d="M 60 420 Q 280 440 460 540 Q 620 620 800 640" stroke={palette.deep} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.35"/>
      <path d="M 60 480 Q 280 500 460 590 Q 620 660 800 670" stroke={palette.deep} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.3"/>
      {/* Sun */}
      <circle cx="820" cy="220" r="90" fill={palette.sun}/>
    </Squircle>
  );
}

// ---- C · Single Peak -----------------------------------------
// One bold triangle, sun centered behind, water reflecting it.
// The most poster-like — Saul-Bass clarity.

function IconSinglePeak({ scheme = "pine" }) {
  const palette = scheme === "river" ? {
    bg: "var(--river-700)", peak: "var(--pine-1000)", second: "var(--pine-700)",
    sun: "var(--ochre-500)", water: "var(--river-900)", reflect: "var(--ochre-300)",
  } : {
    bg: "var(--pine-700)", peak: "var(--pine-1000)", second: "var(--pine-900)",
    sun: "var(--ochre-500)", water: "var(--pine-1000)", reflect: "var(--ochre-300)",
  };
  return (
    <Squircle bg={palette.bg}>
      {/* Sun behind peak */}
      <circle cx="540" cy="420" r="200" fill={palette.sun}/>
      {/* Secondary peak right */}
      <polygon points="620,720 880,260 1024,720" fill={palette.second} opacity="0.85"/>
      {/* Primary peak */}
      <polygon points="120,720 460,180 800,720" fill={palette.peak}/>
      {/* Snow cap */}
      <path d="M 380 320 L 460 180 L 540 320 L 500 300 L 460 320 L 420 300 Z" fill="var(--paper-100)"/>
      {/* Water */}
      <rect y="720" width="1024" height="304" fill={palette.water}/>
      {/* Reflection of the sun */}
      <ellipse cx="540" cy="800" rx="100" ry="14" fill={palette.reflect} opacity="0.7"/>
      <ellipse cx="540" cy="850" rx="140" ry="10" fill={palette.reflect} opacity="0.5"/>
      <ellipse cx="540" cy="900" rx="180" ry="8" fill={palette.reflect} opacity="0.35"/>
    </Squircle>
  );
}

// ---- D · Pines & Bend ----------------------------------------
// Three conifers on a riverbank, river curving past. Most
// "Catskills" of the bunch. Cream river so it reads on dark.

function IconPinesBend({ scheme = "pine" }) {
  const palette = scheme === "river" ? {
    bg: "var(--river-700)", land: "var(--pine-1000)", tree: "var(--pine-1000)",
    river: "var(--paper-100)", trunk: "var(--ochre-900)", moon: "var(--ochre-500)",
  } : {
    bg: "var(--paper-100)", land: "var(--pine-700)", tree: "var(--pine-1000)",
    river: "var(--river-500)", trunk: "var(--stamp-700)", moon: "var(--ochre-500)",
  };
  return (
    <Squircle bg={palette.bg}>
      {/* Hills behind */}
      <path d="M 0 540 Q 220 440 480 480 Q 740 520 1024 460 L 1024 1024 L 0 1024 Z" fill={palette.land} opacity="0.45"/>
      {/* Foreground bank */}
      <path d="M 0 700 Q 240 640 460 700 Q 660 760 1024 720 L 1024 1024 L 0 1024 Z" fill={palette.land}/>
      {/* River */}
      <path d="M 0 740 Q 200 700 380 720 Q 540 740 720 760 Q 880 780 1024 760 L 1024 840 Q 880 860 720 850 Q 540 838 380 820 Q 200 800 0 830 Z" fill={palette.river} opacity="0.85"/>
      {/* Sun / moon */}
      <circle cx="820" cy="260" r="110" fill={palette.moon}/>
      {/* Trees — three conifers, foreground */}
      {[180, 360, 540].map((x, i) => (
        <g key={i} transform={`translate(${x} ${640 - i * 40})`}>
          <polygon points="0,0 -90,160 -50,160 -90,260 -40,260 -70,340 70,340 40,260 90,260 50,160 90,160" fill={palette.tree}/>
          <rect x="-12" y="340" width="24" height="60" fill={palette.trunk}/>
        </g>
      ))}
    </Squircle>
  );
}

// ---- E · Seal monogram ---------------------------------------
// Just the seal mark, big and centered, like a varsity letter.
// The most minimal — works at 16px.

function IconSealMonogram({ scheme = "pine" }) {
  const bg = scheme === "river" ? "var(--river-700)" : "var(--pine-700)";
  const fg = "var(--paper-100)";
  const accent = "var(--ochre-500)";
  return (
    <Squircle bg={bg}>
      <g transform="translate(512 512)">
        <circle r="380" stroke={fg} strokeWidth="14" fill="none"/>
        <circle r="320" stroke={fg} strokeWidth="6" fill="none"/>
        {/* Mountain glyph */}
        <g transform="translate(0 60)">
          <polygon points="-160,80 -80,-110 -20,0 50,-150 160,60 220,80" fill={fg}/>
          {/* River wave */}
          <path d="M -220 140 Q -110 100 0 140 T 220 140" stroke={fg} strokeWidth="14" fill="none" strokeLinecap="round"/>
          <path d="M -220 190 Q -110 150 0 190 T 220 190" stroke={fg} strokeWidth="10" fill="none" strokeLinecap="round" opacity="0.6"/>
        </g>
        {/* Cardinal dots */}
        <circle cx="0"   cy="-380" r="14" fill={accent}/>
        <circle cx="0"   cy="380"  r="14" fill={fg}/>
        <circle cx="-380" cy="0"   r="14" fill={fg}/>
        <circle cx="380" cy="0"    r="14" fill={fg}/>
      </g>
    </Squircle>
  );
}

// ---- F · Sun & Compass ---------------------------------------
// A compass star over a river bend, kraft texture — feels like
// the cover plate of a folded map. Sophisticated, fun.

function IconCompass({ scheme = "kraft" }) {
  const palette = scheme === "river" ? {
    bg: "var(--river-700)", star: "var(--paper-100)", inner: "var(--ochre-500)",
    river: "var(--paper-100)", land: "var(--river-900)",
  } : {
    bg: "var(--paper-300)", star: "var(--pine-700)", inner: "var(--ochre-500)",
    river: "var(--river-500)", land: "var(--pine-1000)",
  };
  return (
    <Squircle bg={palette.bg}>
      {/* River band at bottom */}
      <path d="M 0 760 Q 220 720 460 760 Q 720 800 1024 750 L 1024 1024 L 0 1024 Z" fill={palette.land} opacity="0.85"/>
      <path d="M 0 800 Q 220 760 460 800 Q 720 840 1024 790 L 1024 880 Q 720 920 460 880 Q 220 840 0 880 Z" fill={palette.river}/>
      {/* Compass star */}
      <g transform="translate(512 460)">
        <polygon points="0,-340 60,-60 340,0 60,60 0,340 -60,60 -340,0 -60,-60" fill={palette.star}/>
        <polygon points="0,-200 32,-32 200,0 32,32 0,200 -32,32 -200,0 -32,-32" fill={palette.inner}/>
        <circle r="40" fill={palette.star}/>
      </g>
    </Squircle>
  );
}

Object.assign(window, {
  IconSunriseLayers, IconRiverBend, IconSinglePeak,
  IconPinesBend, IconSealMonogram, IconCompass,
});
