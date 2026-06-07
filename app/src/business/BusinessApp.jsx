// ============================================================
// Good Local — Business owner dashboard (production adaptation)
// Adapted from design/ui_kits/business/BusinessApp.jsx — the design
// system at ../design is the visual source of truth.
// Changes from the kit: ES module imports, data moved to the
// mock data layer (../data.js), default export. Visuals unchanged.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  Button, IconButton, Card, Badge, Tag, Icon,
  Field, Input, Textarea, Switch, Select, Tabs, Stat, Notice, Row, Divider,
  Stamp, StampGrid, WalletPass, ProgressMeter, SealMark,
} from "../ds.js";
import OwnerSignIn from "./OwnerSignIn.jsx";
import * as api from "../lib/api.js";
import { supabase } from "../lib/auth.js";
import { useBusiness } from "./useBusiness.js";
import RegisterKit from "./RegisterKit.jsx";

// ---- Dashboard data hook (T052; real-only since T064) ------
// Reads the owner's real aggregates via api.getDashboard. The app shell
// guarantees an owner session before any view renders.
function useDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const real = await api.getDashboard();
      setData(real);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { data, loading, reload: load };
}

// Map the design-system perk-kind option values to the contract enum.
const KIND_TO_ENUM = { status: "status_good", "off-peak": "off_peak_treat", discount: "small_discount" };

// ---- Sidebar -----------------------------------------------

function Sidebar({ view, onChange, business }) {
  const loggedOut = !business?.id;
  const items = [
    { id: "dashboard", label: "This week",  icon: "trending-up" },
    { id: "perks",     label: "Perks",      icon: "stamp" },
    { id: "regulars",  label: "Regulars",   icon: "users" },
    { id: "qrkit",     label: "QR kit",     icon: "qr" },
    { id: "settings",  label: "Settings",   icon: "settings" },
  ];
  return (
    <aside style={{
      width: 240, padding: "20px 14px",
      background: "var(--paper-100)",
      borderRight: "1px solid var(--ink-100)",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px 10px" }}>
        <div style={{ color: "var(--pine-700)" }}><SealMark size={36}/></div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, lineHeight: 1 }}>Good Local</span>
          <span style={{ fontSize: 11, color: "var(--ink-500)", letterSpacing: 0.04 }}>Business</span>
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
        <div className="gl-eyebrow">Your plan</div>
        <div style={{ fontWeight: 600, marginTop: 4 }}>Founding · $79/mo</div>
        <div style={{ fontSize: 12, color: "var(--ink-700)", marginTop: 4, lineHeight: 1.4 }}>
          Founding rate locked. Winter tier opens Nov 1.
        </div>
        {loggedOut ? (
          <a href="/business/signup" style={{
            display: "block", marginTop: 10, fontSize: 12, fontWeight: 600,
            color: "var(--pine-700)", textDecoration: "underline",
          }}>
            Not a member yet? Start your program
          </a>
        ) : null}
      </Card>
    </aside>
  );
}

// ---- Topbar -------------------------------------------------

function TopBar({ onNewPerk, business }) {
  return (
    <div style={{
      padding: "18px 28px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      borderBottom: "1px solid var(--ink-100)", background: "var(--paper-50)",
    }}>
      <div>
        <div className="gl-eyebrow">{business?.town ?? ""}</div>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600,
          letterSpacing: "-0.012em", lineHeight: 1.1, marginTop: 2,
        }}>
          {business?.name ?? ""}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {business?.hours ? <Badge variant="pine">{business.hours}</Badge> : null}
        <Button leadingIcon={<Icon name="plus" size={18}/>} onClick={onNewPerk}>New perk</Button>
        <IconButton bordered label="Notifications"><Icon name="bell" size={18}/></IconButton>
        <div style={{
          width: 36, height: 36, borderRadius: 999, background: "var(--ochre-300)",
          display: "grid", placeItems: "center", fontWeight: 700, color: "var(--ochre-900)",
        }}>ME</div>
      </div>
    </div>
  );
}

// ---- Dashboard view ----------------------------------------

// Format a delta integer into a plain owner-voice suffix ("+6 this week" /
// "-2 this week" / "steady").
function deltaLabel(n) {
  if (n == null || n === 0) return "steady";
  return `${n > 0 ? "+" : "−"}${Math.abs(n)} this week`;
}

