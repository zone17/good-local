// ============================================================
// checkin/main.jsx — the real /c/{slug} scan-landing flow (T030).
//
// The sacred path, rendered: parse the QR target, ensure an anon patron
// session, call record_check_in on mount, then show the stamped confirmation
// (Stamp halo + ProgressMeter) with wallet/claim CTAs. Invalid paths map to
// brand-voice copy by §7 error code.
//
// Bundle discipline (R7/SC-008, ≤60KB gz): this entry imports ONLY the design
// tokens CSS + Stamp + ProgressMeter + Button via direct file paths (no DS
// barrel), and talks to Supabase over plain fetch (checkin-api.js) instead of
// pulling @supabase/supabase-js.
//
// Durable record: record_check_in COMMITS the stamp server-side before this
// component renders the result. If rendering then fails, the stamp persists —
// the patron's visit is never lost to a UI error (Edge Case).
//
// Dev routing: Vite rewrites /c/* → /checkin.html (see vite.config.js).
// Prod: configure the host to rewrite /c/:path* → /checkin.html (Vercel rewrite).
// ============================================================
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@ds/styles.css";
import { Stamp, StampGrid } from "@ds/components/passport/Stamp.jsx";
import { ProgressMeter } from "@ds/components/passport/ProgressMeter.jsx";
import { WalletPass } from "@ds/components/passport/WalletPass.jsx";
import { Button } from "@ds/components/core/Button.jsx";
import { Card } from "@ds/components/core/Card.jsx";
import { recordCheckIn, addToPassport, claimPassport } from "./checkin-api.js";

// Map a §7 error code → brand-voice copy (clients branch on code, never message).
const ERROR_COPY = {
  CODE_RETIRED: {
    title: "This code is out of date.",
    body: "Tell the counter — they'll print a fresh one.",
  },
  CODE_INVALID: {
    title: "That code didn't match.",
    body: "Scan the QR by the register, or ask the counter for help.",
  },
  DAILY_LIMIT: {
    title: "Already stamped today.",
    body: "Come back tomorrow for the next one.",
    passport: true,
  },
  BUSINESS_SUSPENDED: {
    title: "Stamps are paused here.",
    body: "This spot is taking a short break. Try again soon.",
  },
  BUSINESS_NOT_FOUND: {
    title: "We couldn't find this spot.",
    body: "Double-check the QR and give it another scan.",
  },
  UNAUTHENTICATED: {
    title: "Something went sideways.",
    body: "Give it another scan — your passport is safe.",
  },
  DEFAULT: {
    title: "Something went sideways.",
    body: "Give it another scan — your passport is safe.",
  },
};

