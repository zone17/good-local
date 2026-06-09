// ============================================================
// Landing.jsx — the marketing front door at `/`.
// Good Local is the platform; the Upper Delaware is region one, with more
// regions to follow. Copy synthesized from a copywriter panel (D-026); the
// house style here uses no dashes of any kind.
// Built from the canonical design system. The patron app lives at /app.
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
            <Eyebrow>A regional passport · Starting on the Upper Delaware</Eyebrow>
            <Display size={54}>The places worth coming back to.</Display>
            <p style={{ fontSize: 18, lineHeight: 1.55, color: "var(--ink-700)", margin: "18px 0 26px", maxWidth: 540, textWrap: "pretty" }}>
              Good Local is a passport for the independent places worth the trip.
              Wander the river towns, earn a stamp at every stop, and become a regular
              where you belong. Free for locals and weekenders. Owners go live the same
              day.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button variant="primary" size="lg" as="a" href="/app" leadingIcon={<Icon name="wallet" size={20} />}>
                Get your free passport
              </Button>
              <Button variant="secondary" size="lg" as="a" href="#business">
                List your business
              </Button>
            </div>
            <div style={{ marginTop: 18, fontSize: 13, color: "var(--ink-500)" }}>
              Always free for patrons. $79 a month for businesses, founding rate locked.
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

      {/* ---------- Narrative band: travel + belonging ---------- */}
      <Section style={{ paddingTop: 4, paddingBottom: 44 }}>
        <div style={{ textAlign: "center", maxWidth: 740, margin: "0 auto" }}>
          <p style={{
            fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 500, fontStyle: "italic",
            lineHeight: 1.35, letterSpacing: "-0.01em", color: "var(--ink-1000)", margin: 0, textWrap: "balance",
          }}>
            Part adventure, part homecoming. Every stamp is a place you have been,
            and a place that knows you now.
          </p>
        </div>
      </Section>

      {/* ---------- How it works (patron) ---------- */}
      <Section id="how" style={{ paddingTop: 40, paddingBottom: 48 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <Eyebrow>How it works</Eyebrow>
          <Display size={34}>A stamp for every visit.</Display>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 20 }} className="gl-3col">
          {[
            { icon: "wallet", title: "Add it at the register", body: "Tap once and your passport lands in your phone wallet. No app to download, ever." },
            { icon: "qr", title: "Earn a stamp", body: "Every visit adds a stamp and moves you toward the perk each place offers." },
            { icon: "compass", title: "Fill in the region", body: "Town by town, you map the cafés, inns, and outfitters that locals actually return to." },
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
            <Eyebrow color="var(--stamp-700)">Ranked by who comes back</Eyebrow>
            <Display size={28}>Real return visits. Never paid placement.</Display>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--ink-700)", marginTop: 14 }}>
              Discovery here runs on verified return visits, the honest measure of a
              place people love. No business can buy its way to the top. No fabricated
              counts, no ratings to game. The spots that rise are the ones neighbors
              keep coming back to.
            </p>
          </div>
        </Card>
      </Section>

      {/* ---------- For businesses ---------- */}
      <Section id="business" style={{ paddingTop: 32, paddingBottom: 52 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 44, alignItems: "center" }} className="gl-2col">
          <div>
            <Eyebrow color="var(--ochre-700)">For business owners</Eyebrow>
            <Display size={34}>Your loyalty program, live today.</Display>
            <p style={{ fontSize: 16, lineHeight: 1.55, color: "var(--ink-700)", margin: "16px 0 20px" }}>
              Good Local gives you a modern loyalty program you can launch this
              afternoon. Stamps for every visit, perks you design and fund yourself,
              and a calm dashboard showing exactly who comes back. It works on its own
              from day one. As your neighbors join, the whole region becomes one front
              door to your business.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "grid", gap: 10 }}>
              {[
                "Live the same day, at the $79 founding rate",
                "Perks you own and control, never a shared currency",
                "See your real regulars, not vanity numbers",
              ].map((t, i) => (
                <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14.5, color: "var(--ink-1000)" }}>
                  <span style={{ color: "var(--pine-700)", marginTop: 1 }}><Icon name="check" size={18} /></span>
                  <span style={{ lineHeight: 1.5 }}>{t}</span>
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <Button variant="primary" size="lg" as="a" href="/business/signup">List your business</Button>
              <a href="/business" style={{ fontSize: 14, fontWeight: 600, color: "var(--pine-700)" }}>Already a member? Sign in</a>
            </div>
          </div>
          <Card style={{ padding: 28 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 600, color: "var(--ink-1000)" }}>$79</span>
              <span style={{ fontSize: 15, color: "var(--ink-500)" }}>/ month</span>
              <Badge variant="pine" style={{ marginLeft: "auto" }}>Founding rate</Badge>
            </div>
            <div style={{ fontSize: 13.5, color: "var(--ink-500)", marginBottom: 18 }}>Locked for season one. Optional $49 winter tier, November to April.</div>
            <div style={{ borderTop: "1px solid var(--ink-100)", paddingTop: 16, display: "grid", gap: 12 }}>
              {[
                "Two minute perk builder",
                "Printable register kit with rotating QR",
                "A calm weekly dashboard",
                "Regional discovery placement",
              ].map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5 }}>
                  <span style={{ color: "var(--pine-700)" }}><Icon name="check" size={16} /></span>{t}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      {/* ---------- Region one of many (the platform / movement) ---------- */}
      <Section style={{ paddingTop: 16, paddingBottom: 52 }}>
        <Card variant="pine" style={{ padding: "40px 32px", background: "var(--pine-1000)", color: "var(--paper-100)", position: "relative", overflow: "hidden" }}>
          <svg viewBox="0 0 600 140" style={{ position: "absolute", right: -30, top: -10, width: 380, height: 140, opacity: 0.14, pointerEvents: "none" }} aria-hidden="true">
            <path d="M0 80 Q 70 40 140 80 T 280 80 T 420 80 T 560 80" stroke="var(--paper-100)" fill="none" strokeWidth="2.5" />
            <path d="M0 100 Q 70 60 140 100 T 280 100 T 420 100 T 560 100" stroke="var(--paper-100)" fill="none" strokeWidth="1.8" />
          </svg>
          <div style={{ position: "relative", maxWidth: 680 }}>
            <Eyebrow color="var(--ochre-300)">The movement</Eyebrow>
            <Display size={32} style={{ color: "var(--paper-100)" }}>Region one of many.</Display>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: "rgba(246,241,228,0.84)", marginTop: 14 }}>
              Good Local begins on the Upper Delaware, across twelve river towns in
              New York and Pennsylvania. This is the first region, not the last. The
              movement grows one main street at a time, and your region could be next.
            </p>
            <div style={{ marginTop: 22 }}>
              <Button as="a" href="/business/signup" style={{ background: "var(--paper-100)", color: "var(--pine-1000)", border: "none" }}>Bring Good Local to your region</Button>
            </div>
          </div>
        </Card>
      </Section>

      {/* ---------- Blog + Podcast teaser ---------- */}
      <Section style={{ paddingTop: 8, paddingBottom: 56 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 20 }} className="gl-2col">
          <Card as="a" href="/blog" style={{ padding: 28, display: "block", textDecoration: "none", color: "inherit", cursor: "pointer" }}>
            <Eyebrow>The weekly review</Eyebrow>
            <Display size={24}>What is happening on the river</Display>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--ink-700)", margin: "12px 0 14px" }}>
              A short read every week. New spots, season milestones, and the people
              behind the counters.
            </p>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pine-700)" }}>Read the blog</span>
          </Card>
          <Card as="a" href="/podcast" style={{ padding: 28, display: "block", textDecoration: "none", color: "inherit", cursor: "pointer" }}>
            <Eyebrow color="var(--ochre-700)">The podcast</Eyebrow>
            <Display size={24}>Local owners, in their own words</Display>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--ink-700)", margin: "12px 0 14px" }}>
              Every week we sit down with a business owner from the region. Why they
              opened, what keeps them going, what they are proud of.
            </p>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ochre-700)" }}>Listen</span>
          </Card>
        </div>
      </Section>

      {/* ---------- Closing CTA ---------- */}
      <Section style={{ paddingBottom: 64 }}>
        <Card style={{ padding: "44px 32px", textAlign: "center" }}>
          <div style={{ display: "grid", placeItems: "center", marginBottom: 14, color: "var(--pine-700)" }}>
            <SealMark size={52} />
          </div>
          <Display size={30}>Become a regular.</Display>
          <p style={{ fontSize: 15.5, color: "var(--ink-700)", margin: "12px auto 22px", maxWidth: 480, lineHeight: 1.55 }}>
            One passport. Twelve towns. Every good place, in your pocket. Walk into any
            participating spot, scan the QR, and your first stamp lands.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Button variant="primary" size="lg" as="a" href="/app" leadingIcon={<Icon name="wallet" size={20} />}>Get your free passport</Button>
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