// Short clock label from an ISO timestamp.
function clockLabel(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

const EVENT_COPY = {
  stamp: { title: "checked in", tone: undefined },
  staff_stamp: { title: "checked in (entered by staff)", tone: undefined },
  redemption: { title: "redeemed a perk", tone: "pine" },
};

function Dashboard({ business }) {
  const { data, reload } = useDashboard();
  const code = business?.code ?? "";

  if (!data) {
    return (
      <div style={{ padding: 28 }}>
        <Card style={{ padding: 22 }}>
          <div className="gl-eyebrow" style={{ color: "var(--pine-700)" }}>This week</div>
          <div style={{ marginTop: 8, color: "var(--ink-500)" }}>Sign in to see your dashboard.</div>
        </Card>
      </div>
    );
  }

  const h = data.headline ?? {};
  const deltas = h.deltas ?? {};

  async function share() {
    const email = window.prompt("Email the weekly note to a co-owner:");
    if (!email) return;
    try {
      await api.shareWeeklyNote({ email: email.trim() });
      window.alert("Sent. Your co-owner will get this week's note.");
    } catch (err) {
      window.alert(err?.code === "VALIDATION"
        ? "That email doesn't look right. Try again."
        : err?.message ?? "Could not share the note.");
    }
  }

  return (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Plain-language hero summary */}
      <Card style={{ padding: 22 }}>
        <div className="gl-eyebrow" style={{ color: "var(--pine-700)" }}>Your weekly note</div>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 500,
          letterSpacing: "-0.012em", lineHeight: 1.25, marginTop: 8, color: "var(--ink-1000)",
          maxWidth: 720,
        }}>
          {data.weekly_note}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <Button variant="ghost" size="sm" onClick={share}>Share with co-owner</Button>
        </div>
      </Card>

      {/* Ready to redeem (T038): perk-ready patrons with a single-confirm Redeem */}
      <ReadyToRedeem items={data.ready_redemptions ?? []} onRedeemed={reload}/>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <Card style={{ padding: 18 }}>
          <Stat label="Repeat-visit rate" value={Math.round((h.repeat_visit_rate ?? 0) * 100)} suffix="%" />
        </Card>
        <Card style={{ padding: 18 }}>
          <Stat label="Verified regulars" value={h.verified_regulars ?? 0}
                delta={deltaLabel(deltas.verified_regulars)}
                deltaDirection={(deltas.verified_regulars ?? 0) >= 0 ? "up" : "down"}/>
        </Card>
        <Card style={{ padding: 18 }}>
          <Stat label="New patrons" value={h.new_patrons ?? 0} delta={deltaLabel(deltas.new_patrons)}
                deltaDirection={(deltas.new_patrons ?? 0) >= 0 ? "up" : "down"}/>
        </Card>
        <Card style={{ padding: 18 }}>
          <Stat label="Perk redemptions" value={h.redemptions ?? 0} delta={deltaLabel(deltas.redemptions)}
                deltaDirection={(deltas.redemptions ?? 0) >= 0 ? "up" : "down"}/>
        </Card>
      </div>

      {/* Two-column: perk performance + visit pattern */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <Card style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <div>
              <div className="gl-eyebrow">Perk performance</div>
              <div style={{ fontWeight: 600, fontSize: 17, marginTop: 4 }}>What&apos;s working this season</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {(data.perk_performance ?? []).map((p, i) => (
              <div key={p.perk_id ?? i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-500)" }}>{p.read}</div>
                </div>
                <div style={{ width: 220 }}>
                  <ProgressMeter
                    count={p.redemptions} total={Math.max(p.eligible, p.redemptions, 1)}
                    tone={i === 0 ? "pine" : "ochre"}
                    remainingLabel={`${p.redemptions} of ${p.eligible} eligible`}
                  />
                </div>
              </div>
            ))}
            {(data.perk_performance ?? []).length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--ink-500)" }}>No active perks yet.</div>
            ) : null}
          </div>
        </Card>

        <Card style={{ padding: 20 }}>
          <div className="gl-eyebrow">Visit pattern · last 14 days</div>
          <VisitChart series={data.visit_pattern_14d ?? []}/>
        </Card>
      </div>

      {/* Recent activity */}
      <Card style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div className="gl-eyebrow">Recent activity</div>
            <div style={{ fontWeight: 600, fontSize: 17, marginTop: 4 }}>Stamps + redemptions</div>
          </div>
          <Tag variant="pine">{(data.activity_feed ?? []).length} events</Tag>
        </div>
        <Divider style={{ margin: 0 }}/>
        {(data.activity_feed ?? []).map((e, i) => {
          const copy = EVENT_COPY[e.event] ?? EVENT_COPY.stamp;
          const avatar = e.event === "redemption"
            ? <div style={{ width:44, height:44, borderRadius:999, background:"var(--pine-100)", color:"var(--pine-700)", display:"grid", placeItems:"center" }}><Icon name="check" size={20}/></div>
            : <Stamp state="earned" label={code} size={44} rotate={(i % 3) - 1}/>;
          return (
            <Row
              key={i}
              avatar={avatar}
              title={`${e.patron_display} ${copy.title}`}
              trailing={<Tag variant={copy.tone}>{clockLabel(e.at)}</Tag>}
            />
          );
        })}
        {(data.activity_feed ?? []).length === 0 ? (
          <Row title="No activity yet this week." />
        ) : null}
      </Card>
    </div>
  );
}

