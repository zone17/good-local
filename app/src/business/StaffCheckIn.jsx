// ============================================================
// StaffCheckIn.jsx — the no-scan, staff-entered check-in (T031).
//
// MOUNTING NOTE: this is a STANDALONE component. It is intentionally NOT wired
// into BusinessApp.jsx here (US1 owns that file; integration happens after US1
// merges). To mount: import StaffCheckIn from "./StaffCheckIn.jsx" and render
// <StaffCheckIn businessId={ownedBusinessId} /> on the register surface.
//
// Flow: owner enters a patron phone (E.164) → api.staffCheckIn records an
// auditable, rate-limited staff entry + stamp (FR-016) → success shows the
// stamp result + "Claim link sent" when the patron is unclaimed. Errors map to
// brand-voice copy by §7 code (STAFF_RATE_LIMITED, PHONE_INVALID, …).
// ============================================================
import React, { useState } from "react";
import { Button } from "@ds/components/core/Button.jsx";
import { Field, Input } from "@ds/components/core/Input.jsx";
import { Notice } from "@ds/components/core/Notice.jsx";
import { ProgressMeter } from "@ds/components/passport/ProgressMeter.jsx";
import { staffCheckIn } from "../lib/api.js";

const ERROR_COPY = {
  STAFF_RATE_LIMITED: "That's a lot of entries today. Take a breath and try again later.",
  PHONE_INVALID: "Enter a number like +1 845 555 0142.",
  BUSINESS_SUSPENDED: "Stamps are paused while billing catches up.",
  DAILY_LIMIT: "This guest is already stamped today.",
  FORBIDDEN: "You can only stamp for your own business.",
  DEFAULT: "Something went sideways. Try that again.",
};

// Light E.164 normalization: keep a leading +, strip the rest to digits.
function normalizePhone(raw) {
  const cleaned = raw.replace(/[^\d+]/g, "");
  return cleaned.startsWith("+") ? "+" + cleaned.slice(1).replace(/\+/g, "") : cleaned;
}

export default function StaffCheckIn({ businessId }) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [errorCode, setErrorCode] = useState(null);

  const submit = async () => {
    setBusy(true);
    setErrorCode(null);
    setResult(null);
    try {
      const data = await staffCheckIn({ businessId, phone: normalizePhone(phone) });
      setResult(data);
      setPhone("");
    } catch (err) {
      setErrorCode(err.code || "DEFAULT");
    } finally {
      setBusy(false);
    }
  };

  const perk = result?.perk_progress;
  const remaining = perk ? Math.max(0, perk.threshold - perk.current) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 420 }}>
      <div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.012em",
          }}
        >
          Stamp a regular
        </div>
        <div style={{ color: "var(--ink-500)", fontSize: 14, marginTop: 4 }}>
          No phone to scan? Enter their number and the stamp is saved to it.
          They can claim their passport with that number at goodlocal.app.
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && normalizePhone(phone).length >= 8) submit();
        }}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <Field label="Guest phone number" hint="Their stamps stay with this number until they claim their passport.">
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="+1 845 555 0142"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>

        <Button
          type="submit"
          variant="primary"
          block
          disabled={busy || normalizePhone(phone).length < 8}
        >
          {busy ? "Stamping…" : "Stamp this visit"}
        </Button>
      </form>

      {errorCode ? (
        <Notice tone="stamp" title="Couldn't stamp that">
          {ERROR_COPY[errorCode] || ERROR_COPY.DEFAULT}
        </Notice>
      ) : null}

      {result ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Notice tone="pine" title="Stamped">
            Their visit is recorded.
          </Notice>
          {perk ? (
            <ProgressMeter
              count={perk.current}
              total={perk.threshold}
              label={perk.ready ? "Perk ready" : "Toward the perk"}
              remainingLabel={remaining === 0 ? "earned" : `${remaining} to go`}
            />
          ) : null}
          {result.claim_link_sent ? (
            <Notice tone="river" title="Saved to their number">
              Their stamps stay with that number. They can claim their passport
              any time at goodlocal.app.
            </Notice>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