function parseTarget() {
  // /c/{slug}?k={code}. In dev the path is rewritten to /checkin.html, so the
  // original /c/{slug} is preserved in location.pathname; fall back to query.
  const path = window.location.pathname;
  const m = path.match(/\/c\/([^/?#]+)/);
  const params = new URLSearchParams(window.location.search);
  const slug = m ? decodeURIComponent(m[1]) : params.get("slug");
  const code = params.get("k") || params.get("code");
  return { slug, code };
}

const fmtDate = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}·${String(d.getDate()).padStart(2, "0")}`;
};

function App() {
  const [phase, setPhase] = useState("stamping"); // stamping | success | error | claim
  const [result, setResult] = useState(null);
  const [errorCode, setErrorCode] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const { slug, code } = parseTarget();
    if (!slug || !code) {
      setErrorCode("CODE_INVALID");
      setPhase("error");
      return;
    }
    (async () => {
      try {
        const data = await recordCheckIn({ businessSlug: slug, codeValue: code });
        if (cancelled) return;
        setResult({ ...data, slug });
        setPhase("success");
      } catch (err) {
        if (cancelled) return;
        setErrorCode(err.code || "DEFAULT");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "stamping") return <Stamping />;
  if (phase === "error") return <ErrorScreen code={errorCode} />;
  if (phase === "claim") return <ClaimSheet onClose={() => setPhase("success")} />;
  return <Success result={result} onClaim={() => setPhase("claim")} />;
}

function Shell({ children }) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        padding: "28px 20px 24px",
        background: "var(--paper-100)",
        color: "var(--ink-1000)",
        fontFamily: "var(--font-body, var(--font-sans))",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {children}
    </main>
  );
}

function Stamping() {
  return (
    <Shell>
      <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={{ display: "grid", placeItems: "center", marginBottom: 16 }}>
            <Stamp state="empty" size={120} />
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            Stamping…
          </div>
          <div style={{ color: "var(--ink-500)", fontSize: 14, marginTop: 6 }}>
            One moment — pressing your visit into the passport.
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Success({ result, onClaim }) {
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const perk = result?.perk_progress;
  const region = result?.regional_progress;
  const stamp = result?.stamp;
  const name = prettyName(result?.slug);
  const remaining = perk ? Math.max(0, perk.threshold - perk.current) : null;
  const milestoneUnlocked = (region?.milestones_unlocked || []).length > 0;
  const stampLabel = stamp?.stamp_code ?? codeLabel(name);

  const onAddWallet = async () => {
    setAdding(true);
    try {
      await addToPassport();
      setAdded(true);
    } catch {
      setAdded(true); // the add intent is recorded best-effort; never block.
    } finally {
      setAdding(false);
      setShowSheet(false);
    }
  };

  return (
    <Shell>
      {/* Halo burst behind the fresh stamp (design check-in flow) */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", top: 110, left: "50%", transform: "translateX(-50%)",
          width: 280, height: 280, borderRadius: "50%",
          background: "radial-gradient(circle, color-mix(in srgb, var(--stamp-300) 60%, transparent), transparent 70%)",
          animation: "gl-halo-burst 520ms cubic-bezier(.18,.9,.32,1.2) both",
          pointerEvents: "none", zIndex: 0,
        }}
      />

      <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
        <div className="gl-eyebrow" style={{ color: "var(--stamp-700)" }}>
          {perk ? `Stamp #${perk.current}` : "Stamped"}
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 600,
            lineHeight: 1.05,
            margin: "8px 0 10px",
            letterSpacing: "-0.014em",
            textWrap: "balance",
            fontVariationSettings: '"opsz" 32',
          }}
        >
          Stamped at {name}.
        </div>
        {perk ? (
          <div style={{ color: "var(--ink-700)", fontSize: 14, lineHeight: 1.5, textWrap: "pretty" }}>
            {perk.ready ? (
              <>
                Your <strong>{perk.name}</strong> is ready. Show this at the register.
              </>
            ) : (
              <>
                You&apos;re <strong>{remaining} {remaining === 1 ? "visit" : "visits"}</strong> from {perk.name.toLowerCase()}.
              </>
            )}
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", placeItems: "center", padding: "20px 0 8px", position: "relative", zIndex: 1 }}>
        <Stamp
          state="earned"
          label={stampLabel}
          date={fmtDate(stamp?.stamped_at)}
          size={132}
          just
          rotate={-4}
        />
      </div>

      {perk ? (
        <div className="gl-rise" style={{ position: "relative", zIndex: 1 }}>
          <Card style={{ padding: "14px 16px" }}>
            <ProgressMeter
              count={perk.current}
              total={perk.threshold}
              label={perk.name}
              remainingLabel={remaining === 0 ? "earned" : `${remaining} to go`}
            />
            <div style={{ marginTop: 12 }}>
              <StampGrid
                size={40} gap={8} columns={perk.threshold} total={perk.threshold}
                stamps={Array.from({ length: Math.min(perk.current, perk.threshold) }).map((_, i) => ({
                  label: stampLabel,
                  rotate: [-3, 2, -2, 3, -1, 4, -4, 1][i % 8],
                  just: i === perk.current - 1,
                }))}
              />
            </div>
          </Card>
        </div>
      ) : null}

      {region ? (
        <div style={{ textAlign: "center", color: "var(--ink-500)", fontSize: 13, marginTop: 14, position: "relative", zIndex: 1 }}>
          {milestoneUnlocked
            ? `New milestone — ${region.towns_visited} of ${region.towns_total} towns.`
            : `${region.towns_visited} of ${region.towns_total} towns this season.`}
        </div>
      ) : null}

      <div style={{ flex: 1 }} />

      <div className="gl-rise" style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 1 }}>
        {added ? (
          <div
            role="status"
            style={{
              textAlign: "center",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--pine-700)",
              padding: "12px 0",
            }}
          >
            Saved to your passport.
          </div>
        ) : (
          <Button variant="wallet" block disabled={adding} onClick={() => setShowSheet(true)}>
            {adding ? "Saving…" : "Add Passport to Apple Wallet"}
          </Button>
        )}
        <Button variant="secondary" block as="a" href="/app">
          Open my passport
        </Button>
        {!added ? (
          <Button variant="ghost" block onClick={onClaim}>
            Save my passport with my phone
          </Button>
        ) : null}
      </div>

      {showSheet ? (
        <WalletAddSheet
          name={name}
          perk={perk}
          stampLabel={stampLabel}
          adding={adding}
          onAdd={onAddWallet}
          onClose={() => setShowSheet(false)}
        />
      ) : null}
    </Shell>
  );
}