// ---- Ready to redeem (T038) ---------------------------------
// Perk-ready patrons surfaced from get_dashboard.ready_redemptions[]. Each has a
// single-confirm Redeem action wired to api.redeemPerk, with optimistic removal
// and code-keyed error copy (contract §7).
function ReadyToRedeem({ items, onRedeemed }) {
  const [pending, setPending] = useState({}); // id -> "busy" | "done"
  const [removed, setRemoved] = useState({}); // optimistic hide
  const visible = items.filter((it) => !removed[`${it.patron_ref}:${it.perk_id}`]);
  if (visible.length === 0) return null;

  async function redeem(it) {
    const key = `${it.patron_ref}:${it.perk_id}`;
    if (!window.confirm(`Redeem ${it.perk_name} for ${it.patron_display}?`)) return;
    setPending((p) => ({ ...p, [key]: "busy" }));
    setRemoved((r) => ({ ...r, [key]: true })); // optimistic
    try {
      await api.redeemPerk({ patronRef: it.patron_ref, perkId: it.perk_id });
      onRedeemed && (await onRedeemed());
    } catch (err) {
      // Roll back the optimistic removal and surface code-keyed copy.
      setRemoved((r) => ({ ...r, [key]: false }));
      const msg = err?.code === "PERK_NOT_READY"
        ? "That patron isn't ready for this perk anymore."
        : err?.code === "PERK_NOT_FOUND"
          ? "That perk is no longer available."
          : err?.message ?? "Could not record the redemption.";
      window.alert(msg);
    } finally {
      setPending((p) => ({ ...p, [key]: "done" }));
    }
  }

  return (
    <Card style={{ padding: 0 }}>
      <div style={{ padding: "16px 20px" }}>
        <div className="gl-eyebrow" style={{ color: "var(--pine-700)" }}>Ready to redeem</div>
        <div style={{ fontWeight: 600, fontSize: 17, marginTop: 4 }}>Verify at the register</div>
      </div>
      <Divider style={{ margin: 0 }}/>
      {visible.map((it) => {
        const key = `${it.patron_ref}:${it.perk_id}`;
        return (
          <Row
            key={key}
            title={`${it.patron_display} — ${it.perk_name}`}
            sub="At or above the visit threshold."
            trailing={
              <Button size="sm" onClick={() => redeem(it)} disabled={pending[key] === "busy"}>
                {pending[key] === "busy" ? "Redeeming…" : "Redeem"}
              </Button>
            }
          />
        );
      })}
    </Card>
  );
}

