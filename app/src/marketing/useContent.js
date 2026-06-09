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
    supabase
      .from("blog_posts")
      .select("slug, title, excerpt, author, cover_image_url, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .then(({ data }) => setPosts(data ?? []));
  }, []);
  return posts;
}

export function useBlogPost(slug) {
  const [post, setPost] = useState(undefined); // undefined=loading, null=not found
  useEffect(() => {
    supabase
      .from("blog_posts")
      .select("slug, title, excerpt, body, author, cover_image_url, published_at")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data }) => setPost(data ?? null));
  }, [slug]);
  return post;
}

export function usePodcastEpisodes() {
  const [eps, setEps] = useState(null);
  useEffect(() => {
    supabase
      .from("podcast_episodes")
      .select("slug, episode_number, title, guest, description, audio_embed_url, apple_url, spotify_url, duration, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .then(({ data }) => setEps(data ?? []));
  }, []);
  return eps;
}

// Tiny dependency-free markdown → HTML for post bodies (paragraphs, **bold**,
// _italic_, # headings, [links](url), and line breaks). Deliberately minimal to
// stay inside the bundle budget — no markdown library.
export function renderMarkdown(md) {
  if (!md) return "";
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/_(.+?)_/g, "<em>$1</em>")
      .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return md
    .split(/\n{2,}/)
    .map((block) => {
      const b = block.trim();
      if (!b) return "";
      const h = b.match(/^(#{1,3})\s+(.*)$/);
      if (h) {
        const lvl = h[1].length + 1; // # → h2
        return `<h${lvl}>${inline(h[2])}</h${lvl}>`;
      }
      return `<p>${inline(b).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");
}
