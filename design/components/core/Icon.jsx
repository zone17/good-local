import React from "react";

/* Icon paths — hand-picked from the Lucide set (ISC license).
   24×24 viewbox, 2px stroke, round cap/join. We embed instead of
   loading a sprite so the system works offline on weak rural cell
   signal — the whole patron flow has to be instant. */

const PATHS = {
  // Navigation
  "arrow-left":   <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>,
  "arrow-right":  <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
  "chevron-right":<polyline points="9 18 15 12 9 6"/>,
  "chevron-down": <polyline points="6 9 12 15 18 9"/>,
  "x":            <><line x1="18" y1="6"  x2="6"  y2="18"/><line x1="6"  y1="6" x2="18" y2="18"/></>,
  "menu":         <><line x1="3" y1="6"  x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>,

  // State
  "check":        <polyline points="20 6 9 17 4 12"/>,
  "plus":         <><line x1="12" y1="5"  x2="12" y2="19"/><line x1="5"  y1="12" x2="19" y2="12"/></>,
  "minus":        <line x1="5"  y1="12" x2="19" y2="12"/>,
  "info":         <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
  "alert":        <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,

  // Product
  "qr":           <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><line x1="14" y1="14" x2="14" y2="17"/><line x1="14" y1="20" x2="17" y2="20"/><line x1="17" y1="14" x2="17" y2="17"/><line x1="20" y1="17" x2="20" y2="20"/><line x1="20" y1="14" x2="20" y2="14"/></>,
  "wallet":       <><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></>,
  "map-pin":      <><path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>,
  "compass":      <><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></>,
  "calendar":     <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  "clock":        <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  "star":         <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
  "heart":        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>,
  "coffee":       <><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></>,
  "store":        <><path d="M3 9 4 4h16l1 5"/><path d="M4 22V11"/><path d="M20 22V11"/><path d="M4 22h16"/><path d="M9 22v-6h6v6"/></>,
  "leaf":         <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96c1.4 4.2 0 8.5-3.2 11.6A8 8 0 0 1 11 20Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></>,
  "user":         <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  "users":        <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  "bell":         <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
  "settings":     <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></>,
  "trending-up":  <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
  "search":       <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  "edit":         <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
  "trash":        <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></>,
  "share":        <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>,
  "stamp":        <><path d="M5 22h14"/><path d="M19 14v3c0 .27-.12.53-.34.7-.21.2-.5.3-.78.3H6.12c-.28 0-.57-.1-.78-.3-.22-.17-.34-.43-.34-.7v-3"/><path d="M9 14a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3 3 3 0 0 0 3-3 3 3 0 0 0 3 3 3 3 0 0 1 3 3v3a3 3 0 0 1-3 3"/></>,
};

export function Icon({ name, size = 20, strokeWidth = 2, className = "", style, ...rest }) {
  const path = PATHS[name];
  if (!path) {
    return (
      <span
        title={`missing icon: ${name}`}
        style={{ display: "inline-block", width: size, height: size, background: "var(--ink-100)" }}
      />
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["gl-icon", className].filter(Boolean).join(" ")}
      style={style}
      aria-hidden="true"
      {...rest}
    >
      {path}
    </svg>
  );
}

Icon.names = Object.keys(PATHS);
