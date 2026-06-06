import React from "react";

/** Round icon-only tap target — 44px floor, 52px for the wet-hands variant. */
export function IconButton({
  size = "md",
  bordered = false,
  label,
  className = "",
  children,
  ...rest
}) {
  const cls = [
    "gl-iconbtn",
    size === "lg" ? "gl-iconbtn--lg" : "",
    bordered ? "gl-iconbtn--bordered" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} aria-label={label} {...rest}>
      {children}
    </button>
  );
}