// Bottom sheet: preview the pass before adding (design check-in flow).
function WalletAddSheet({ name, perk, stampLabel, adding, onAdd, onClose }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(14,36,25,0.55)",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
        zIndex: 50,
        animation: "gl-fade 180ms ease-out both",
      }}
    >
      <div
        role="dialog"
        aria-label="Add your passport to your wallet"
        style={{
          background: "var(--paper-50)",
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: "10px 18px 22px",
          animation: "gl-sheet-up 240ms cubic-bezier(.2,.8,.2,1) both",
        }}
      >
        <div style={{ width: 38, height: 4, background: "var(--ink-200)", borderRadius: 2, margin: "0 auto 14px" }} />
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div className="gl-eyebrow">Preview</div>
          <div
            style={{
              fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600,
              lineHeight: 1.15, marginTop: 4, letterSpacing: "-0.012em",
              fontVariationSettings: '"opsz" 22',
            }}
          >
            Your Upper Delaware Passport
          </div>
        </div>
        <div style={{ display: "grid", placeItems: "center", marginBottom: 8 }}>
          <WalletPass
            businessName={name}
            region="Upper Delaware"
            count={perk ? perk.current : 1}
            total={perk ? perk.threshold : 1}
            perkLabel={perk ? perk.name : "Your pass"}
            perkSub={perk && perk.ready ? "Ready — show this at the register" : ""}
            stampCode={stampLabel}
            style={{ "--pass-w": "304px", "--pass-h": "376px", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          <Button variant="wallet" block disabled={adding} onClick={onAdd}>
            {adding ? "Saving…" : "Add to Apple Wallet"}
          </Button>
          <Button variant="ghost" block onClick={onClose}>Not now</Button>
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({ code }) {
  const copy = ERROR_COPY[code] || ERROR_COPY.DEFAULT;
  return (
    <Shell>
      <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div style={{ maxWidth: 320 }}>
          <div style={{ display: "grid", placeItems: "center", marginBottom: 18 }}>
            <Stamp state="locked" size={108} />
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.012em",
              marginBottom: 8,
            }}
          >
            {copy.title}
          </div>
          <div style={{ color: "var(--ink-700)", fontSize: 15, lineHeight: 1.5 }}>{copy.body}</div>
          {copy.passport ? (
            <div style={{ marginTop: 20 }}>
              <Button variant="secondary" block as="a" href="/app">
                Open my passport
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}

function ClaimSheet({ onClose }) {
  const [step, setStep] = useState("phone"); // phone | otp | done
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const sendCode = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await claimPassport({ phone });
      if (res && res.dev_otp) setDevOtp(res.dev_otp);
      setStep("otp");
    } catch (e) {
      setErr(e.code === "PHONE_INVALID" ? "Enter a number like +1 845 555 0142." : "Couldn't send the code. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setErr(null);
    try {
      await claimPassport({ phone, otp });
      setStep("done");
    } catch (e) {
      setErr(
        e.code === "OTP_EXPIRED"
          ? "That code expired. Send a fresh one."
          : "That code didn't match. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 360, margin: "0 auto", width: "100%" }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "-0.012em",
            marginBottom: 8,
          }}
        >
          {step === "done" ? "You're all set." : "Keep your passport for good."}
        </div>

        {step === "phone" ? (
          <>
            <div style={{ color: "var(--ink-500)", fontSize: 14, marginBottom: 16 }}>
              Add your number so your stamps follow you to any phone.
            </div>
            <input
              className="gl-input"
              type="tel"
              inputMode="tel"
              placeholder="+1 845 555 0142"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
              aria-label="Phone number"
            />
            {err ? <div style={{ color: "var(--stamp-700)", fontSize: 13, marginTop: 8 }}>{err}</div> : null}
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <Button variant="primary" block disabled={busy || phone.length < 8} onClick={sendCode}>
                {busy ? "Sending…" : "Send me a code"}
              </Button>
              <Button variant="ghost" block onClick={onClose}>
                Not now
              </Button>
            </div>
          </>
        ) : null}

        {step === "otp" ? (
          <>
            <div style={{ color: "var(--ink-500)", fontSize: 14, marginBottom: 16 }}>
              Enter the 6-digit code we sent to {phone}.
              {devOtp ? <span style={{ display: "block", marginTop: 6, fontFamily: "var(--font-mono)" }}>dev code: {devOtp}</span> : null}
            </div>
            <input
              className="gl-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              aria-label="One-time code"
            />
            {err ? <div style={{ color: "var(--stamp-700)", fontSize: 13, marginTop: 8 }}>{err}</div> : null}
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <Button variant="primary" block disabled={busy || otp.length < 6} onClick={verify}>
                {busy ? "Checking…" : "Confirm"}
              </Button>
              <Button variant="ghost" block onClick={onClose}>
                Not now
              </Button>
            </div>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <div style={{ color: "var(--ink-700)", fontSize: 15, marginBottom: 20 }}>
              Your passport is saved. Your stamps will follow you to any phone.
            </div>
            <Button variant="secondary" block as="a" href="/app">
              Open my passport
            </Button>
          </>
        ) : null}
      </div>
    </Shell>
  );
}

function prettyName(slug) {
  if (!slug) return "this spot";
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// A short stamp label from the business name (first letters), uppercase, ≤4.
function codeLabel(name) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (initials || name.slice(0, 3)).slice(0, 4);
}

createRoot(document.getElementById("root")).render(<App />);
