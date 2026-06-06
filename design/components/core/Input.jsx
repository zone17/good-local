import React from "react";

/** Form field shell: label + input + hint/error. */
export function Field({ label, hint, error, children, id, className = "" }) {
  const fieldId = id || `f-${Math.random().toString(36).slice(2, 8)}`;
  const cls = ["gl-field", className].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      {label ? <label htmlFor={fieldId} className="gl-field__label">{label}</label> : null}
      {React.cloneElement(React.Children.only(children), {
        id: fieldId,
        "aria-invalid": error ? "true" : undefined,
        "aria-describedby": (error || hint) ? `${fieldId}-hint` : undefined,
      })}
      {(error || hint) ? (
        <span
          id={`${fieldId}-hint`}
          className={`gl-field__hint${error ? " gl-field__hint--error" : ""}`}
        >
          {error || hint}
        </span>
      ) : null}
    </div>
  );
}

export function Input({ className = "", ...rest }) {
  return <input className={["gl-input", className].filter(Boolean).join(" ")} {...rest} />;
}

export function Textarea({ className = "", ...rest }) {
  return <textarea className={["gl-textarea", className].filter(Boolean).join(" ")} {...rest} />;
}

export function Select({ className = "", children, ...rest }) {
  return (
    <select className={["gl-select", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </select>
  );
}

export function Switch({ checked, onChange, label, id, ...rest }) {
  return (
    <label className="gl-switch" aria-label={label}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange && onChange(e.target.checked, e)}
        id={id}
        {...rest}
      />
      <span className="gl-switch__track"></span>
    </label>
  );
}
