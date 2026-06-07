import React from "react";

/**
 * Good Local — Button
 *
 * Primary: pine-700, paper text — the brand action.
 * Secondary: paper-100 with ink border — register-side / dashboard.
 * Ghost: text-only.
 * Danger: stamp-700.
 * Wallet: ink-1000 — the special "Add to Apple Wallet" CTA.
 */
export function Button({
  variant = "primary",
  size,
  block = false,
  leadingIcon,
  trailingIcon,
  as: Tag = "button",
  className = "",
  children,
  ...rest
}) {
  const cls = [
    "gl-btn",
    variant && variant !== "primary" ? `gl-btn--${variant}` : "",
    size ? `gl-btn--${size}` : "",
    block ? "gl-btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={cls} {...rest}>
      {leadingIcon ? <span className="gl-btn__icon">{leadingIcon}</span> : null}
      <span>{children}</span>
      {trailingIcon ? <span className="gl-btn__icon">{trailingIcon}</span> : null}
    </Tag>
  );
}
