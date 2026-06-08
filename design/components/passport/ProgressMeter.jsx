import React from "react";

/**
 * "You're 2 visits from the regular's pour" — the breadth/depth meter.
 * No streaks (visits are weekly-ish, not daily). No timer.
 */
export function ProgressMeter({
  count,
  total,
  label,
  remainingLabel,
  tone = "pine",
  size = "md",
  className = "",
}) {
  const remaining = total != null ? Math.max(0, total - count) : null;
  const pct = total ? Math.min(100, (count / total) * 100) : 0;
  const tones = {
    pine:  { fg: "var(--pine-700)",  bg: "var(--pine-100)" },
    stamp: { fg: "var(--stamp-700)", bg: "var(--stamp-100)" },
    ochre: { fg: "var(--ochre-700)", bg: "var(--ochre-100)" },
    river: { fg: "var(--river-700)", bg: "var(--river-100)" },
  };
  const t = tones[tone] || tones.pine;
  const heights = { sm: 6, md: 10, lg: 14 };
  return (
    <div className={["gl-progress", className].filter(Boolean).join(" ")} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(label || remaining != null) ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          {label ? (
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink-1000)" }}>{label}</span>
          ) : <span />}
          {remaining != null ? (
            // ink-700 (not ink-500): the 12px mono label sits on kraft cards
            // (#ece4d0) where ink-500 measures 4.46:1 — just under AA 4.5
            // (Art. IX). ink-700 clears it on every surface.
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: "var(--ink-700)",
            }}>
              {remaining === 0 ? "earned" : (remainingLabel || `${remaining} to go`)}
            </span>
          ) : null}
        </div>
      ) : null}
      <div style={{
        height: heights[size] || heights.md, borderRadius: 999, background: t.bg, overflow: "hidden",
      }}>
        <div
          style={{
            width: `${pct}%`, height: "100%", background: t.fg,
            borderRadius: 999, transition: "width var(--duration-base) var(--ease-out)",
          }}
        />
      </div>
    </div>
  );
}
