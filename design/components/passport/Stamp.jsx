import React from "react";

/**
 * The visit token — a round, hand-pressed passport stamp.
 *
 * States:
 *  - earned:  has been collected. Stamp-ink red rings, italic
 *             business code center, date arc below. Slight
 *             rotation gives the human-stamped feel.
 *  - empty:   placeholder, dashed ring.
 *  - locked:  not yet on the patron's path (greyed).
 *
 * `just` triggers the round halo animation — pass true right
 * after the check-in, then unset on the next render.
 *
 * The stamp scales gracefully from 40px (grid cells) to 200px+
 * (hero). At small sizes only the code + date show; at larger
 * sizes the optional `town` arc text appears too.
 */
export function Stamp({
  state = "empty",
  label,
  date,
  size = 60,
  just = false,
  rotate,
  town,
  className = "",
}) {
  const cls = [
    "gl-stamp",
    "gl-stamp--round",
    `gl-stamp--${state}`,
    just && state === "earned" ? "gl-stamp--just" : "",
    className,
  ].filter(Boolean).join(" ");

  const wrapStyle = { width: size, height: size };
  const innerStyle = {
    transform: `rotate(${state === "earned" ? (rotate ?? -3) : 0}deg)`,
  };
  const ariaLabel = state === "earned"
    ? `Stamped${label ? " " + label : ""}${date ? " on " + date : ""}`
    : state === "locked" ? "Locked stamp" : "Empty stamp slot";

  return (
    <span className={cls} style={wrapStyle} aria-label={ariaLabel}>
      <span className="gl-stamp__inner" style={innerStyle}>
        {state === "earned" ? (
          <StampSvg size={size} label={label} date={date} town={town}/>
        ) : state === "locked" ? (
          <span style={{ color: "var(--ink-400)" }}>—</span>
        ) : null}
      </span>
    </span>
  );
}

function StampSvg({ size, label, date, town }) {
  const r1 = size * 0.46;
  const r2 = size * 0.40;
  const stroke1 = Math.max(1.2, size / 36);
  const stroke2 = Math.max(0.6, size / 84);
  const cx = size / 2;
  const cy = size / 2;
  const labelFS = Math.max(8, size * 0.30);
  const dateFS = Math.max(6, size * 0.14);
  const showTown = town && size >= 96;
  const townFS = Math.max(7, size * 0.085);

  // Place arc paths above the center for top town text
  const townPathId = `gl-stamp-town-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r1} stroke="currentColor" strokeWidth={stroke1} fill="none"/>
      <circle cx={cx} cy={cy} r={r2} stroke="currentColor" strokeWidth={stroke2} fill="none" opacity="0.55"/>
      {showTown ? (
        <>
          <defs>
            <path id={townPathId} d={`M ${cx - r2 * 0.92} ${cy} A ${r2 * 0.92} ${r2 * 0.92} 0 0 1 ${cx + r2 * 0.92} ${cy}`} fill="none"/>
          </defs>
          <text fill="currentColor" style={{
            fontFamily: "var(--font-body)", fontWeight: 700, fontSize: townFS,
            letterSpacing: `${townFS * 0.22}px`,
          }}>
            <textPath href={`#${townPathId}`} startOffset="50%" textAnchor="middle">{town}</textPath>
          </text>
        </>
      ) : null}
      {label ? (
        <text x={cx} y={cy + labelFS * 0.28} textAnchor="middle" fill="currentColor"
          style={{
            fontFamily: "var(--font-display)", fontStyle: "italic",
            fontWeight: 600, fontSize: labelFS, letterSpacing: "-0.02em",
          }}>
          {label}
        </text>
      ) : null}
      {date ? (
        <text x={cx} y={cy + labelFS * 0.78 + dateFS} textAnchor="middle" fill="currentColor"
          style={{
            fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: dateFS,
            letterSpacing: "0.06em",
          }}>
          {date}
        </text>
      ) : null}
    </svg>
  );
}

/**
 * A grid of stamps — the "5-to-perk" or "12-town" pattern.
 *
 *   stamps: [{ label?, date?, state?, rotate?, town? }]
 *   total:  pad with empties up to this number
 */
export function StampGrid({ stamps = [], total, columns = 5, gap = 12, size = 60 }) {
  const items = [...stamps];
  if (total && items.length < total) {
    while (items.length < total) items.push({ state: "empty" });
  }
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${columns}, ${size}px)`,
      gap,
      justifyContent: "start",
    }}>
      {items.map((s, i) => (
        <Stamp
          key={i}
          state={s.state || (s.label || s.date ? "earned" : "empty")}
          label={s.label}
          date={s.date}
          size={size}
          rotate={s.rotate}
          town={s.town}
        />
      ))}
    </div>
  );
}
