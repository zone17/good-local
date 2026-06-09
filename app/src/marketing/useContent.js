// ============================================================
// useContent.js — read hooks for the public blog + podcast.
// Uses the shared anon Supabase client; RLS returns only published rows
// to the public (admins reading from /admin see drafts too).
// ============================================================
import { useEffect, useState } from "react";
import { supabase } from "../lib/auth.js";

export function useBlogPosts() {
  const [posts, setPosts] = useState(null);
  useEffect(() => {
    let active = true;
    supabase
      .from("blog_posts")
      .select("slug, title, excerpt, author, cover_image_url, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .then(({ data }) => { if (active) setPosts(data ?? []); });
    return () => { active = false; };
  }, []);
  return posts;
}

export function useBlogPost(slug) {
  const [post, setPost] = useState(undefined); // undefined=loading, null=not found
  useEffect(() => {
    let active = true;
    supabase
      .from("blog_posts")
      .select("slug, title, excerpt, body, author, cover_image_url, published_at")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data }) => { if (active) setPost(data ?? null); });
    return () => { active = false; }; // ignore a stale response if slug changes
  }, [slug]);
  return post;
}

export function usePodcastEpisodes() {
  const [eps, setEps] = useState(null);
  useEffect(() => {
    let active = true;
    supabase
      .from("podcast_episodes")
      .select("slug, episode_number, title, guest, description, audio_embed_url, apple_url, spotify_url, duration, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .then(({ data }) => { if (active) setEps(data ?? []); });
    return () => { active = false; };
  }, []);
  return eps;
}

// Tiny dependency-free markdown → HTML for post bodies (paragraphs, **bold**,
// _italic_, # headings, [links](url), and line breaks). Deliberately minimal to
// stay inside the bundle budget — no markdown library.
export function renderMarkdown(md) {
  if (!md) return "";
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // The URL is interpolated into an href attribute. esc() (run first on the whole
  // string) already handled <,>,& — but NOT quotes. The link URL class therefore
  // FORBIDS quotes/angle-brackets/whitespace/`)` so it can't break out of the
  // attribute, and attrEnc() encodes any quote as belt-and-suspenders. Only the
  // `http(s)://` scheme matches, so `javascript:` URLs are impossible.
  const attrEnc = (s) => s.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const inline = (s) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/_(.+?)_/g, "<em>$1</em>")
      .replace(
        /\[([^\]]+?)\]\((https?:\/\/[^\s"'<>)]+)\)/g,
        (_m, text, url) => `<a href="${attrEnc(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`,
      );
  return md
    .split(/\n{2,}/)
    .map((block) => {
      const b = block.trim();
      if (!b) return "";
      // Only a single-line block is a heading; otherwise `# Title\ntext` would
      // drop everything after the first line (the `.` in the regex stops at \n).
      const h = !b.includes("\n") && b.match(/^(#{1,3})\s+(.*)$/);
      if (h) {
        const lvl = h[1].length + 1; // # → h2
        return `<h${lvl}>${inline(h[2])}</h${lvl}>`;
      }
      return `<p>${inline(b).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");
}
