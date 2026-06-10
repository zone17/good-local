// ============================================================
// regionInterest.js — submit "bring Good Local to your region" interest.
//
// Uses a bare fetch against PostgREST (not the Supabase JS client) on purpose,
// so the landing page stays free of the ~55KB SDK (see D-028). RLS lets anon
// INSERT into region_interest; nothing here can read it back.
// ============================================================
const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function postRegionInterest({ region, email, role = null, note = null }) {
  const res = await fetch(`${URL}/rest/v1/region_interest`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ region, email, role, note }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail.slice(0, 160) || `Request failed (${res.status})`);
  }
}