function VisitChart({ series }) {
  // Bar chart of the 14-day series from get_dashboard. Pine bars; today (last)
  // highlighted in ochre. Weekday letters derived from each date.
  const days = (series ?? []).map((d) => d.stamps ?? 0);
  const labels = (series ?? []).map((d) => {
    try { return "SMTWTFS"[new Date(`${d.date}T00:00:00`).getDay()]; } catch { return ""; }
  });
  const max = Math.max(1, ...days);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140, marginTop: 12 }}>
      {days.map((d, i) => {
        const isToday = i === days.length - 1;
        return (
          <div key={i} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
            <div title={`${d} stamps`} style={{
              width: "100%", height: `${Math.round((d / max) * 110)}px`,
              background: isToday ? "var(--ochre-500)" : "var(--pine-700)",
              borderRadius: 3,
            }}/>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-500)" }}>{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---- Perks view + builder -----------------------------------

function PerksView({ onNewPerk, openBuilder, onCloseBuilder, business, onChanged }) {
  const perks = business?.perks ?? PERKS;
  const [busyId, setBusyId] = useState(null);

  async function toggleActive(perk) {
    if (!perk.id) return; // mock fallback — no backend id
    setBusyId(perk.id);
    try {
      await api.setPerkActive({ perkId: perk.id, active: !perk.active });
      onChanged && (await onChanged());
    } catch (err) {
      window.alert(err?.message ?? "Could not update the perk.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div className="gl-eyebrow">Your perks</div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600,
            letterSpacing: "-0.012em", marginTop: 4,
          }}>What you offer your regulars</div>
        </div>
        <Button leadingIcon={<Icon name="plus" size={18}/>} onClick={onNewPerk}>New perk</Button>
      </div>

      <Notice tone="ochre" icon={<Icon name="info" size={18}/>} title="Perk design tip">
        Best perks are <em>low-marginal-cost</em>, <em>visit-shaped</em>, <em>off-peak</em>, and <em>status goods</em> — never peak-day discounts. (Cannibalization runs 30–50% when unmanaged.)
      </Notice>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {perks.map((p) => (
          <Card key={p.id ?? p.name} style={{ padding: 20, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  {p.active ? <Badge variant="pine">Active</Badge> : <Badge>Off</Badge>}
                  <Tag>{p.threshold} visits</Tag>
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-700)", marginTop: 2 }}>{p.description}</div>
              </div>
              <Switch
                checked={!!p.active}
                onChange={() => toggleActive(p)}
                label={p.active ? "Deactivate perk" : "Activate perk"}
                disabled={!p.id || busyId === p.id}
              />
            </div>
            {p.active && p.eligible ? (
              <>
                <div style={{ marginTop: 14 }}>
                  <ProgressMeter
                    count={p.redemptions} total={p.eligible}
                    label="Redeemed this season"
                    remainingLabel={`${p.redemptions} of ${p.eligible} eligible patrons`}
                    size="sm"
                  />
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 10, lineHeight: 1.4 }}>
                  {p.note}
                </div>
              </>
            ) : (
              <div style={{ marginTop: 14, fontSize: 13, color: "var(--ink-500)", lineHeight: 1.4 }}>
                {p.note}
              </div>
            )}
          </Card>
        ))}
      </div>

      {openBuilder ? <PerkBuilder onClose={onCloseBuilder} business={business} onChanged={onChanged}/> : null}
    </div>
  );
}

function PerkBuilder({ onClose, business, onChanged }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [threshold, setThreshold] = useState(5);
  const [kind, setKind] = useState("status");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function publish() {
    setError(null);
    if (!business?.id) {
      // No backend business (mock/demo) — just close, keeping visuals intact.
      onClose();
      return;
    }
    setBusy(true);
    try {
      await api.publishPerk({
        businessId: business.id,
        name: name.trim(),
        description: desc.trim(),
        threshold,
        kind: KIND_TO_ENUM[kind] ?? "status_good",
      });
      onChanged && (await onChanged());
      onClose();
    } catch (err) {
      setError(err?.code === "VALIDATION"
        ? "Check the name (≤60), one-line description (≤120), and 3–12 visits."
        : err?.message ?? "Could not publish the perk.");
      setBusy(false);
    }
  }

  const kinds = [
    { value: "status", label: "Status good", hint: "Something only regulars get — a seat, a shelf, a heads-up." },
    { value: "off-peak", label: "Off-peak treat", hint: "Drives quiet hours — Tuesday afternoon, January weeknights." },
    { value: "discount", label: "Small discount", hint: "Sparingly — never peak days, never your bestseller." },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(26,22,18,0.55)",
      display: "grid", placeItems: "center", zIndex: 50,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 720, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto",
        background: "var(--paper-50)", borderRadius: 16, boxShadow: "var(--shadow-lift)",
      }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--ink-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="gl-eyebrow">Perk builder · 2 minutes</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, marginTop: 4, letterSpacing: "-0.012em" }}>
              Design a perk
            </div>
          </div>
          <IconButton bordered label="Close" onClick={onClose}><Icon name="x" size={18}/></IconButton>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 0 }}>
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, borderRight: "1px solid var(--ink-100)" }}>
            <Field label="Perk name" hint="What you'd say at the register.">
              <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="The Regular's Pour"/>
            </Field>
            <Field label="One-line description" hint="What the patron sees on their wallet pass.">
              <Textarea value={desc} onChange={(e)=>setDesc(e.target.value)} placeholder="Two more visits, on the house"/>
            </Field>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label className="gl-field__label">Earn after</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="range" min="3" max="12" value={threshold} onChange={(e)=>setThreshold(+e.target.value)} style={{ flex: 1 }}/>
                <div style={{ width: 80, padding: "8px 12px", borderRadius: 8, background: "var(--paper-100)", textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                  {threshold} visits
                </div>
              </div>
              <span className="gl-field__hint">Most owners land at 5. Lower = easier to earn; higher = more meaningful.</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label className="gl-field__label">Perk kind</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {kinds.map(k => (
                  <button key={k.value} type="button" onClick={() => setKind(k.value)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                      padding: "10px 12px", border: kind === k.value ? "2px solid var(--pine-700)" : "1.5px solid var(--ink-200)",
                      borderRadius: 8, background: kind === k.value ? "var(--pine-50)" : "var(--white)",
                      textAlign: "left", cursor: "pointer", color: "var(--ink-1000)",
                    }}>
                    <strong style={{ fontSize: 14 }}>{k.label}</strong>
                    <span style={{ fontSize: 12, color: "var(--ink-500)" }}>{k.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ padding: 24, background: "var(--paper-100)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="gl-eyebrow">Preview · patron pass</div>
            <div style={{ display: "grid", placeItems: "center", transform: "scale(0.78)", transformOrigin: "top center", marginBottom: -90 }}>
              <WalletPass
                businessName={business?.name ?? "Your business"}
                region={business?.town ?? ""}
                count={threshold - 2} total={threshold}
                perkLabel={name || "Your perk name"}
                perkSub={desc || "What the patron sees"}
                stampCode={business?.code ?? ""}
              />
            </div>
            <div style={{ marginTop: 100 }}>
              <Notice tone="ochre" icon={<Icon name="info" size={18}/>}>
                Patrons see this immediately the next time they check in. Existing stamps carry over.
              </Notice>
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--ink-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: error ? "var(--ochre-900)" : "var(--ink-500)" }}>
            {error ?? "This perk costs you nothing until a patron earns it."}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={publish} disabled={busy}>{busy ? "Publishing…" : "Publish perk"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Regulars view (T064: real data via contract §3.10) ------

const TREND_LABEL = { new: "NEW THIS SEASON", up: "TRENDING UP", steady: "STEADY" };

function initialsFor(name) {
  if (!name) return null;
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function RegularsView() {
  const [view, setView] = useState("All");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getBusinessRegulars()
      .then((data) => { if (!cancelled) setRows(data ?? []); })
      .catch((err) => { if (!cancelled) { setError(err); setRows([]); } });
    return () => { cancelled = true; };
  }, []);

  const all = rows ?? [];
  const shown =
    view === "New" ? all.filter((r) => r.trend === "new")
    : view === "Trending" ? all.filter((r) => r.trend === "up")
    : all;

  return (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div className="gl-eyebrow">Verified regulars · this season</div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600,
            letterSpacing: "-0.012em", marginTop: 4,
          }}>
            {rows === null ? "Loading…" : `${all.length} ${all.length === 1 ? "person" : "people"}, coming back`}
          </div>
        </div>
        <Tabs tabs={["All", "New", "Trending"]} value={view} onChange={setView}/>
      </div>

      <Notice tone="river" icon={<Icon name="info" size={18}/>} title="Your privacy promise">
        You see how often, not who else they visit. Patron history across other businesses stays with the patron.
      </Notice>

      {error ? (
        <Notice tone="ochre" title="Could not load your regulars">Try again in a moment.</Notice>
      ) : null}

      {rows !== null && all.length === 0 && !error ? (
        <Card style={{ padding: 24, textAlign: "center", color: "var(--ink-700)", fontSize: 14, lineHeight: 1.6 }}>
          Nobody has stamped in yet. Your first regular starts with a first visit —
          the QR kit by the register does the rest.
        </Card>
      ) : null}

      {all.length > 0 ? (
        <Card style={{ padding: 0 }}>
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 110px 110px 110px",
            padding: "12px 20px", borderBottom: "1px solid var(--ink-200)",
            fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.1em", color: "var(--ink-500)",
          }}>
            <span>Patron</span>
            <span style={{ textAlign: "right" }}>Visits</span>
            <span style={{ textAlign: "right" }}>Since</span>
            <span style={{ textAlign: "right" }}>Last visit</span>
          </div>
          {shown.map((r) => {
            const initials = initialsFor(r.display_name);
            return (
              <div key={r.patron_ref} style={{
                display: "grid", gridTemplateColumns: "2fr 110px 110px 110px",
                padding: "14px 20px", borderBottom: "1px solid var(--ink-100)",
                alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 999, background: "var(--paper-300)",
                    color: "var(--ink-1000)", display: "grid", placeItems: "center",
                    fontWeight: 700, fontSize: 13,
                  }} aria-hidden="true">
                    {initials ?? <Icon name="stamp" size={16}/>}
                  </div>
                  <div>
                    {/* display_name may be null for anonymous patrons — honest fallback, never invented */}
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.display_name ?? "Passport patron"}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-500)", fontFamily: "var(--font-mono)" }}>
                      {TREND_LABEL[r.trend] ?? "STEADY"}
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 14, textAlign: "right" }}>{r.visits}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-500)", textAlign: "right" }}>{r.since}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-500)", textAlign: "right" }}>{r.last_visit}</div>
              </div>
            );
          })}
        </Card>
      ) : null}
    </div>
  );
}

