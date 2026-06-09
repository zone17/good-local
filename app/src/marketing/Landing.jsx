// ============================================================
// Landing.jsx — the marketing front door at `/`.
// Explains Good Local to first-time visitors and routes them:
//   patrons → /app, business owners → /business/signup.
// Built from the canonical design system (tokens + a few primitives).
// The patron app itself now lives at /app (see App.jsx).
// ============================================================
import React from "react";
import { Button, Icon, Card, SealMark, WalletPass, Badge } from "../ds.js";
import { SiteNav, SiteFooter } from "./Chrome.jsx";

function Section({ children, style, id }) {
  return (
    <section id={id} style={{ padding: "0 20px", ...style }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>{children}</div>
    </section>
  );
}

const Display = ({ size = 40, children, style }) => (
  <h2 style={{
    fontFamily: "var(--font-display)", fontWeight: 600, fontSize: size,
    lineHeight: 1.08, letterSpacing: "-0.018em", color: "var(--ink-1000)",
    fontVariationSettings: `"opsz" ${Math.min(size + 8, 48)}`, textWrap: "balance",
    margin: 0, ...style,
  }}>{children}</h2>
);

const Eyebrow = ({ children, color = "var(--pine-700)" }) => (
  <div style={{
    fontSize: 12, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.14em", color, marginBottom: 10,
  }}>{children}</div>
);

export default function Landing() {
  return (
    <div style={{ background: "var(--paper-50)", color: "var(--ink-1000)", minHeight: "100dvh", fontFamily: "var(--font-body)" }}>
      <SiteNav />

      {/* ---------- Hero ---------- */}
      <Section style={{ paddingTop: 56, paddingBottom: 48 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,0.9fr)", gap: 48, alignItems: "center" }} className="gl-hero">
          <div>
            <Eyebrow>Upper Delaware · Season One</Eyebrow>
            <Display size={52}>One passport for the whole river region.</Display>
            <p style={{ fontSize: 18, lineHeight: 1.55, color: "var(--ink-700)", margin: "18px 0 26px", maxWidth: 520, textWrap: "pretty" }}>
              Earn a stamp every time you visit a local spot. Collect perks at the
              places you love, and fill in all twelve towns as you go. No app to
              download — your passport lives in your phone&apos;s wallet.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button variant="primary" size="lg" as="a" href="/app" leadingIcon={<Icon name="wallet" size={20} />}>
                Open your passport
              </Button>
              <Button variant="secondary" size="lg" as="a" href="#business">
                List your business
              </Button>
            </div>
            <div style={{ marginTop: 18, fontSize: 13, color: "var(--ink-500)" }}>
              Free for patrons, always. $79/mo for businesses — founding rate locked.
            </div>
          </div>
          <div style={{ display: "grid", placeItems: "center" }}>
            <WalletPass
              businessName="The Heron"
              region="Narrowsburg, NY"
              count={4} total={5}
              perkLabel="The Regular's Pour"
              perkSub="One more visit, on the house"
              stampCode="HRN"
              style={{ "--pass-w": "300px", "--pass-h": "372px", boxSizing: "border-box" }}
            />
          </div>
        </div>
      </Section>

      {/* ---------- How it works (patron) ---------- */}
      <Section id="how" style={{ paddingTop: 40, paddingBottom: 48 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <Eyebrow>How it works</Eyebrow>
          <Display size={34}>Scan. Stamp. Come back.</Display>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 20 }} className="gl-3col">
          {[
            { icon: "qr", title: "Scan at the register", body: "Point your camera at the kraft card by the counter. Your passport opens — no app, no account wall." },
            { icon: "wallet", title: "Earn a stamp", body: "One stamp per visit, pressed into your wallet pass. Reach a shop's threshold and the perk is yours." },
            { icon: "compass", title: "Fill the region", body: "Every new town you visit fills in your season passport — twelve towns up and down the Upper Delaware." },
          ].map((s, i) => (
            <Card key={i} style={{ padding: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--pine-50)", color: "var(--pine-700)", display: "grid", placeItems: "center", marginBottom: 14 }}>
                <Icon name={s.icon} size={22} />
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, marginBottom: 6 }}>{s.title}</div>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "var(--ink-700)" }}>{s.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* ---------- Trust / no paid placement ---------- */}
      <Section style={{ paddingTop: 24, paddingBottom: 48 }}>
        <Card variant="kraft" style={{ padding: "36px 32px", position: "relative", overflow: "hidden" }}>
          <svg viewBox="0 0 600 120" style={{ position: "absolute", right: -40, bottom: -20, width: 360, height: 120, opacity: 0.16, pointerEvents: "none" }} aria-hidden="true">
            <path d="M0 70 Q 70 30 140 70 T 280 70 T 420 70 T 560 70" stroke="var(--pine-700)" fill="none" strokeWidth="2.5" />
            <path d="M0 88 Q 70 48 140 88 T 280 88 T 420 88 T 560 88" stroke="var(--pine-700)" fill="none" strokeWidth="1.8" />
          </svg>
          <div style={{ position: "relative", maxWidth: 640 }}>
            <Eyebrow color="var(--stamp-700)">Discovery you can trust</Eyebrow>
            <Display size={28}>Ranked by real regulars — never paid placement.</Display>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--ink-700)", marginTop: 14 }}>
              When you discover a spot on Good Local, the only thing that lifts it is
              how many people genuinely come back. No business can buy its way to the
              top, no fabricated counts, no ratings to game. The counters are real or
              they say so.
            </p>
          </div>
        </Card>
      </Section>

      {/* ---------- For businesses ---------- */}
      <Section id="business" style={{ paddingTop: 32, paddingBottom: 52 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 44, alignItems: "center" }} className="gl-2col">
          <div>
            <Eyebrow color="var(--ochre-700)">For business owners</Eyebrow>
            <Display size={34}>Your own rewards program, live the same day.</Display>
            <p style={{ fontSize: 16, lineHeight: 1.55, color: "var(--ink-700)", margin: "16px 0 20px" }}>
              Set up a perk in two minutes, print your register kit, and start
              rewarding regulars. A calm weekly dashboard — who came back, what&apos;s
              working — and not one patron&apos;s history at any other shop. $79/mo,
              founding rate locked for season one.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "grid", gap: 10 }}>
              {[
                "Works standalone — you don't need anyone else on the network",
                "Stamps carry no cash value; you owe nothing until a patron earns a perk",
                "Your numbers are yours — owners only ever see their own aggregates",
              ].map((t, i) => (
                <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14.5, color: "var(--ink-1000)" }}>
                  <span style={{ color: "var(--pine-700)", marginTop: 1 }}><Icon name="check" size={18} /></span>
                  <span style={{ lineHeight: 1.5 }}>{t}</span>
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <Button variant="primary" size="lg" as="a" href="/business/signup">List your business · $79/mo</Button>
              <a href="/business" style={{ fontSize: 14, fontWeight: 600, color: "var(--pine-700)" }}>Already a member? Sign in →</a>
            </div>
          </div>
          <Card style={{ padding: 28 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 600, color: "var(--ink-1000)" }}>$79</span>
              <span style={{ fontSize: 15, color: "var(--ink-500)" }}>/ month</span>
              <Badge variant="pine" style={{ marginLeft: "auto" }}>Founding rate</Badge>
            </div>
            <div style={{ fontSize: 13.5, color: "var(--ink-500)", marginBottom: 18 }}>Locked for season one · $49 winter tier Nov–Apr</div>
            <div style={{ borderTop: "1px solid var(--ink-100)", paddingTop: 16, display: "grid", gap: 12 }}>
              {[
                ["Two-minute perk builder", "qr"],
                ["Printable register kit + rotating QR", "qr"],
                ["Calm weekly dashboard", "compass"],
                ["Regional discovery placement", "compass"],
              ].map(([t, ic], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5 }}>
                  <span style={{ color: "var(--pine-700)" }}><Icon name="check" size={16} /></span>{t}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      {/* ---------- Blog + Podcast teaser ---------- */}
      <Section style={{ paddingTop: 24, paddingBottom: 56 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 20 }} className="gl-2col">
          <Card as="a" href="/blog" style={{ padding: 28, display: "block", textDecoration: "none", color: "inherit", cursor: "pointer" }}>
            <Eyebrow>The weekly review</Eyebrow>
            <Display size={24}>What&apos;s happening on the river</Display>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--ink-700)", margin: "12px 0 14px" }}>
              A short read every week — new spots, season milestones, and the people
              behind the counters.
            </p>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pine-700)" }}>Read the blog →</span>
          </Card>
          <Card as="a" href="/podcast" style={{ padding: 28, display: "block", textDecoration: "none", color: "inherit", cursor: "pointer" }}>
            <Eyebrow color="var(--ochre-700)">The podcast</Eyebrow>
            <Display size={24}>Local owners, in their own words</Display>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--ink-700)", margin: "12px 0 14px" }}>
              Every week we sit down with a business owner from the Upper Delaware —
              why they opened, what keeps them going, what they&apos;re proud of.
            </p>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ochre-700)" }}>Listen →</span>
          </Card>
        </div>
      </Section>

      {/* ---------- Closing CTA ---------- */}
      <Section style={{ paddingBottom: 64 }}>
        <Card variant="pine" style={{ padding: "44px 32px", textAlign: "center", background: "var(--pine-1000)", color: "var(--paper-100)" }}>
          <div style={{ display: "grid", placeItems: "center", marginBottom: 14, color: "var(--paper-100)" }}>
            <SealMark size={52} />
          </div>
          <Display size={30} style={{ color: "var(--paper-100)" }}>Start your passport today.</Display>
          <p style={{ fontSize: 15.5, color: "rgba(246,241,228,0.82)", margin: "12px auto 22px", maxWidth: 460, lineHeight: 1.55 }}>
            Walk into any participating spot, scan the QR, and your first stamp lands.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Button variant="wallet" size="lg" as="a" href="/app" leadingIcon={<Icon name="wallet" size={20} />}>Open your passport</Button>
          </div>
        </Card>
      </Section>

      <SiteFooter />

      <style>{`
        @media (max-width: 880px) {
          .gl-hero, .gl-2col { grid-template-columns: 1fr !important; }
          .gl-3col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
