// ============================================================
// useDiscovery.js — patron discovery + business-detail hook (US5 T047).
//
// Reads curated discovery via api.getDiscovery (contract §2.5) and a single
// business via api.getBusinessDetail (§2.6). Fires api.recordImpressions (§2.2)
// ONCE per discovery render (batched over all visible business ids) and once on
// detail open (single id, surface 'business_detail') — the steer-capture
// pipeline (SC-006). Impressions are best-effort: a failed log never blocks the
// surface. Real-only (T064): the anon session is ensured before reading.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { ensurePatronSession } from "../lib/auth.js";
import { getDiscovery, getBusinessDetail, recordImpressions } from "../lib/api.js";

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


export function useDiscovery() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensurePatronSession(); // anonymous-first (R3)
      const data = await getDiscovery();
      const list = flattenDiscovery(data);
      setBusinesses(list);

      // Batch-log impressions ONCE for every visible business (best-effort).
      const ids = list.map((b) => b.id).filter(Boolean);
      if (ids.length > 0) {
        recordImpressions({ businessIds: ids, surface: "discovery" }).catch(() => {});
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { businesses, loading, error, reload: load };
}

// ---------- Business detail (single business) ----------

function fromDetail(d) {
  return {
    id: d.business_id,
    slug: d.business_slug,
    // Registered stamp code (3–4 letters) for stamp faces; honest slug fallback.
    stampCode: d.stamp_code || d.business_slug,
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
        await ensurePatronSession(); // anonymous-first (R3)
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
