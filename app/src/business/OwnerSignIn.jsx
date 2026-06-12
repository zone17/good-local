// ============================================================
// OwnerSignIn.jsx — the owner's sign-in gate (T064, spec 002 FR-021).
//
// Renders when /business has no session. Plain email + password via
// auth.signInOwner; links new owners to /business/signup. "Forgot your
// password?" sends the Supabase reset email; the link returns here and
// BusinessApp mounts the set-new-password form on PASSWORD_RECOVERY.
// Labeled fields and real button semantics (a11y AA — Art. IX).
// ============================================================
import React, { useState } from "react";
import { Button, Card, Field, Input, Notice } from "../ds.js";
import { SealMark } from "../ds.js";
import { signInOwner, resetOwnerPassword } from "../lib/auth.js";

export default function OwnerSignIn({ onSignedIn }) {
  const [mode, setMode] = useState("signin"); // signin | reset | reset-sent
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
      // Network failure is not a credentials failure (audit ERR-021).
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      const transient = offline || /fetch|network|timeout/i.test(err?.message || "");
      setError(
        transient
          ? "We could not reach the server. Check your connection and try again."
          : "That email and password didn't match. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendReset(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await resetOwnerPassword(email.trim());
      setMode("reset-sent");
    } catch {
      setError("We could not send the reset email. Try again in a moment.");
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
          {mode === "signin" ? "Sign in to your program" : "Reset your password"}
        </div>

        {error ? <Notice tone="ochre" style={{ marginBottom: 12 }}>{error}</Notice> : null}

        {mode === "signin" ? (
          <>
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
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button
                type="button"
                onClick={() => { setMode("reset"); setError(null); }}
                style={{ background: "none", border: "none", padding: 4, fontSize: 13, color: "var(--pine-700)", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
              >
                Forgot your password?
              </button>
            </div>
            <div style={{ textAlign: "center", fontSize: 13, color: "var(--ink-700)", marginTop: 10, lineHeight: 1.6 }}>
              New here? <a href="/business/signup" style={{ color: "var(--pine-700)", fontWeight: 600 }}>Set up your program</a> and be live the day you are approved.
            </div>
          </>
        ) : null}

        {mode === "reset" ? (
          <form onSubmit={sendReset} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 14, color: "var(--ink-700)", lineHeight: 1.55, margin: 0 }}>
              Enter the email on your account and we will send a link to set a new password.
            </p>
            <Field label="Email">
              <Input type="email" autoComplete="email" required value={email}
                     onChange={(e) => setEmail(e.target.value)} placeholder="you@yourbusiness.com"/>
            </Field>
            <Button type="submit" block disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
            <Button type="button" variant="ghost" block onClick={() => { setMode("signin"); setError(null); }}>
              Back to sign in
            </Button>
          </form>
        ) : null}

        {mode === "reset-sent" ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 14.5, color: "var(--ink-700)", lineHeight: 1.6, margin: "0 0 16px" }}>
              Check your email. If an account exists for {email.trim() || "that address"},
              a reset link is on its way. It returns you here to set a new password.
            </p>
            <Button variant="ghost" block onClick={() => { setMode("signin"); setError(null); }}>
              Back to sign in
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
