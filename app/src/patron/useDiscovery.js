// ============================================================
// useDiscovery.js — patron discovery + business-detail hook (US5 T047).
//
// Reads curated discovery via api.getDiscovery (contract §2.5) and a single
// business via api.getBusinessDetail (§2.6). Fires api.recordImpressions (§2.2)
// ONCE per discovery render (batched over all visible business ids) and once on
// detail open (single id, surface 'business_detail') — the steer-capture
// pipeline (SC-006). Impressions are best-effort: a failed log never blocks the
// surface. DEV mock fallback mirrors business/useBusiness.js + usePassport.js.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/auth.js";
import { ensurePatronSession } from "../lib/auth.js";
import { getDiscovery, getBusinessDetail, recordImpressions } from "../lib/api.js";
import { BUSINESSES } from "../data.js";

// Flatten the §2.5 towns[] → picks[] into a single ordered list the screen
// renders, preserving curation-first order within each town.
function flattenDiscovery(d) {
  const list = [];
  for (const town of d.towns ?? []) {
    for (const pick of town.picks ?? []) {
      list.push({
        id: pick.business_id,
        slug: pick.business_slug,
        name: pick.name,
        town: town.town,
        category: pick.category ?? "",
        ownerNote: pick.owner_note ?? "",
        regulars: pick.regulars_this_season ?? 0,
        regularsEmpty: !!pick.regulars_empty,
        curationLabel: pick.curation_label ?? null,
      });
    }
  }
  return list;
}

// DEV mock list built from data.js (towns unwrapped).
function mockDiscovery() {
  return BUSINESSES.map((b) => ({
    id: b.id,
    slug: b.id,
    name: b.name,
    town: (b.town ?? "").replace(/,.*$/, ""),
    category: b.kind ?? "",
    ownerNote: b.perkSub ?? "",
    regulars: b.regulars ?? 0,
    regularsEmpty: (b.regulars ?? 0) === 0,
    curationLabel: b.eyebrow === "Founding pick" ? "Founding Pick" : null,
    isMock: true,
  }));
}

export function useDiscovery() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMock, setIsMock] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let session = sessionData?.session ?? null;
      if (!session) {
        if (import.meta.env.DEV) {
          // Bootstrap an anon patron so impressions attribute (the steer
          // pipeline). If that's not possible, fall back to mocks.
          try {
            await ensurePatronSession();
            session = (await supabase.auth.getSession()).data?.session ?? null;
          } catch {
            session = null;
          }
        }
        if (!session) {
          setBusinesses(mockDiscovery());
          setIsMock(true);
          return;
        }
      }

      const data = await getDiscovery();
      const list = flattenDiscovery(data);
      setBusinesses(list);
      setIsMock(false);

      // Batch-log impressions ONCE for every visible business (best-effort).
      const ids = list.map((b) => b.id).filter(Boolean);
      if (ids.length > 0) {
        recordImpressions({ businessIds: ids, surface: "discovery" }).catch(() => {});
      }
    } catch (err) {
      setError(err);
      if (import.meta.env.DEV) {
        setBusinesses(mockDiscovery());
        setIsMock(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { businesses, loading, error, isMock, reload: load };
}

// ---------- Business detail (single business) ----------

function fromDetail(d) {
  return {
    id: d.business_id,
    slug: d.business_slug,
    name: d.name,
    town: d.town,
    category: d.category ?? "",
    hours: d.hours ?? "",
    ownerNote: d.owner_note ?? "",
    directionsUrl: d.directions_url ?? null,
    regulars: d.regulars_this_season ?? 0,
    regularsEmpty: !!d.regulars_empty,
    myProgress: d.my_progress
      ? {
          stampCount: d.my_progress.stamp_count,
          perks: (d.my_progress.perks ?? []).map((p) => ({
            id: p.perk_id,
            current: p.current,
            threshold: p.threshold,
          })),
        }
      : null,
  };
}

export function useBusinessDetail(slug) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session ?? null;
        if (!session) {
          if (import.meta.env.DEV) {
            const m = BUSINESSES.find((b) => b.id === slug || b.code === slug);
            if (m && !cancelled) {
              setDetail({
                id: m.id, slug: m.id, name: m.name,
                town: (m.town ?? "").replace(/,.*$/, ""),
                category: m.kind ?? "", hours: m.open ? "Open now" : "Closed today",
                ownerNote: m.perkSub ?? "", directionsUrl: null,
                regulars: m.regulars ?? 0, regularsEmpty: (m.regulars ?? 0) === 0,
                myProgress: m.stamps > 0
                  ? { stampCount: m.stamps, perks: [{ id: m.id, current: m.stamps, threshold: m.perkTotal }] }
                  : null,
                isMock: true,
              });
            }
          } else if (!cancelled) {
            setDetail(null);
          }
          return;
        }
        const data = await getBusinessDetail({ businessSlug: slug });
        if (cancelled) return;
        const view = fromDetail(data);
        setDetail(view);
        // Log a single business_detail impression on open (best-effort).
        if (view.id) {
          recordImpressions({ businessIds: [view.id], surface: "business_detail" }).catch(() => {});
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { detail, loading, error };
}
