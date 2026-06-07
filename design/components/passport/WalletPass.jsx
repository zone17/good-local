import React from "react";

/**
 * The wallet pass — what the patron sees in Apple/Google Wallet
 * and the in-app preview. Mirrors PassKit geometry (340×420 @1×,
 * 14-px radius).
 *
 * Visual direction: a deep-leather passport-book cover. Pine,
 * river or oxblood leather with gold-foil accents (ochre-300),
 * a round debossed stamp pressed into the corner, embossed
 * perforations along the top edge. Italic display serif for the
 * perk; big numeric stamp count. The "day" kraft variant is the
 * lighter inside-page look.
 */
export function WalletPass({
  businessName,
  region = "Upper Delaware",
  count,
  total,
  perkLabel,
  perkSub,
  variant = "pine",
  stampCode,
  stampDate = "06·14·2026",
  serial,
  footer,
  expires,
  style,
  className = "",
}) {
  const tones = {
    pine:  { bg: "var(--pine-1000)", ink: "var(--paper-100)", gold: "var(--ochre-300)", stamp: "var(--paper-100)", divider: "rgba(246,241,228,0.2)" },
    river: { bg: "var(--river-900)", ink: "var(--paper-100)", gold: "var(--ochre-300)", stamp: "var(--paper-100)", divider: "rgba(246,241,228,0.2)" },
    ink:   { bg: "#3A1810",          ink: "var(--paper-100)", gold: "var(--ochre-300)", stamp: "var(--paper-100)", divider: "rgba(246,241,228,0.2)" },
    kraft: { bg: "var(--paper-300)", ink: "var(--pine-1000)", gold: "var(--stamp-700)", stamp: "var(--stamp-700)", divider: "rgba(35,77,58,0.28)" },
  };
  const t = tones[variant] || tones.pine;
  const isDark = variant !== "kraft";
  const code = stampCode || deriveCode(businessName);
  const uid = React.useId ? React.useId().replace(/:/g, "") : Math.random().toString(36).slice(2, 8);

  return (
    <div
      className={["gl-pass", className].filter(Boolean).join(" ")}
      style={{
        position: "relative",
        width: "var(--pass-w)",
        height: "var(--pass-h)",
        background: t.bg,
        color: t.ink,
        borderRadius: "var(--pass-radius)",
        boxShadow: "var(--shadow-pass)",
        padding: 22,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
        fontFamily: "var(--font-body)",
        border: isDark ? "1px solid rgba(246,241,228,0.10)" : "1px solid rgba(35,77,58,0.18)",
        ...style,
      }}
    >
      {/* Leather / paper grain */}
      <svg style={{ position: "absolute", inset: 0, opacity: isDark ? 0.06 : 0.08, pointerEvents: "none" }} width="100%" height="100%" aria-hidden="true">
        <defs>
          <pattern id={`pass-grain-${uid}`} x="0" y="0" width={isDark ? 3 : 6} height={isDark ? 9 : 6} patternUnits="userSpaceOnUse">
            {isDark ? (
              <>
                <circle cx="1.5" cy="2" r="0.6" fill={t.ink}/>
                <circle cx="1.5" cy="6" r="0.4" fill={t.ink} opacity="0.6"/>
              </>
            ) : (
              <circle cx="3" cy="3" r="0.6" fill="var(--ink-1000)"/>
            )}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#pass-grain-${uid})`}/>
      </svg>

      {/* Embossed perforations along the top */}
      <svg style={{ position: "absolute", top: 6, left: 0, right: 0, opacity: isDark ? 0.55 : 0.32, pointerEvents: "none" }} width="100%" height="10" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <circle key={i} cx={`${(i + 0.5) * (100 / 24)}%`} cy="5" r="2" fill={isDark ? t.gold : t.ink}/>
        ))}
      </svg>

      {/* Top — region + business + seal */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 8 }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.16em",
            textTransform: "uppercase", color: isDark ? t.gold : t.ink, opacity: isDark ? 0.9 : 0.7,
          }}>
            Good Local · {region}
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600,
            letterSpacing: "-0.012em", lineHeight: 1.05, marginTop: 6, color: t.ink,
            fontVariationSettings: '"opsz" 36',
          }}>
            {businessName}
          </div>
        </div>
        <PassSeal ink={isDark ? t.gold : t.ink} size={44}/>
      </div>

      {/* Debossed round stamp impression — upper-right area, rotated */}
      <div style={{ position: "absolute", top: 130, right: 10, transform: "rotate(-6deg)", zIndex: 2, opacity: 0.95 }}>
        <svg width="120" height="120" viewBox="0 0 160 160" aria-hidden="true">
          <circle cx="80" cy="80" r="68" fill="none" stroke={t.stamp} strokeWidth="3" opacity="0.9"/>
          <circle cx="80" cy="80" r="58" fill="none" stroke={t.stamp} strokeWidth="1" opacity="0.6"/>
          <defs>
            <path id={`pass-arc-t-${uid}`} d="M 22 80 A 58 58 0 0 1 138 80" fill="none"/>
            <path id={`pass-arc-b-${uid}`} d="M 24 84 A 56 56 0 0 0 136 84" fill="none"/>
          </defs>
          <text fill={t.stamp} style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 10, letterSpacing: "0.26em" }}>
            <textPath href={`#pass-arc-t-${uid}`} startOffset="50%" textAnchor="middle">{(region || "").toUpperCase()}</textPath>
          </text>
          <text fill={t.stamp} style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 9, letterSpacing: "0.18em" }}>
            <textPath href={`#pass-arc-b-${uid}`} startOffset="50%" textAnchor="middle">{stampDate}</textPath>
          </text>
          <text x="80" y="92" textAnchor="middle" fill={t.stamp}
            style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 36, letterSpacing: "-0.02em" }}>
            {code}
          </text>
        </svg>
      </div>

      <div style={{ flex: 1 }}/>

      {/* Bottom — perk + count */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {perkLabel ? (
            <>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
                textTransform: "uppercase", color: isDark ? t.gold : t.ink, opacity: isDark ? 0.85 : 0.65,
              }}>
                Next perk
              </div>
              <div style={{
                fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 19,
                fontWeight: 500, lineHeight: 1.2, color: t.ink,
              }}>
                {perkLabel}
              </div>
              {perkSub ? <div style={{ fontSize: 12, opacity: 0.78, color: t.ink }}>{perkSub}</div> : null}
            </>
          ) : null}
        </div>
        {(count != null || total != null) ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
              textTransform: "uppercase", color: isDark ? t.gold : t.ink, opacity: isDark ? 0.85 : 0.65,
            }}>
              Stamps
            </div>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 56, fontWeight: 600,
              lineHeight: 1, letterSpacing: "-0.02em", color: t.ink,
              fontVariationSettings: '"opsz" 72',
            }}>
              {count}
              {total ? <span style={{ opacity: 0.55, fontSize: 36 }}> / {total}</span> : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer — serial + footer + expires */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        gap: 12, borderTop: `1px dashed ${t.divider}`, paddingTop: 12,
      }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em",
          color: t.ink, opacity: 0.7,
        }}>
          {serial || "UDP·NRWB·a7q9"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          {footer ? <span style={{ fontSize: 11, color: t.ink, opacity: 0.85 }}>{footer}</span> : null}
          {expires ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: t.ink, opacity: 0.65 }}>exp {expires}</span> : null}
        </div>
      </div>
    </div>
  );
}

function deriveCode(name) {
  if (!name) return "GL";
  const words = name.replace(/^The\s+/i, "").split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const w = words[0].replace(/[^a-z]/gi, "").toUpperCase();
    return w.slice(0, 3) || "GL";
  }
  return words.map((w) => (w[0] || "").toUpperCase()).join("").slice(0, 3) || "GL";
}

function PassSeal({ ink = "currentColor", size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" style={{ color: ink, opacity: 0.95 }} aria-hidden="true">
      <circle cx="60" cy="60" r="56" stroke={ink} strokeWidth="3" fill="none"/>
      <circle cx="60" cy="60" r="48" stroke={ink} strokeWidth="1.5" fill="none"/>
      <g transform="translate(60 62)">
        <path d="M -22 8 L -11 -10 L -3 0 L 5 -14 L 16 6 L 22 8 Z" fill={ink}/>
        <path d="M -24 14 Q -13 10 -3 14 T 24 14" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round"/>
      </g>
    </svg>
  );
}
