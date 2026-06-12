// ============================================================
// Chrome.jsx — shared site nav + footer for the marketing surfaces
// (Landing, Blog, Podcast). The app/business/admin surfaces keep their
// own chrome; this is only the public marketing shell.
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button, Icon, SealMark } from "../ds.js";

const NAV_LINKS = [
  { label: "How it works", href: "/#how" },
  { label: "For business", href: "/#business" },
  { label: "Blog", href: "/blog" },
  { label: "Podcast", href: "/podcast" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const burgerRef = useRef(null);
  const close = useCallback(() => { setOpen(false); burgerRef.current?.focus(); }, []);

  // While the mobile menu is open: Escape closes it (and returns focus to the
  // burger), and growing past the mobile breakpoint closes it so it can't be
  // left stranded behind the restored desktop nav.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    const onResize = () => { if (window.innerWidth > 760) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 20,
      background: "color-mix(in srgb, var(--paper-50) 88%, transparent)",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--ink-100)",
    }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 16 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--ink-1000)" }}>
          <span style={{ color: "var(--pine-700)", display: "grid", placeItems: "center" }}><SealMark size={32} /></span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em" }}>Good Local</span>
        </a>

        <nav className="gl-nav-links" style={{ display: "flex", gap: 22, marginLeft: 18 }}>
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} style={{ fontSize: 14.5, fontWeight: 500, color: "var(--ink-700)", textDecoration: "none" }}>{l.label}</a>
          ))}
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }} className="gl-nav-cta">
          <a href="/business" style={{ fontSize: 14, fontWeight: 600, color: "var(--pine-700)", textDecoration: "none" }}>Business sign in</a>
          <Button variant="primary" size="sm" as="a" href="/app">Open passport</Button>
        </div>

        <button
          ref={burgerRef}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="gl-mobile-menu"
          onClick={() => setOpen((v) => !v)}
          className="gl-nav-burger"
          style={{ marginLeft: "auto", display: "none", background: "none", border: 0, cursor: "pointer", color: "var(--ink-1000)" }}
        >
          <Icon name={open ? "x" : "menu"} size={24} />
        </button>
      </div>

      {open ? (
        <div id="gl-mobile-menu" className="gl-nav-mobile" style={{ display: "none", padding: "8px 20px 16px", borderTop: "1px solid var(--ink-100)", flexDirection: "column", gap: 4 }}>
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ padding: "10px 0", fontSize: 15, fontWeight: 500, color: "var(--ink-1000)", textDecoration: "none" }}>{l.label}</a>
          ))}
          <a href="/business" style={{ padding: "10px 0", fontSize: 15, fontWeight: 600, color: "var(--pine-700)", textDecoration: "none" }}>Business sign in</a>
          <div style={{ marginTop: 8 }}><Button variant="primary" block as="a" href="/app">Open passport</Button></div>
        </div>
      ) : null}

      <style>{`
        @media (max-width: 760px) {
          .gl-nav-links, .gl-nav-cta { display: none !important; }
          .gl-nav-burger { display: grid !important; place-items: center; }
          .gl-nav-mobile { display: flex !important; }
        }
        /* Visible keyboard focus for marketing links + the burger (the DS only
           styles .gl-btn / inputs; bare anchors had no focus indicator). */
        .gl-marketing a:focus-visible, .gl-nav-burger:focus-visible {
          outline: 2px solid var(--pine-700); outline-offset: 3px; border-radius: 6px;
        }
      `}</style>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--ink-100)", background: "var(--paper-100)", padding: "40px 20px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 32, justifyContent: "space-between" }}>
        <div style={{ maxWidth: 320 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ color: "var(--pine-700)" }}><SealMark size={28} /></span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600 }}>Good Local</span>
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-500)", margin: 0 }}>
            The Upper Delaware Passport. Run by river town residents. We never sell
            ranking and never share your visit history.
          </p>
        </div>
        <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
          <FooterCol title="Explore" links={[["Open passport", "/app"], ["Discover", "/app"], ["How it works", "/#how"]]} />
          <FooterCol title="Business" links={[["List your business", "/business/signup"], ["Sign in", "/business"], ["Pricing", "/#business"]]} />
          <FooterCol title="More" links={[["Blog", "/blog"], ["Podcast", "/podcast"], ["Privacy", "/privacy"], ["Terms", "/terms"]]} />
        </div>
      </div>
      <div style={{ maxWidth: 1080, margin: "28px auto 0", paddingTop: 16, borderTop: "1px solid var(--ink-100)", fontSize: 12.5, color: "var(--ink-500)" }}>
        2026 Good Local · Upper Delaware, NY/PA · All rights reserved
      </div>
    </footer>
  );
}

function FooterCol({ title, links }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-500)", marginBottom: 12 }}>{title}</div>
      <div style={{ display: "grid", gap: 9 }}>
        {links.map(([t, h]) => (
          <a key={t + h} href={h} style={{ fontSize: 14, color: "var(--ink-700)", textDecoration: "none" }}>{t}</a>
        ))}
      </div>
    </div>
  );
}
