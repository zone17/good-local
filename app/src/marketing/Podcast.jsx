// ============================================================
// Podcast.jsx — public /podcast. Episodes from Supabase
// (podcast_episodes), authored in /admin. Audio is hosted externally
// (podcast host); we embed/link it.
// ============================================================
import React from "react";
import { Card, Button, SealMark } from "../ds.js";
import { SiteNav, SiteFooter } from "./Chrome.jsx";
import { usePodcastEpisodes } from "./useContent.js";

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

export default function Podcast() {
  const { episodes: eps, error } = usePodcastEpisodes();
  return (
    <div className="gl-marketing" style={{ background: "var(--paper-50)", color: "var(--ink-1000)", minHeight: "100dvh", fontFamily: "var(--font-body)" }}>
      <SiteNav />

      <section style={{ maxWidth: 820, margin: "0 auto", padding: "56px 20px 8px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--ochre-700)", marginBottom: 10 }}>The podcast</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 600, letterSpacing: "-0.018em", lineHeight: 1.08, margin: 0 }}>
          Local owners, in their own words
        </h1>
        <p style={{ fontSize: 16.5, color: "var(--ink-700)", lineHeight: 1.55, marginTop: 14, maxWidth: 620 }}>
          Every week we sit down with a business owner from the Upper Delaware — why
          they opened, what keeps them going, and what they&apos;re proud of.
        </p>
      </section>

      <section style={{ maxWidth: 820, margin: "0 auto", padding: "28px 20px 64px", display: "grid", gap: 18 }}>
        {eps === null ? (
          <div style={{ color: "var(--ink-500)", padding: "24px 0" }}>Loading…</div>
        ) : error ? (
          <Card style={{ padding: 28 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600 }}>We couldn&apos;t load the podcast.</div>
            <p style={{ color: "var(--ink-700)", fontSize: 14.5, margin: "8px 0 0" }}>Please refresh to try again.</p>
          </Card>
        ) : eps.length === 0 ? (
          <Card style={{ padding: 32, textAlign: "center" }}>
            <div style={{ color: "var(--ochre-700)", display: "grid", placeItems: "center", marginBottom: 12 }}><SealMark size={44} /></div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600 }}>First episode coming soon.</div>
            <p style={{ color: "var(--ink-700)", fontSize: 14.5, margin: "8px 0 0" }}>We&apos;re lining up our first guests from up and down the river.</p>
          </Card>
        ) : (
          eps.map((e) => (
            <Card key={e.slug} style={{ padding: 24 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
                {e.episode_number != null ? (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ochre-700)", fontWeight: 600 }}>EP {e.episode_number}</div>
                ) : null}
                <div style={{ fontSize: 12.5, color: "var(--ink-500)" }}>{fmtDate(e.published_at)}{e.duration ? ` · ${e.duration}` : ""}</div>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.01em", marginTop: 4 }}>{e.title}</div>
              {e.guest ? <div style={{ fontSize: 13.5, color: "var(--ink-500)", marginTop: 2 }}>with {e.guest}</div> : null}
              {e.description ? <p style={{ fontSize: 15, color: "var(--ink-700)", lineHeight: 1.55, margin: "12px 0 14px" }}>{e.description}</p> : null}

              {e.audio_embed_url ? (
                <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
                  <iframe
                    src={e.audio_embed_url} title={e.title} loading="lazy"
                    style={{ width: "100%", height: 152, border: 0 }}
                    allow="autoplay; encrypted-media"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  />
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {e.apple_url ? <Button variant="secondary" size="sm" as="a" href={e.apple_url} target="_blank" rel="noopener noreferrer">Apple Podcasts</Button> : null}
                {e.spotify_url ? <Button variant="secondary" size="sm" as="a" href={e.spotify_url} target="_blank" rel="noopener noreferrer">Spotify</Button> : null}
              </div>
            </Card>
          ))
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
