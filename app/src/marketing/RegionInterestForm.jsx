// ============================================================
// RegionInterestForm.jsx — the lead-capture form inside the landing's
// "Region one of many" section. Styled for the dark pine card (light inputs).
// Posts via the SDK-free helper so the landing stays lean (D-028/D-029).
// ============================================================
import React, { useState } from "react";
import { Button } from "../ds.js";
import { postRegionInterest } from "./regionInterest.js";

const inputStyle = {
  flex: "1 1 200px", minWidth: 0, padding: "11px 14px",
  background: "var(--paper-100)", color: "var(--ink-1000)",
  border: "1px solid transparent", borderRadius: 10,
  fontFamily: "var(--font-body)", fontSize: 15,
};

export default function RegionInterestForm() {
  const [region, setRegion] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | busy | done | error
  const [err, setErr] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    if (!region.trim() || !email.trim()) return;
    setStatus("busy"); setErr(null);
    try {
      await postRegionInterest({ region: region.trim(), email: email.trim() });
      setStatus("done");
    } catch {
      setErr("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p role="status" style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: "var(--paper-100)", maxWidth: 520 }}>
        Thank you. We will let you know the moment Good Local reaches{" "}
        <strong>{region}</strong>.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 540 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          aria-label="Your town or region" placeholder="Your town or region"
          value={region} onChange={(e) => setRegion(e.target.value)}
          required maxLength={120} style={inputStyle}
        />
        <input
          aria-label="Email" type="email" placeholder="you@email.com"
          value={email} onChange={(e) => setEmail(e.target.value)}
          required maxLength={200} style={{ ...inputStyle }}
        />
        <Button type="submit" disabled={status === "busy"}
          style={{ background: "var(--paper-100)", color: "var(--pine-1000)", border: "none", flex: "0 0 auto" }}>
          {status === "busy" ? "Sending…" : "Request your region"}
        </Button>
      </div>
      {err ? <div style={{ marginTop: 10, fontSize: 13, color: "var(--ochre-300)" }}>{err}</div> : null}
    </form>
  );
}
