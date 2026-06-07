// ============================================================
// OwnerSignIn.jsx — the owner's sign-in gate (T064).
//
// Renders when /business has no session. Plain email + password via
// auth.signInOwner; links new owners to /business/signup. Labeled fields and
// real button semantics (a11y AA — Art. IX); brand voice, no hype.
// ============================================================
import React, { useState } from "react";
import { Button, Card, Field, Input, Notice } from "../ds.js";
import { SealMark } from "../ds.js";
import { signInOwner } from "../lib/auth.js";

export default function OwnerSignIn({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInOwner(email.trim(), password);
      onSignedIn?.();
    } catch (err) {
      setError("That email and password didn't match. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100%", display: "grid", placeItems: "center", background: "var(--paper-50)", padding: 24 }}>
      <Card style={{ padding: 28, width: 420, maxWidth: "92vw" }}>
        <div style={{ color: "var(--pine-700)", display: "grid", placeItems: "center", marginBottom: 10 }}>
          <SealMark size={44}/>
        </div>
        <div className="gl-eyebrow" style={{ textAlign: "center" }}>Good Local · Business</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, textAlign: "center", margin: "4px 0 18px", letterSpacing: "-0.012em" }}>
          Sign in to your program
        </div>

        {error ? <Notice tone="ochre" style={{ marginBottom: 12 }}>{error}</Notice> : null}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Email">
            <Input type="email" autoComplete="email" required value={email}
                   onChange={(e) => setEmail(e.target.value)} placeholder="you@yourbusiness.com"/>
          </Field>
          <Field label="Password">
            <Input type="password" autoComplete="current-password" required value={password}
                   onChange={(e) => setPassword(e.target.value)} placeholder="Your password"/>
          </Field>
          <Button type="submit" block disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
        </form>

        <div style={{ textAlign: "center", fontSize: 13, color: "var(--ink-700)", marginTop: 16, lineHeight: 1.6 }}>
          New here? <a href="/business/signup" style={{ color: "var(--pine-700)", fontWeight: 600 }}>Set up your program</a> — live the same day.
        </div>
      </Card>
    </div>
  );
}
