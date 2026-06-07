// ============================================================
// Good Local — Admin surface (US7, T057)
// The experiment apparatus (Art. III). Mirrors BusinessApp's sidebar
// + content-lane layout, built from the design system (../ds.js) and
// wired to the admin verbs in ../lib/api.js. Five views:
//   Approvals  — pending queue with duplicate-hint Tags; Approve/Decline+reason
//   Picks      — per-town founding-pick curation (set/unset/reorder)
//   Rotation   — per-business code version, rotate-now+reason, schedule editor
//   Gates      — one Card per metric vs its threshold, validity + eligibility
//   Staff audit— staff-entry audit table
//
// Lazy-loaded by App.jsx so the admin bundle never weighs on the main
// patron/owner entries (R7 / SC-008).
// ============================================================
import React, { useEffect, useState } from "react";
import {
  Button, IconButton, Card, Badge, Tag, Icon,
  Field, Input, Select, Divider, SealMark,
} from "../ds.js";
import { supabase } from "../lib/auth.js";
import * as api from "../lib/api.js";

// list_pending_businesses is admin-only and not in the read-only api.js seam;
// call it directly through the shared client (same RPC the UI-less path uses).
function listPendingBusinesses() {
  return supabase.rpc("list_pending_businesses").then(({ data, error }) => {
    if (error) throw error;
    return data ?? [];
  });
}

// ---- Sidebar -----------------------------------------------

function Sidebar({ view, onChange, onSignOut }) {
  const items = [
    { id: "approvals", label: "Approvals", icon: "check" },
    { id: "picks",     label: "Picks",     icon: "stamp" },
    { id: "rotation",  label: "Rotation",  icon: "qr" },
    { id: "gates",     label: "Gates",     icon: "trending-up" },
    { id: "audit",     label: "Staff audit", icon: "users" },
  ];
  return (
    <aside style={{
      width: 240, padding: "20px 14px",
      background: "var(--paper-100)", borderRight: "1px solid var(--ink-100)",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px 10px" }}>
        <div style={{ color: "var(--pine-700)" }}><SealMark size={36}/></div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, lineHeight: 1 }}>Good Local</span>
          <span style={{ fontSize: 11, color: "var(--ink-500)", letterSpacing: 0.04 }}>Admin</span>
        </div>
      </div>
      <Divider style={{ margin: "4px 0 8px" }}/>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((it) => {
          const active = view === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", border: 0, borderRadius: 8,
                background: active ? "var(--pine-700)" : "transparent",
                color: active ? "var(--paper-100)" : "var(--ink-700)",
                fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 500,
                cursor: "pointer", textAlign: "left",
              }}
            >
              <Icon name={it.icon} size={18}/>
              {it.label}
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1 }}/>
      <Card variant="kraft" style={{ padding: 12 }}>
        <div className="gl-eyebrow">Pre-registered</div>
        <div style={{ fontSize: 12, color: "var(--ink-700)", marginTop: 4, lineHeight: 1.4 }}>
          Thresholds are binding — Art. III.
        </div>
        <button
          onClick={onSignOut}
          style={{
            display: "block", marginTop: 10, fontSize: 12, fontWeight: 600,
            color: "var(--pine-700)", background: "none", border: 0, padding: 0,
            cursor: "pointer", textDecoration: "underline",
          }}
        >
          Sign out
        </button>
      </Card>
    </aside>
  );
}

function TopBar({ title, subtitle }) {
  return (
    <div style={{
      padding: "18px 28px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      borderBottom: "1px solid var(--ink-100)", background: "var(--paper-50)",
    }}>
      <div>
        <div className="gl-eyebrow">{subtitle}</div>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600,
          letterSpacing: "-0.012em", lineHeight: 1.1, marginTop: 2,
        }}>
          {title}
        </div>
      </div>
    </div>
  );
}

// ---- Approvals view ----------------------------------------