// ---- Register kit ── now its own component (T023): app/src/business/RegisterKit.jsx

// ---- Settings view ------------------------------------------

// Winter tier is selectable only Nov 1 – Apr 30, America/New_York (FR-003).
function inWinterWindow(now = new Date()) {
  const m = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "numeric" })
      .formatToParts(now).find((p) => p.type === "month").value,
  );
  return m >= 11 || m <= 4;
}

function SettingsView({ business, onChanged }) {
  const b = business ?? { ...BUSINESS, id: null };
  const [name, setName] = useState(b.name ?? "");
  const [code, setCode] = useState(b.code ?? "");
  const [ownerNote, setOwnerNote] = useState(b.ownerNote ?? "");
  const [hours, setHours] = useState(b.hours ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  async function save() {
    setNotice(null);
    if (!b.id) { setNotice({ tone: "ochre", text: "Sign in to save changes." }); return; }
    setBusy(true);
    try {
      await api.updateBusinessProfile({
        businessId: b.id,
        name: name.trim() || undefined,
        ownerNote: ownerNote.trim() || undefined,
        hours: hours.trim() || undefined,
        stampCode: code.trim() || undefined,
      });
      onChanged && (await onChanged());
      setNotice({ tone: "pine", text: "Saved." });
    } catch (err) {
      const msg = err?.code === "STAMP_CODE_TAKEN"
        ? "That stamp code is taken in your region. Try another."
        : err?.code === "VALIDATION"
          ? "Check your entries: code is 3–4 letters; hours ≤120; note ≤280."
          : err?.message ?? "Could not save.";
      setNotice({ tone: "ochre", text: msg });
    } finally {
      setBusy(false);
    }
  }

  async function switchWinter() {
    setNotice(null);
    if (!inWinterWindow()) {
      setNotice({ tone: "ochre", text: "Winter tier opens Nov 1 and runs through Apr 30." });
      return;
    }
    try {
      await api.switchWinterTier();
      setNotice({ tone: "pine", text: "Winter tier requested. Your founding rate stays locked." });
    } catch (err) {
      const msg = err?.code === "OUTSIDE_WINTER_WINDOW"
        ? "Winter tier opens Nov 1 and runs through Apr 30."
        : err?.message ?? "Could not switch tiers.";
      setNotice({ tone: "ochre", text: msg });
    }
  }

  return (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <div>
        <div className="gl-eyebrow">Settings</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.012em", marginTop: 4 }}>
          Account & business
        </div>
      </div>

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <Card>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Business profile</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Business name"><Input value={name} onChange={(e) => setName(e.target.value)}/></Field>
          <Field label="Hours" hint="Shown to patrons."><Input value={hours} onChange={(e) => setHours(e.target.value)}/></Field>
          <Field label="Owner note" hint="A line patrons see on your page."><Input value={ownerNote} onChange={(e) => setOwnerNote(e.target.value)}/></Field>
          <Field label="Business code (3–4 letters)" hint="Shown on patron stamps."><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}/></Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
        </div>
      </Card>

      <Card>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Plan</h3>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
          <div>
            <div style={{ fontWeight: 600 }}>Founding · $79/mo</div>
            <div style={{ fontSize: 13, color: "var(--ink-500)" }}>Founding rate locked. Winter tier opens Nov 1.</div>
          </div>
          <Button variant="secondary" size="sm" onClick={switchWinter}>Switch to winter tier ($49/mo)</Button>
        </div>
      </Card>

      <Card>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Privacy</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Row title="Show repeat-visit counts on your dashboard" sub="Aggregate, not individual history."
               trailing={<Switch checked={true} onChange={()=>{}} label="Toggle"/>}/>
          <Row title="Appear in regional discovery" sub="Verified-regulars ranking + town map."
               trailing={<Switch checked={true} onChange={()=>{}} label="Toggle"/>}/>
          <Row title="Share weekly note with your co-owner" sub="dan@theheron.co"
               trailing={<Switch checked={false} onChange={()=>{}} label="Toggle"/>}/>
        </div>
      </Card>
    </div>
  );
}

