import React from "react";

export function Tabs({ tabs, value, onChange, className = "" }) {
  return (
    <div className={["gl-tabs", className].filter(Boolean).join(" ")} role="tablist">
      {tabs.map((t) => {
        const id = typeof t === "string" ? t : t.value;
        const label = typeof t === "string" ? t : t.label;
        const selected = id === value;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={selected}
            className="gl-tabs__tab"
            onClick={() => onChange && onChange(id)}
            type="button"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
