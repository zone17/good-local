// ============================================================
// Good Local — Business owner dashboard (production adaptation)
// Adapted from design/ui_kits/business/BusinessApp.jsx — the design
// system at ../design is the visual source of truth.
// Changes from the kit: ES module imports, data moved to the
// mock data layer (../data.js), default export. Visuals unchanged.
// ============================================================
import React, { useState } from "react";
import {
  Button, IconButton, Card, Badge, Tag, Icon,
  Field, Input, Textarea, Switch, Select, Tabs, Stat, Notice, Row, Divider,
  Stamp, StampGrid, WalletPass, ProgressMeter, SealMark,
} from "../ds.js";
import { BUSINESS, WEEK, PERKS, REGULARS } from "../data.js";

// ---- Sidebar -----------------------------------------------

function Sidebar({ view, onChange }) {
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
        <div style={{ fontWeight: 600, marginTop: 4 }}>{BUSINESS.plan}</div>
        <div style={{ fontSize: 12, color: "var(--ink-700)", marginTop: 4, lineHeight: 1.4 }}>
          Founding rate locked through 2027. Winter tier opens Nov 1.
        </div>
      </Card>
    </aside>
  );
}

// ---- Topbar -------------------------------------------------

function TopBar({ onNewPerk }) {
  return (
    <div style={{
      padding: "18px 28px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      borderBottom: "1px solid var(--ink-100)", background: "var(--paper-50)",
    }}>
      <div>
        <div className="gl-eyebrow">{BUSINESS.town}</div>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600,
          letterSpacing: "-0.012em", lineHeight: 1.1, marginTop: 2,
        }}>
          {BUSINESS.name}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Badge variant="pine">{BUSINESS.hours}</Badge>
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

function Dashboard() {
  return (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Plain-language hero summary */}
      <Card style={{ padding: 22 }}>
        <div className="gl-eyebrow" style={{ color: "var(--pine-700)" }}>Mira&apos;s weekly note · June 14</div>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 500,
          letterSpacing: "-0.012em", lineHeight: 1.25, marginTop: 8, color: "var(--ink-1000)",
          maxWidth: 720,
        }}>
          28 regulars came in last week, up 6. Your free-pour perk was redeemed 9 times — your highest yet. The
          NYC weekenders are the ones returning; 12 of the new patrons came in from Saturday alone.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <Button variant="secondary" size="sm">Save as note</Button>
          <Button variant="ghost" size="sm">Share with co-owner</Button>
        </div>
      </Card>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <Card style={{ padding: 18 }}>
          <Stat label="Repeat-visit rate" value={WEEK.repeatRate} suffix="%" delta={WEEK.repeatRateDelta + " this week"} deltaDirection="up"/>
        </Card>
        <Card style={{ padding: 18 }}>
          <Stat label="Verified regulars" value={WEEK.regulars} delta={WEEK.regularsDelta + " this week"} deltaDirection="up"/>
        </Card>
        <Card style={{ padding: 18 }}>
          <Stat label="New patrons" value={WEEK.newPatrons} delta="from 14 sources" />
        </Card>
        <Card style={{ padding: 18 }}>
          <Stat label="Perk redemptions" value={WEEK.perkRedemptions} delta={WEEK.perkRedemptionsDelta + " this week"} deltaDirection="up"/>
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
            <Button variant="ghost" size="sm">All perks →</Button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {PERKS.filter(p => p.active).map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-500)" }}>{p.description}</div>
                </div>
                <div style={{ width: 220 }}>
                  <ProgressMeter
                    count={p.redemptions} total={p.eligible}
                    tone={p.id === "regulars-pour" ? "pine" : "ochre"}
                    remainingLabel={`${p.redemptions} of ${p.eligible} eligible`}
                  />
                </div>
              </div>
            ))}
          </div>
          <Divider dashed/>
          <div style={{ fontSize: 13, color: "var(--ink-700)" }}>
            Note: the regular&apos;s pour is your highest-redemption perk to date. Consider keeping it through fall.
          </div>
        </Card>

        <Card style={{ padding: 20 }}>
          <div className="gl-eyebrow">Visit pattern · last 14 days</div>
          <VisitChart/>
          <div style={{ fontSize: 13, color: "var(--ink-700)", marginTop: 12 }}>
            Tuesdays are quietest. The free-pour was redeemed 4× on a Tuesday — try a Tuesday-only perk next.
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <Card style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div className="gl-eyebrow">Recent activity</div>
            <div style={{ fontWeight: 600, fontSize: 17, marginTop: 4 }}>Stamps + redemptions today</div>
          </div>
          <Tag variant="pine">Today · 14 events</Tag>
        </div>
        <Divider style={{ margin: 0 }}/>
        <Row
          avatar={<Stamp state="earned" label="HRN" date="06·14" size={44} rotate={-3}/>}
          title="Maya R. earned her 5th stamp" sub="Eligible for The Regular's Pour"
          trailing={<Tag>4:12 PM</Tag>}
        />
        <Row
          avatar={<div style={{ width:44, height:44, borderRadius:999, background:"var(--pine-100)", color:"var(--pine-700)", display:"grid", placeItems:"center" }}><Icon name="check" size={20}/></div>}
          title="The Regular's Pour redeemed by Alex T." sub="Visit #6"
          trailing={<Tag variant="pine">2:48 PM</Tag>}
        />
        <Row
          avatar={<Stamp state="earned" label="HRN" date="06·14" size={44} rotate={2}/>}
          title="Jess L. checked in for the first time" sub="From a verified regular's tip"
          trailing={<Tag>1:20 PM</Tag>}
        />
        <Row
          avatar={<Stamp state="earned" label="HRN" date="06·14" size={44} rotate={-2}/>}
          title="Dan H. earned his 4th stamp"
          trailing={<Tag>11:09 AM</Tag>}
        />
      </Card>
    </div>
  );
}