// ---- App shell ----------------------------------------------

function BusinessApp() {
  const [view, setView] = useState("dashboard");
  const [builderOpen, setBuilderOpen] = useState(false);
  const { business, loading, needsAuth, reload } = useBusiness();

  // T064 gates: no session -> sign in; session without a business -> signup path.
  if (needsAuth) return <OwnerSignIn onSignedIn={reload}/>;
  if (loading) {
    return (
      <div style={{ minHeight: "100%", display: "grid", placeItems: "center", color: "var(--ink-500)", fontSize: 14 }}>
        Loading your program…
      </div>
    );
  }
  if (!business) {
    return (
      <div style={{ minHeight: "100%", display: "grid", placeItems: "center", padding: 24 }}>
        <Card style={{ padding: 28, width: 460, maxWidth: "92vw", textAlign: "center" }}>
          <div className="gl-eyebrow">Good Local · Business</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, margin: "6px 0 10px" }}>
            No program on this account yet.
          </div>
          <div style={{ color: "var(--ink-700)", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
            Set up your rewards program — profile, first perk, printable register
            kit — and be live the same day.
          </div>
          <Button onClick={() => { window.location.href = "/business/signup"; }}>Set up your program</Button>
        </Card>
      </div>
    );
  }

  let body;
  if (view === "dashboard") body = <Dashboard business={business}/>;
  else if (view === "perks") body = <PerksView onNewPerk={()=>setBuilderOpen(true)} openBuilder={builderOpen} onCloseBuilder={()=>setBuilderOpen(false)} business={business} onChanged={reload}/>;
  else if (view === "regulars") body = <RegularsView/>;
  else if (view === "qrkit") body = <RegisterKit business={business}/>;
  else if (view === "settings") body = <SettingsView business={business} onChanged={reload}/>;

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--paper-50)" }}>
      <Sidebar view={view} onChange={setView} business={business}/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar business={business} onNewPerk={() => { setView("perks"); setBuilderOpen(true); }}/>
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>{body}</div>
      </div>
    </div>
  );
}

export default BusinessApp;