function Approvals() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [reasons, setReasons] = useState({});

  async function load() {
    setError(null);
    try {
      setRows(await listPendingBusinesses());
    } catch (e) {
      setError(e.message ?? "Could not load pending businesses.");
    }
  }
  useEffect(() => { load(); }, []);

  async function approve(id) {
    setBusy(true); setError(null);
    try { await api.approveBusiness({ businessId: id }); await load(); }
    catch (e) { setError(e.message ?? "Approve failed."); }
    finally { setBusy(false); }
  }
  async function decline(id) {
    const reason = (reasons[id] ?? "").trim();
    if (!reason) { setError("A decline needs a reason."); return; }
    setBusy(true); setError(null);
    try { await api.declineBusiness({ businessId: id, reason }); await load(); }
    catch (e) { setError(e.message ?? "Decline failed."); }
    finally { setBusy(false); }
  }

  if (error) {
    return <Card style={{ padding: 16 }}><div style={{ color: "var(--clay-700, #9a3412)" }}>{error}</div></Card>;
  }
  if (rows.length === 0) {
    return <Card style={{ padding: 16 }}>No businesses are waiting for review.</Card>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {rows.map((b) => (
        <Card key={b.business_id} style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>{b.name}</div>
              <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 2 }}>
                {b.town_name ?? b.town} · {b.category}
              </div>
              {Array.isArray(b.duplicate_hints) && b.duplicate_hints.length > 0 ? (
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--ink-500)" }}>Possible duplicate:</span>
                  {b.duplicate_hints.map((h) => (
                    <Tag key={h.business_id}>{h.name} ({h.match_on})</Tag>
                  ))}
                </div>
              ) : null}
            </div>
            <Badge variant="ochre">Pending</Badge>
          </div>
          <Divider style={{ margin: "12px 0" }}/>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <Button onClick={() => approve(b.business_id)} disabled={busy}>Approve</Button>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Field label="Decline reason">
                <Input
                  value={reasons[b.business_id] ?? ""}
                  placeholder="Why this is declined"
                  onChange={(e) => setReasons((r) => ({ ...r, [b.business_id]: e.target.value }))}
                />
              </Field>
            </div>
            <Button variant="ghost" onClick={() => decline(b.business_id)} disabled={busy}>Decline</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---- Picks view --------------------------------------------

const TOWNS = [
  "narrowsburg", "barryville", "callicoon", "eldred", "jeffersonville",
  "livingston-manor", "bethel", "cochecton", "honesdale", "hawley", "milford", "shohola",
];

function Picks() {
  const [town, setTown] = useState(TOWNS[0]);
  const [picks, setPicks] = useState([]);
  const [businessId, setBusinessId] = useState("");
  const [position, setPosition] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function act(action, extra = {}) {
    setBusy(true); setError(null);
    try {
      const res = await api.curateFoundingPick({ businessId, town, action, ...extra });
      setPicks(res.picks ?? []);
    } catch (e) {
      setError(e.message ?? "Curation failed.");
    } finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="Town">
            <Select value={town} onChange={(e) => { setTown(e.target.value); setPicks([]); }}>
              {TOWNS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Business id">
            <Input value={businessId} placeholder="uuid" onChange={(e) => setBusinessId(e.target.value)} />
          </Field>
          <Field label="Position (for reorder)">
            <Input value={position} placeholder="1" onChange={(e) => setPosition(e.target.value)} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <Button onClick={() => act("set")} disabled={busy || !businessId}>Set pick</Button>
          <Button variant="ghost" onClick={() => act("unset")} disabled={busy || !businessId}>Unset</Button>
          <Button variant="ghost"
            onClick={() => act("order", { position: Number(position) })}
            disabled={busy || !businessId || !position}>Reorder</Button>
        </div>
        {error ? <div style={{ marginTop: 10, color: "var(--clay-700, #9a3412)" }}>{error}</div> : null}
      </Card>

      <Card style={{ padding: 16 }}>
        <div className="gl-eyebrow">Current picks · {town}</div>
        {picks.length === 0 ? (
          <div style={{ marginTop: 8, color: "var(--ink-500)" }}>No picks loaded. Set or reorder to view.</div>
        ) : (
          <ol style={{ marginTop: 10, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {picks.map((p) => (
              <li key={p.business_id} style={{ fontSize: 13 }}>
                <span style={{ fontFamily: "var(--font-mono)" }}>#{p.position}</span> · {p.business_id}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

// ---- Rotation view -----------------------------------------

function Rotation() {
  const [businessId, setBusinessId] = useState("");
  const [reason, setReason] = useState("");
  const [intervalDays, setIntervalDays] = useState("7");
  const [graceHours, setGraceHours] = useState("72");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function rotate(withSchedule) {
    if (!reason.trim()) { setError("A rotation needs a reason."); return; }
    setBusy(true); setError(null);
    try {
      const res = await api.rotateCode({
        businessId, reason: reason.trim(),
        schedule: withSchedule
          ? { interval_days: Number(intervalDays), grace_hours: Number(graceHours) }
          : undefined,
      });
      setResult(res);
    } catch (e) {
      setError(e.message ?? "Rotation failed.");
    } finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="Business id">
            <Input value={businessId} placeholder="uuid" onChange={(e) => setBusinessId(e.target.value)} />
          </Field>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Field label="Reason (recorded)">
              <Input value={reason} placeholder="Why rotate now" onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginTop: 8 }}>
          <Field label="Interval (days)">
            <Input value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
          </Field>
          <Field label="Grace (hours)">
            <Input value={graceHours} onChange={(e) => setGraceHours(e.target.value)} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <Button onClick={() => rotate(false)} disabled={busy || !businessId}>Rotate now</Button>
          <Button variant="ghost" onClick={() => rotate(true)} disabled={busy || !businessId}>
            Rotate + save schedule
          </Button>
        </div>
        {error ? <div style={{ marginTop: 10, color: "var(--clay-700, #9a3412)" }}>{error}</div> : null}
      </Card>

      {result ? (
        <Card style={{ padding: 16 }}>
          <div className="gl-eyebrow">Latest rotation</div>
          <div style={{ marginTop: 8, fontSize: 14 }}>
            New version <strong style={{ fontFamily: "var(--font-mono)" }}>{result.new_version}</strong>
            {" · "}grace until {new Date(result.grace_until).toLocaleString()}
          </div>
          {result.reprint_prompted ? (
            <div style={{ marginTop: 6 }}><Badge variant="ochre">Reprint prompted</Badge></div>
          ) : null}
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-500)" }}>
            Schedule: every {result.schedule.interval_days} days, {result.schedule.grace_hours}h grace
          </div>
        </Card>
      ) : null}
    </div>
  );
}

// ---- Gate dashboard view -----------------------------------

const VALIDITY_BADGE = {
  valid: { variant: "pine", label: "Valid" },
  insufficient_sample: { variant: "ochre", label: "Insufficient sample" },
  trust_invalid: { variant: "clay", label: "Trust-model void" },
};
const ELIGIBILITY_BADGE = {
  ELIGIBLE: { variant: "pine", label: "Eligible" },
  INSUFFICIENT_SAMPLE: { variant: "ochre", label: "Not yet eligible" },
  TRUST_MODEL_VOID: { variant: "clay", label: "Trust-model void" },
};

function fmtValue(v) {
  if (v === null || v === undefined) return "—";
  return String(v);
}

function GateChips({ row }) {
  const chips = [];
  if (row.threshold?.target != null) chips.push(["target", row.threshold.target]);
  if (row.kill_floor != null) chips.push(["kill", row.kill_floor]);
  if (row.sample_floor != null) chips.push(["sample floor", row.sample_floor]);
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
      {chips.map(([k, v]) => <Tag key={k}>{k}: {v}</Tag>)}
    </div>
  );
}

function Gates() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.readGateMetrics().then(setRows).catch((e) => setError(e.message ?? "Could not read gate metrics."));
  }, []);

  if (error) return <Card style={{ padding: 16 }}><div style={{ color: "var(--clay-700, #9a3412)" }}>{error}</div></Card>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card variant="kraft" style={{ padding: 14 }}>
        <div style={{ fontSize: 13, color: "var(--ink-700)", lineHeight: 1.5 }}>
          Thresholds are binding — Art. III. Each reading is the live value against its
          pre-registered threshold; a metric is eligible to score the bet only when it is
          valid and its read window has arrived.
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {rows.map((row) => {
          const vb = VALIDITY_BADGE[row.validity] ?? VALIDITY_BADGE.valid;
          const eb = ELIGIBILITY_BADGE[row.verdict_eligibility] ?? ELIGIBILITY_BADGE.INSUFFICIENT_SAMPLE;
          return (
            <Card key={row.metric} style={{ padding: 16 }}>
              <div className="gl-eyebrow">{row.metric}</div>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 30, fontWeight: 600,
                marginTop: 6, lineHeight: 1,
              }}>
                {fmtValue(row.value)}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>
                n = <span style={{ fontFamily: "var(--font-mono)" }}>{row.n}</span>
                {row.read_on ? <> · reads {row.read_on}</> : null}
              </div>
              <GateChips row={row} />
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <Badge variant={vb.variant}>{vb.label}</Badge>
                <Badge variant={eb.variant}>{eb.label}</Badge>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---- Staff audit view --------------------------------------

function StaffAudit() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.listStaffEntryAudit().then(setRows).catch((e) => setError(e.message ?? "Could not load the audit."));
  }, []);

  if (error) return <Card style={{ padding: 16 }}><div style={{ color: "var(--clay-700, #9a3412)" }}>{error}</div></Card>;
  if (rows.length === 0) return <Card style={{ padding: 16 }}>No staff-entered check-ins yet.</Card>;

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", background: "var(--paper-100)" }}>
            <th style={{ padding: "10px 14px" }}>When</th>
            <th style={{ padding: "10px 14px" }}>Business</th>
            <th style={{ padding: "10px 14px" }}>Patron</th>
            <th style={{ padding: "10px 14px" }}>Staff session</th>
            <th style={{ padding: "10px 14px" }}>Flag</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.stamp_id} style={{ borderTop: "1px solid var(--ink-100)" }}>
              <td style={{ padding: "10px 14px" }}>{new Date(r.at).toLocaleString()}</td>
              <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 11 }}>{r.business_id}</td>
              <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 11 }}>{r.patron_ref}</td>
              <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 11 }}>{r.staff_session}</td>
              <td style={{ padding: "10px 14px" }}>
                {r.flagged_anomaly ? <Badge variant="clay">Anomaly</Badge> : <span style={{ color: "var(--ink-500)" }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ---- Shell -------------------------------------------------

const TITLES = {
  approvals: ["Approvals", "Onboarding queue"],
  picks: ["Founding picks", "Discovery curation"],
  rotation: ["Code rotation", "Trust & reprints"],
  gates: ["Gate dashboard", "Pre-registered experiment"],
  audit: ["Staff entry audit", "Anomaly review"],
};

export default function AdminApp({ onSignOut }) {
  const [view, setView] = useState("approvals");
  const [title, subtitle] = TITLES[view];

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--paper-50)" }}>
      <Sidebar view={view} onChange={setView} onSignOut={onSignOut} />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar title={title} subtitle={subtitle} />
        <div style={{ padding: 28, overflowY: "auto" }}>
          {view === "approvals" ? <Approvals /> : null}
          {view === "picks" ? <Picks /> : null}
          {view === "rotation" ? <Rotation /> : null}
          {view === "gates" ? <Gates /> : null}
          {view === "audit" ? <StaffAudit /> : null}
        </div>
      </main>
    </div>
  );
}
