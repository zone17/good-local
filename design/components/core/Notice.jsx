import React from "react";

export function Notice({ tone = "pine", icon, title, children, className = "" }) {
  const cls = [
    "gl-notice",
    tone && tone !== "pine" ? `gl-notice--${tone}` : "",
    className,
  ].filter(Boolean).join(" ");
  return (
    <div className={cls} role="status">
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {title ? <strong style={{ fontWeight: 600 }}>{title}</strong> : null}
        <span>{children}</span>
      </div>
    </div>
  );
}

export function Row({ avatar, title, sub, trailing, onClick, href, className = "" }) {
  const Tag = href ? "a" : "div";
  const cls = ["gl-row", className].filter(Boolean).join(" ");
  return (
    <Tag className={cls} onClick={onClick} href={href}>
      {avatar ? <div style={{ flexShrink: 0 }}>{avatar}</div> : null}
      <div className="gl-row__body">
        <div className="gl-row__title">{title}</div>
        {sub ? <div className="gl-row__sub">{sub}</div> : null}
      </div>
      {trailing ? <div className="gl-row__chev">{trailing}</div> : null}
    </Tag>
  );
}

export function Divider({ dashed = false, strong = false, style }) {
  const cls = [
    "gl-divider",
    dashed ? "gl-divider--dashed" : "",
    strong ? "gl-divider--strong" : "",
  ].filter(Boolean).join(" ");
  return <hr className={cls} style={style} />;
}
