// ============================================================
// Legal.jsx — public /privacy and /terms (spec 002 FR-006/FR-008).
//
// Plain voice, house style (no dashes, no legalese walls). Every claim
// here describes ACTUAL practice; if practice changes, this page changes
// in the same PR (audit COMP-001/002: the trust posture is only as good
// as the page that states it). Counsel review is tracked separately
// (COMP-009) and refines wording, not behavior.
// ============================================================
import React from "react";
import { SiteNav, SiteFooter } from "./Chrome.jsx";

function Shell({ children }) {
  return (
    <div className="gl-marketing" style={{ background: "var(--paper-50)", color: "var(--ink-1000)", minHeight: "100dvh", fontFamily: "var(--font-body)" }}>
      <SiteNav />
      {children}
      <SiteFooter />
    </div>
  );
}

const H1 = ({ children }) => (
  <h1 style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 600, letterSpacing: "-0.018em", lineHeight: 1.1, margin: 0 }}>{children}</h1>
);
const H2 = ({ children }) => (
  <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.012em", margin: "34px 0 10px" }}>{children}</h2>
);
const P = ({ children }) => (
  <p style={{ fontSize: 15.5, color: "var(--ink-700)", lineHeight: 1.65, margin: "0 0 14px" }}>{children}</p>
);
const LI = ({ children }) => (
  <li style={{ fontSize: 15.5, color: "var(--ink-700)", lineHeight: 1.65, marginBottom: 8 }}>{children}</li>
);

const wrap = { maxWidth: 720, margin: "0 auto", padding: "56px 20px 72px" };
const updated = (
  <div style={{ fontSize: 13, color: "var(--ink-500)", margin: "10px 0 28px" }}>Last updated June 12, 2026</div>
);

export default function Legal({ page }) {
  return page === "terms" ? <Terms /> : <Privacy />;
}

function Privacy() {
  return (
    <Shell>
      <section style={wrap}>
        <H1>Privacy policy</H1>
        {updated}
        <P>
          Good Local is a regional passport for independent businesses on the Upper Delaware.
          This page says plainly what we collect, why, and what we will never do with it.
        </P>

        <H2>What we collect</H2>
        <ul style={{ paddingLeft: 20, margin: "0 0 14px" }}>
          <LI><strong>Check-ins.</strong> When you scan a register code we record the visit: the business, the time, and an anonymous passport identity stored on your phone.</LI>
          <LI><strong>Phone number.</strong> Only if you choose to save your passport with your number so your stamps follow you to a new phone. Staff can also enter your number at the register if you ask them to stamp you in.</LI>
          <LI><strong>Email.</strong> Business owners give an email to run their account. The region interest form on our landing page collects an email and a town.</LI>
          <LI><strong>Billing.</strong> Business subscriptions are processed by Stripe. We never see or store card numbers.</LI>
        </ul>

        <H2>What we do with it</H2>
        <P>
          Your visit history powers your own passport: stamps, perk progress, and regional
          milestones. Businesses see aggregate patterns for their own establishment, like repeat
          visit rates and how their perks perform. A business never sees your individual history
          at other businesses. Recommendations in the app are ranked by verified return visits,
          never by payment.
        </P>

        <H2>What we will never do</H2>
        <ul style={{ paddingLeft: 20, margin: "0 0 14px" }}>
          <LI>We do not sell personal data to anyone, including participating businesses.</LI>
          <LI>We do not run ad trackers or advertising pixels, and we do not use tracking cookies.</LI>
          <LI>We do not track your location in the background. A visit is recorded only when you check in.</LI>
        </ul>

        <H2>Text messages</H2>
        <P>
          If you enter your phone number to claim your passport, we send one text with a 6 digit
          code. Message and data rates may apply. We do not send marketing texts. Codes expire in
          10 minutes and expired codes are deleted from our systems within 30 days.
        </P>

        <H2>Who processes data for us</H2>
        <P>
          We run on a small set of service providers: Supabase hosts our database and sign-in,
          Vercel hosts the website, Stripe handles business billing, Twilio delivers text
          messages, and Resend delivers email. Pages load fonts from Google Fonts, which means
          your browser requests a file from Google when a page loads. Each provider receives only
          what it needs to do its job.
        </P>

        <H2>How long we keep things</H2>
        <P>
          Stamps and milestones are your passport history and are kept so your passport never
          loses what you earned. Verification codes are purged within 30 days. If a business
          closes or leaves, your passport and stamps are unaffected.
        </P>

        <H2>Your choices</H2>
        <P>
          You can use Good Local without ever giving a phone number or email; the passport works
          anonymously on your phone. To export your data or to remove your personal identifiers
          from our systems, email <a href="mailto:help@goodlocal.app">help@goodlocal.app</a> and
          we will take care of it.
        </P>

        <H2>Children</H2>
        <P>
          Good Local is not directed to children under 13. Claiming a passport with a phone
          number is for people 16 and older.
        </P>

        <H2>Questions</H2>
        <P>
          Write to <a href="mailto:help@goodlocal.app">help@goodlocal.app</a>. We are river town
          residents and we answer.
        </P>
      </section>
    </Shell>
  );
}

function Terms() {
  return (
    <Shell>
      <section style={wrap}>
        <H1>Terms of service</H1>
        {updated}
        <P>
          These terms cover the Good Local passport for patrons and the Good Local membership for
          businesses on the Upper Delaware.
        </P>

        <H2>The passport, for patrons</H2>
        <ul style={{ paddingLeft: 20, margin: "0 0 14px" }}>
          <LI>The passport is free. One stamp per business per day, earned by a real visit.</LI>
          <LI><strong>Stamps have no cash value.</strong> They are not currency, credit, or stored value, and they cannot be exchanged for money. Perks belong to the business that offers them and end if that business leaves.</LI>
          <LI>Stamps are personal and cannot be transferred or sold.</LI>
          <LI>Gaming the system, like scanning codes without a real visit, may void the affected stamps. We keep check-ins honest because every recommendation rides on them.</LI>
        </ul>

        <H2>Membership, for businesses</H2>
        <ul style={{ paddingLeft: 20, margin: "0 0 14px" }}>
          <LI>The membership is $79 per month, billed by Stripe, with no long term contract. Cancel anytime and billing stops at the end of the period.</LI>
          <LI>Founding members keep the $79 rate for as long as their membership stays active. An optional $49 winter tier is available November through April.</LI>
          <LI>New businesses are reviewed by hand before going live, usually within a day of signup.</LI>
          <LI>Perks are designed and funded by the business that offers them. Discovery placement can never be bought; ranking comes from verified return visits only.</LI>
          <LI>If billing fails, check-ins pause until it is resolved. Patron passports and earned stamps are never affected.</LI>
        </ul>

        <H2>The honest parts</H2>
        <P>
          The service is provided as is, without warranties. We work hard to keep it running, but
          we are a small team and outages can happen; if they do, stamps already earned stay
          safe. We may update these terms as the product grows, and material changes will be
          announced on this page with a new date above.
        </P>

        <H2>Contact</H2>
        <P>
          Questions about these terms: <a href="mailto:help@goodlocal.app">help@goodlocal.app</a>.
          Good Local operates from the Upper Delaware region of New York and Pennsylvania, and
          these terms are governed by New York law.
        </P>
      </section>
    </Shell>
  );
}
