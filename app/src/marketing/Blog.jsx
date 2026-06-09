// ============================================================
// Blog.jsx — public /blog (list) and /blog/{slug} (single post).
// Content from Supabase (blog_posts), authored in /admin.
// ============================================================
import React from "react";
import { Card, Button, Icon } from "../ds.js";
import { SiteNav, SiteFooter } from "./Chrome.jsx";
import { useBlogPosts, useBlogPost, renderMarkdown } from "./useContent.js";

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

function Shell({ children }) {
  return (
    <div style={{ background: "var(--paper-50)", color: "var(--ink-1000)", minHeight: "100dvh", fontFamily: "var(--font-body)" }}>
      <SiteNav />
      {children}
      <SiteFooter />
    </div>
  );
}

export default function Blog({ slug }) {
  return slug ? <Post slug={slug} /> : <List />;
}

function List() {
  const posts = useBlogPosts();
  return (
    <Shell>
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "56px 20px 12px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--pine-700)", marginBottom: 10 }}>The weekly review</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 600, letterSpacing: "-0.018em", lineHeight: 1.08, margin: 0 }}>
          What&apos;s happening on the river
        </h1>
        <p style={{ fontSize: 16.5, color: "var(--ink-700)", lineHeight: 1.55, marginTop: 14 }}>
          A short read every week. New spots, season milestones, and the people behind the counters.
        </p>
      </section>

      <section style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 64px", display: "grid", gap: 16 }}>
        {posts === null ? (
          <div style={{ color: "var(--ink-500)", padding: "24px 0" }}>Loading…</div>
        ) : posts.length === 0 ? (
          <Card style={{ padding: 28 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600 }}>First post coming soon.</div>
            <p style={{ color: "var(--ink-700)", fontSize: 14.5, margin: "8px 0 0" }}>Check back this week — we&apos;re just getting started.</p>
          </Card>
        ) : (
          posts.map((p) => (
            <Card key={p.slug} as="a" href={`/blog/${p.slug}`} style={{ padding: 24, display: "block", textDecoration: "none", color: "inherit", cursor: "pointer" }}>
              <div style={{ fontSize: 12.5, color: "var(--ink-500)", marginBottom: 6 }}>{fmtDate(p.published_at)} · {p.author}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 23, fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.01em" }}>{p.title}</div>
              {p.excerpt ? <p style={{ fontSize: 15, color: "var(--ink-700)", lineHeight: 1.55, margin: "10px 0 12px" }}>{p.excerpt}</p> : null}
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pine-700)" }}>Read →</span>
            </Card>
          ))
        )}
      </section>
    </Shell>
  );
}

function Post({ slug }) {
  const post = useBlogPost(slug);
  if (post === undefined) {
    return <Shell><div style={{ maxWidth: 720, margin: "0 auto", padding: "56px 20px", color: "var(--ink-500)" }}>Loading…</div></Shell>;
  }
  if (post === null) {
    return (
      <Shell>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "72px 20px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600 }}>Post not found.</div>
          <div style={{ marginTop: 16 }}><Button variant="secondary" as="a" href="/blog">Back to the blog</Button></div>
        </div>
      </Shell>
    );
  }
  return (
    <Shell>
      <article style={{ maxWidth: 680, margin: "0 auto", padding: "48px 20px 64px" }}>
        <a href="/blog" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "var(--pine-700)", textDecoration: "none", marginBottom: 20 }}>
          <Icon name="arrow-left" size={16} /> The weekly review
        </a>
        <div style={{ fontSize: 13, color: "var(--ink-500)", marginBottom: 10 }}>{fmtDate(post.published_at)} · {post.author}</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.018em", margin: "0 0 20px" }}>{post.title}</h1>
        {post.cover_image_url ? (
          <img src={post.cover_image_url} alt="" style={{ width: "100%", borderRadius: 14, margin: "0 0 24px", display: "block" }} />
        ) : null}
        <div
          className="gl-prose"
          style={{ fontSize: 17, lineHeight: 1.7, color: "var(--ink-900, var(--ink-1000))" }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
        />
      </article>
      <style>{`
        .gl-prose p { margin: 0 0 18px; }
        .gl-prose h2 { font-family: var(--font-display); font-size: 24px; font-weight: 600; letter-spacing: -0.01em; margin: 28px 0 10px; }
        .gl-prose h3 { font-family: var(--font-display); font-size: 20px; font-weight: 600; margin: 24px 0 8px; }
        .gl-prose a { color: var(--pine-700); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }
        .gl-prose strong { font-weight: 700; }
      `}</style>
    </Shell>
  );
}
