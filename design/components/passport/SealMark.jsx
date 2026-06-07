import React from "react";

/**
 * The circular passport seal. Drawn from primitives so it
 * inherits color via `color` / `currentColor`. Used on the
 * wallet pass, app header, splash, marketing.
 */
export function SealMark({
  size = 96,
  topLine = "UPPER · DELAWARE",
  bottomLine = "GOOD · LOCAL · EST · 2026",
  className = "",
  style,
}) {
  const id = React.useId ? React.useId().replace(/:/g, "-") : `seal-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={["gl-seal", className].filter(Boolean).join(" ")}
      style={{ color: "currentColor", ...style }}
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="56" stroke="currentColor" strokeWidth="3" fill="none"/>
      <circle cx="60" cy="60" r="48" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <defs>
        <path id={`${id}-top`} d="M 18 60 A 42 42 0 0 1 102 60" fill="none"/>
        <path id={`${id}-bot`} d="M 20 60 A 40 40 0 0 0 100 60" fill="none"/>
      </defs>
      <text fontFamily="Public Sans, sans-serif" fontSize="9" fontWeight="700" letterSpacing="2.4" fill="currentColor">
        <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">{topLine}</textPath>
      </text>
      <text fontFamily="Public Sans, sans-serif" fontSize="9" fontWeight="600" letterSpacing="2" fill="currentColor">
        <textPath href={`#${id}-bot`} startOffset="50%" textAnchor="middle">{bottomLine}</textPath>
      </text>
      <g transform="translate(60 62)">
        <path d="M -22 8 L -11 -10 L -3 0 L 5 -14 L 16 6 L 22 8 Z" fill="currentColor"/>
        <path d="M -24 14 Q -13 10 -3 14 T 24 14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M -24 19 Q -13 16 -3 19 T 24 19" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.55"/>
      </g>
      <circle cx="60" cy="10"  r="1.4" fill="currentColor"/>
      <circle cx="60" cy="110" r="1.4" fill="currentColor"/>
      <circle cx="10" cy="60"  r="1.4" fill="currentColor"/>
      <circle cx="110" cy="60" r="1.4" fill="currentColor"/>
    </svg>
  );
}