function VisitChart() {
  // Simple bar chart of last 14 days. Pine bars, ochre highlights for Saturdays.
  const days = [12, 14, 8, 10, 16, 24, 31, 14, 17, 9, 12, 19, 26, 33];
  const labels = ["M","T","W","T","F","S","S","M","T","W","T","F","S","S"];
  const max = Math.max(...days);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140, marginTop: 12 }}>
      {days.map((d, i) => {
        const isSat = i === 5 || i === 12;
        const isToday = i === 13;
        return (
          <div key={i} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
            <div title={`${d} stamps`} style={{
              width: "100%", height: `${Math.round((d / max) * 110)}px`,
              background: isToday ? "var(--ochre-500)" : isSat ? "var(--ochre-300)" : "var(--pine-700)",
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

function PerksView({ onNewPerk, openBuilder, onCloseBuilder }) {
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
        {PERKS.map((p) => (
          <Card key={p.id} style={{ padding: 20, position: "relative" }}>
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
              <IconButton label="Edit"><Icon name="edit" size={18}/></IconButton>
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

      {openBuilder ? <PerkBuilder onClose={onCloseBuilder}/> : null}
    </div>
  );
}

function PerkBuilder({ onClose }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [threshold, setThreshold] = useState(5);
  const [kind, setKind] = useState("status");

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
                businessName={BUSINESS.name}
                region={BUSINESS.town}
                count={threshold - 2} total={threshold}
                perkLabel={name || "Your perk name"}
                perkSub={desc || "What the patron sees"}
                stampCode={BUSINESS.code}
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
          <span style={{ fontSize: 12, color: "var(--ink-500)" }}>This perk costs you nothing until a patron earns it.</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" onClick={onClose}>Save as draft</Button>
            <Button onClick={onClose}>Publish perk</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Regulars view ------------------------------------------

function RegularsView() {
  const [view, setView] = useState("All");
  return (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div className="gl-eyebrow">Verified regulars · this season</div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600,
            letterSpacing: "-0.012em", marginTop: 4,
          }}>{REGULARS.length} people, coming back</div>
        </div>
        <Tabs tabs={["All", "New", "Slipping"]} value={view} onChange={setView}/>
      </div>

      <Notice tone="river" icon={<Icon name="info" size={18}/>} title="Your privacy promise">
        You see how often, not who else they visit. Patron history across other businesses stays with the patron.
      </Notice>

      <Card style={{ padding: 0 }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.8fr 1fr 100px 100px 40px",
          padding: "12px 20px", borderBottom: "1px solid var(--ink-200)",
          fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.1em", color: "var(--ink-500)",
        }}>
          <span>Patron</span>
          <span>Background</span>
          <span style={{ textAlign: "right" }}>Visits</span>
          <span style={{ textAlign: "right" }}>Since</span>
          <span></span>
        </div>
        {REGULARS.map((r) => (
          <div key={r.initials} style={{
            display: "grid", gridTemplateColumns: "1.8fr 1fr 100px 100px 40px",
            padding: "14px 20px", borderBottom: "1px solid var(--ink-100)",
            alignItems: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 999, background: "var(--paper-300)",
                color: "var(--ink-1000)", display: "grid", placeItems: "center",
                fontWeight: 700, fontSize: 13,
              }}>{r.initials}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: "var(--ink-500)", fontFamily: "var(--font-mono)" }}>
                  {r.trend === "new" ? "NEW THIS SEASON" : r.trend === "up" ? "TRENDING UP" : "STEADY"}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-700)" }}>{r.town}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 14, textAlign: "right" }}>{r.visits}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-500)", textAlign: "right" }}>{r.since}</div>
            <div style={{ textAlign: "right", color: "var(--ink-300)" }}><Icon name="chevron-right" size={18}/></div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ---- QR kit (print preview) ---------------------------------

function QrKit() {
  return (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div className="gl-eyebrow">Register kit</div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600,
            letterSpacing: "-0.012em", marginTop: 4,
          }}>Print your QR card</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" leadingIcon={<Icon name="share" size={18}/>}>Mail me a printed copy</Button>
          <Button>Download PDF</Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card style={{ padding: 20 }}>
          <div className="gl-eyebrow" style={{ marginBottom: 10 }}>5×7 register card · kraft</div>
          <div style={{
            background: "var(--paper-300)", color: "var(--pine-1000)", borderRadius: 8,
            padding: "26px 22px", aspectRatio: "5/7", display: "flex", flexDirection: "column", justifyContent: "space-between",
          }}>
            <div style={{ textAlign: "center" }}>
              <div className="gl-eyebrow" style={{ color: "var(--pine-700)" }}>{BUSINESS.town}</div>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600,
                lineHeight: 1.05, marginTop: 4, letterSpacing: "-0.012em",
              }}>
                {BUSINESS.name}
              </div>
            </div>
            <div style={{ display: "grid", placeItems: "center" }}>
              <div style={{
                width: 180, height: 180, background: "var(--ink-1000)",
                display: "grid", placeItems: "center", borderRadius: 6,
              }}>
                <div style={{
                  width: 156, height: 156, background: "var(--paper-100)",
                  backgroundImage: `
                    radial-gradient(circle at 10% 10%, var(--ink-1000) 0 2.5%, transparent 2.5%),
                    radial-gradient(circle at 90% 10%, var(--ink-1000) 0 2.5%, transparent 2.5%),
                    radial-gradient(circle at 10% 90%, var(--ink-1000) 0 2.5%, transparent 2.5%),
                    repeating-linear-gradient(90deg, var(--ink-1000) 0 4px, transparent 4px 8px),
                    repeating-linear-gradient(0deg, var(--ink-1000) 0 4px, transparent 4px 8px)
                  `,
                  backgroundSize: "100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%",
                  imageRendering: "pixelated",
                }}/>
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
                Earn your first stamp.
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-700)", marginTop: 6, lineHeight: 1.4 }}>
                Hold your camera over the code. No app needed — adds to your wallet.
              </div>
              <div style={{ marginTop: 10, color: "var(--pine-700)", display: "grid", placeItems: "center" }}>
                <SealMark size={36}/>
              </div>
            </div>
          </div>
        </Card>
        <Card style={{ padding: 20 }}>
          <div className="gl-eyebrow">Tips</div>
          <ul style={{ marginTop: 10, paddingLeft: 18, color: "var(--ink-700)", lineHeight: 1.6, fontSize: 14 }}>
            <li>Print on kraft cardstock if you can — the brand expects it.</li>
            <li>Tape it to the side of the register where the hand naturally rests.</li>
            <li>Replace the kit if it gets wet or torn — your code rotates every 7 days for trust.</li>
            <li>For patrons who can&apos;t scan: ask their phone number and check them in from this screen.</li>
          </ul>
          <Divider dashed/>
          <Field label="Staff-entered check-in" hint="Send a one-time wallet link.">
            <Input type="tel" placeholder="(845) 555-0142"/>
          </Field>
          <Button block style={{ marginTop: 10 }}>Send link</Button>
        </Card>
      </div>
    </div>
  );
}

// ---- Settings view ------------------------------------------

function SettingsView() {
  return (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <div>
        <div className="gl-eyebrow">Settings</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.012em", marginTop: 4 }}>
          Account & business
        </div>
      </div>

      <Card>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Business profile</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Business name"><Input defaultValue={BUSINESS.name}/></Field>
          <Field label="Town"><Input defaultValue={BUSINESS.town}/></Field>
          <Field label="Owner name"><Input defaultValue={BUSINESS.ownerName}/></Field>
          <Field label="Business code (4-letter)" hint="Shown on patron stamps."><Input defaultValue={BUSINESS.code}/></Field>
        </div>
      </Card>

      <Card>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Plan</h3>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{BUSINESS.plan}</div>
            <div style={{ fontSize: 13, color: "var(--ink-500)" }}>Joined {BUSINESS.joined}.</div>
          </div>
          <Button variant="secondary" size="sm">Switch to winter tier ($49/mo)</Button>
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

  let body;
  if (view === "dashboard") body = <Dashboard/>;
  else if (view === "perks") body = <PerksView onNewPerk={()=>setBuilderOpen(true)} openBuilder={builderOpen} onCloseBuilder={()=>setBuilderOpen(false)}/>;
  else if (view === "regulars") body = <RegularsView/>;
  else if (view === "qrkit") body = <QrKit/>;
  else if (view === "settings") body = <SettingsView/>;

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--paper-50)" }}>
      <Sidebar view={view} onChange={setView}/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar onNewPerk={() => { setView("perks"); setBuilderOpen(true); }}/>
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>{body}</div>
      </div>
    </div>
  );
}

export default BusinessApp;
