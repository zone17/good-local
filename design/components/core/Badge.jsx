import React from "react";

/** Pill badge — soft tinted backgrounds, used for status/category labels. */
export function Badge({ variant, className = "", children, ...rest }) {
  const cls = [
    "gl-badge",
    variant ? `gl-badge--${variant}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}

/** Sharp uppercase mono tag — for codes, perk IDs, regions. */
export function Tag({ variant, className = "", children, ...rest }) {
  const cls = [
    "gl-tag",
    variant ? `gl-tag--${variant}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}
