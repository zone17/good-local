// ============================================================
// usePassport.js — patron passport-home data hook (US4 T043).
//
// Reads the grouped passport via api.getMyPassport (contract §2.4).
// Anonymous-first (R3): visiting the passport mints the anon session the same
// way a register scan does — one identity across both entries (gl-auth).
// No mock fallback (T064): empty passports render the honest empty state.
//
// Shape returned to PatronApp normalizes the contract response into the fields
// the design screens read (mock-compatible): a hero (top business by progress),
// grouped businesses with real stamp dates + perk progress, and the region card.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { ensurePatronSession } from "../lib/auth.js";
import { getMyPassport } from "../lib/api.js";

// Format an ISO date (YYYY-MM-DD) as the design's MM·DD stamp label.
function stampLabel(isoDate) {
  if (!isoDate) return "";
  const [, m, d] = isoDate.split("-");
  return `${m}·${d}`;
}

// Small deterministic rotation so stamps look hand-pressed (design intent),
// derived from the date string so it's stable across renders.
function rotateFor(i) {
  return [-3, 2, -2, 3, -1, 1][i % 6];
}

// Normalize the §2.4 response into the screen view-model.
function fromPassport(p) {
  const businesses = (p.businesses ?? []).map((b) => {
    const perk = (b.perks ?? [])[0] ?? null;
    // Registered stamp code (3–4 letters) for stamp faces; honest slug fallback.
    const code = b.stamp_code || b.business_slug;
    return {
      slug: b.business_slug,
      stampCode: code,
      name: b.name,
      town: b.town,
      stampCount: b.stamp_count,
      stampDates: b.stamp_dates ?? [],
      stamps: (b.stamp_dates ?? []).map((d, i) => ({
        label: code, date: stampLabel(d), rotate: rotateFor(i),
      })),
      perk: perk
        ? {
            id: perk.perk_id,
            name: perk.name,
            current: perk.current,
            threshold: perk.threshold,
            ready: perk.ready,
          }
        : null,
    };
  });

  // Hero = the business closest to (but not over) finishing its perk; ties go
  // to the highest stamp_count. A ready perk surfaces first.
  const hero =
    [...businesses]
      .filter((b) => b.perk)
      .sort((a, b) => {
        const ar = a.perk.ready ? 1 : 0;
        const br = b.perk.ready ? 1 : 0;
        if (ar !== br) return br - ar;
        const aRem = a.perk.threshold - a.perk.current;
        const bRem = b.perk.threshold - b.perk.current;
        if (aRem !== bRem) return aRem - bRem;
        return b.stampCount - a.stampCount;
      })[0] ?? businesses[0] ?? null;

  return {
    patron: {
      id: p.patron?.id ?? null,
      displayName: p.patron?.display_name ?? null,
      claimed: !!p.patron?.claimed,
    },
    region: {
      townsVisited: p.region?.towns_visited ?? 0,
      townsTotal: p.region?.towns_total ?? 12,
      milestones: p.region?.milestones ?? [],
    },
    businesses,
    hero,
  };
}

export function usePassport() {
  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensurePatronSession(); // anonymous-first — no account wall (R3)
      const data = await getMyPassport();
      setPassport(fromPassport(data));
    } catch (err) {
      setError(err);
      setPassport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { passport, loading, error, reload: load };
}
