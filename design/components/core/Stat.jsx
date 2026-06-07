import React from "react";

/** Display-serif numeric stat. Use for the dashboard top row. */
export function Stat({ label, value, delta, deltaDirection, suffix, className = "" }) {
  const cls = ["gl-stat", className].filter(Boolean).join(" ");
  const deltaCls = [
    "gl-stat__delta",
    deltaDirection === "up" ? "gl-stat__delta--up" : "",
    deltaDirection === "down" ? "gl-stat__delta--down" : "",
  ].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <span className="gl-stat__label">{label}</span>
      <span className="gl-stat__value">
        {value}
        {suffix ? <span style={{
          fontSize: "0.42em", marginLeft: "0.18em",
          fontFamily: "var(--font-body)", fontWeight: 500,
          color: "var(--ink-500)", letterSpacing: 0,
        }}>{suffix}</span> : null}
      </span>
      {delta ? <span className={deltaCls}>{delta}</span> : null}
    </div>
  );
}
