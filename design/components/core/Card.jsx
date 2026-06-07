import React from "react";

/**
 * Good Local — Card
 * Default is white surface, soft warm shadow. `kraft` for secondary
 * surfaces (perks, owner notes). `pine` for inverted brand surfaces.
 */
export function Card({
  variant,
  as: Tag = "div",
  padding,
  className = "",
  style,
  children,
  ...rest
}) {
  const cls = [
    "gl-card",
    variant ? `gl-card--${variant}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const mergedStyle = padding ? { ...style, padding } : style;
  return (
    <Tag className={cls} style={mergedStyle} {...rest}>
      {children}
    </Tag>
  );
}
