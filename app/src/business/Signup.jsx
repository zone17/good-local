// ============================================================
// Signup.jsx — owner self-serve onboarding (US1 T021).
// Route /business/signup.
//
// Flow (contracts §3.1, FR-006): collect business + owner identity →
// create the owner auth account → create-checkout-session → redirect to
// Stripe Checkout. On return (?signup=pending) the owner lands on a calm
// pending-approval screen. Day-one $79 billing starts at checkout; admin
// approval flips the business to active.
//
// Design components only; brand voice; no emoji (design/SKILL.md).
// ============================================================
import React, { useState } from "react";
import { Button, Card, Field, Input, Select, Notice, SealMark } from "../ds.js";
import { TOWNS } from "../lib/towns.js";
import { signUpOwner } from "../lib/auth.js";
import * as api from "../lib/api.js";

function uuid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// ---- Pending-approval screen (post-checkout return) ----------

export function PendingApproval() {
  return (
    <main style={shell}>
      <Card style={{ padding: 28, maxWidth: 460, width: "100%", textAlign: "center" }}>
        <div style={{ color: "var(--pine-700)", display: "grid", placeItems: "center", marginBottom: 12 }}>
          <SealMark size={48} />
        </div>
        <h1 style={heading}>You are on the list.</h1>
        <p style={{ color: "var(--ink-700)", lineHeight: 1.5, marginTop: 10 }}>
          Your founding membership is set up and your card is on file. We review every
          business by hand before it goes live in the passport — usually within a day.
          We will email you the moment your program is open.
        </p>
        <div style={{ marginTop: 20 }}>
          <Button block onClick={() => (window.location.href = "/business")}>
            Go to your dashboard
          </Button>
        </div>
      </Card>
    </main>
  );
}

// ---- Signup form --------------------------------------------

export default function Signup() {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [town, setTown] = useState(TOWNS[0].slug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // Establish the owner identity (email + password).
      await signUpOwner(email, password);
      // Mint the Stripe Checkout session; the edge fn creates the pending
      // business row (service role) and returns the hosted checkout URL.
      const { checkout_url } = await api.createCheckoutSession({
        businessName: businessName.trim(),
        ownerEmail: email.trim(),
        town,
        idempotencyKey: uuid(),
      });
      window.location.href = checkout_url;
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  }

  return (
    <main style={shell}>
      <Card style={{ padding: 28, maxWidth: 480, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ color: "var(--pine-700)" }}><SealMark size={32} /></div>
          <div className="gl-eyebrow">Good Local · Business</div>
        </div>
        <h1 style={heading}>Start your rewards program</h1>
        <p style={{ color: "var(--ink-700)", lineHeight: 1.5, marginTop: 8 }}>
          Founding rate, locked: $79 a month. Your own perks, a printable register
          kit, and a calm dashboard. Set it up today; you are live the day we approve.
        </p>

        {error ? (
          <div style={{ marginTop: 16 }}>
            <Notice tone="ochre" title="We could not start checkout">
              {error}
            </Notice>
          </div>
        ) : null}

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
          <Field label="Business name">
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="The Heron" required />
          </Field>
          <Field label="Your name">
            <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Mira Eisen" required />
          </Field>
          <Field label="Town">
            <Select value={town} onChange={(e) => setTown(e.target.value)}>
              {TOWNS.map((t) => (
                <option key={t.slug} value={t.slug}>{t.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Email" hint="We send your weekly note and approval here.">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourplace.com" required />
          </Field>
          <Field label="Password" hint="At least 8 characters.">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </Field>

          <Button type="submit" block disabled={busy}>
            {busy ? "Starting checkout…" : "Continue to payment — $79/mo"}
          </Button>
          <p style={{ fontSize: 12, color: "var(--ink-500)", textAlign: "center", lineHeight: 1.4 }}>
            Card handled by Stripe. We never see your card number. Cancel anytime.
          </p>
        </form>
      </Card>
    </main>
  );
}

function messageFor(err) {
  const code = err && err.code;
  if (code === "DUPLICATE_PENDING") return "A signup for this place is already in review.";
  if (code === "VALIDATION") return "Please check your business name, email, and town.";
  if (code === "STRIPE_ERROR") return "Payment setup hit a snag. Please try again in a moment.";
  return err && err.message ? err.message : "Something went wrong. Please try again.";
}

const shell = {
  minHeight: "100dvh",
  display: "grid",
  placeItems: "center",
  padding: "24px",
  background: "var(--paper-50)",
};

const heading = {
  fontFamily: "var(--font-display)",
  fontSize: 26,
  fontWeight: 600,
  letterSpacing: "-0.012em",
  lineHeight: 1.15,
  margin: 0,
  color: "var(--ink-1000)",
};
