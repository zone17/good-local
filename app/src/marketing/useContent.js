// ============================================================
// useContent.js — read hooks for the public blog + podcast.
// Uses the shared anon Supabase client; RLS returns only published rows
// to the public (admins reading from /admin see drafts too).
// ============================================================
import { useEffect, useState } from "react";
import { supabase } from "../lib/auth.js";

// Each hook returns { ...payload, error } so the UI can tell a genuine empty
// list (show "coming soon") apart from a failed fetch (show "couldn't load").
export function useBlogPosts() {
  const [state, setState] = useState({ posts: null, error: false });
  useEffect(() => {
    let active = true;
    supabase
      .from("blog_posts")
      .select("slug, title, excerpt, author, cover_image_url, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.warn("useBlogPosts:", error.message);
        setState({ posts: error ? [] : (data ?? []), error: !!error });
      });
    return () => { active = false; };
  }, []);
  return state;
}

export function useBlogPost(slug) {
  // post: undefined=loading, null=not found, object=found. error=fetch failed.
  const [state, setState] = useState({ post: undefined, error: false });
  useEffect(() => {
    let active = true;
    setState({ post: undefined, error: false });
    supabase
      .from("blog_posts")
      .select("slug, title, excerpt, body, author, cover_image_url, published_at")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return; // ignore a stale response if slug changes
        if (error) console.warn("useBlogPost:", error.message);
        setState({ post: error ? undefined : (data ?? null), error: !!error });
      });
    return () => { active = false; };
  }, [slug]);
  return state;
}

export function usePodcastEpisodes() {
  const [state, setState] = useState({ episodes: null, error: false });
  useEffect(() => {
    let active = true;
    supabase
      .from("podcast_episodes")
      .select("slug, episode_number, title, guest, description, audio_embed_url, apple_url, spotify_url, duration, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.warn("usePodcastEpisodes:", error.message);
        setState({ episodes: error ? [] : (data ?? []), error: !!error });
      });
    return () => { active = false; };
  }, []);
  return state;
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
      // Only underscores not adjacent to alphanumerics are emphasis, so
      // snake_case words and identifiers are left intact.
      .replace(/(^|[^A-Za-z0-9])_(?=\S)([^_\n]+?)_(?![A-Za-z0-9])/g, "$1<em>$2</em>")
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
