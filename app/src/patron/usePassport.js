// ============================================================
// usePassport.js — patron passport-home data hook (US4 T043).
//
// Reads the grouped passport via api.getMyPassport (contract §2.4). When there
// is no authenticated session (or no backend), falls back to the data.js mocks
// in DEV so the demo surface still renders — mirrors business/useBusiness.js.
//
// Shape returned to PatronApp normalizes the contract response into the fields
// the design screens read (mock-compatible): a hero (top business by progress),
// grouped businesses with real stamp dates + perk progress, and the region card.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/auth.js";
import { getMyPassport } from "../lib/api.js";
import { ME, BUSINESSES, MY_STAMPS } from "../data.js";

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
    return {
      slug: b.business_slug,
      name: b.name,
      town: b.town,
      stampCount: b.stamp_count,
      stampDates: b.stamp_dates ?? [],
      stamps: (b.stamp_dates ?? []).map((d, i) => ({
        label: b.business_slug, date: stampLabel(d), rotate: rotateFor(i),
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
    isMock: false,
  };
}

// DEV mock built from data.js, in the same normalized shape.
function mockPassport() {
  const grouped = {};
  MY_STAMPS.forEach((s) => {
    (grouped[s.code] = grouped[s.code] || []).push(s);
  });
  const businesses = Object.entries(grouped).map(([code, stamps]) => {
    const biz = BUSINESSES.find((b) => b.code === code);
    return {
      slug: biz?.id ?? code,
      name: biz?.name ?? code,
      town: (biz?.town ?? "").replace(/,.*$/, ""),
      stampCount: stamps.length,
      stampDates: stamps.map((s) => s.date),
      stamps: stamps.map((s, i) => ({ label: code, date: s.date, rotate: s.rotate ?? rotateFor(i) })),
      perk: biz
        ? {
            id: biz.id,
            name: biz.perkLabel,
            current: stamps.length,
            threshold: biz.perkTotal,
            ready: stamps.length >= biz.perkTotal,
          }
        : null,
    };
  });
  const heroBiz = BUSINESSES.find((b) => b.id === "heron");
  const hero = businesses.find((b) => b.slug === "heron") ?? {
    slug: "heron",
    name: heroBiz.name,
    town: heroBiz.town.replace(/,.*$/, ""),
    stampCount: heroBiz.stamps,
    stampDates: [],
    stamps: [],
    perk: {
      id: "heron",
      name: heroBiz.perkLabel,
      current: heroBiz.stamps,
      threshold: heroBiz.perkTotal,
      ready: heroBiz.stamps >= heroBiz.perkTotal,
    },
  };
  return {
    patron: { id: null, displayName: ME.firstName, claimed: false },
    region: { townsVisited: 4, townsTotal: 12, milestones: [] },
    businesses,
    hero,
    isMock: true,
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
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session ?? null;
      if (!session) {
        setPassport(import.meta.env.DEV ? mockPassport() : null);
        return;
      }
      const data = await getMyPassport();
      setPassport(fromPassport(data));
    } catch (err) {
      setError(err);
      if (import.meta.env.DEV) setPassport(mockPassport());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { passport, loading, error, reload: load };
}
