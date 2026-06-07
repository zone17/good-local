// ============================================================
// useBusiness.js — owner's business + perks data hook (US1 T022).
//
// Reads the owner's own business and its perks directly via the RLS-scoped
// supabase client (businesses_owner + perks_owner policies guarantee the
// caller sees only their own rows — no new verb is added to the contract).
// When there is no authenticated session, falls back to the data.js mocks in
// DEV so the demo surface still renders.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/auth.js";
import { BUSINESS, PERKS } from "../data.js";

// Shape returned to BusinessApp: { business, perks } using the same fields the
// screens already read (mock-compatible), plus the real ids needed for writes.
function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    town: row.town?.name ?? row.town_id ?? "",
    townSlug: row.town?.slug ?? "",
    category: row.category,
    code: row.stamp_code,
    ownerNote: row.owner_note ?? "",
    hours: typeof row.hours === "object" ? row.hours?.text ?? "" : row.hours ?? "",
    status: row.status,
    perks: (row.perks ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      threshold: p.visit_threshold,
      kind: p.kind,
      active: p.status === "active",
      status: p.status,
    })),
  };
}

const MOCK = {
  ...BUSINESS,
  id: null,
  isMock: true,
  perks: PERKS.map((p) => ({ ...p, status: p.active ? "active" : "inactive" })),
};

export function useBusiness() {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session ?? null;

      if (!session) {
        // No owner session: demo fallback in DEV; otherwise an explicit null.
        if (import.meta.env.DEV) {
          setBusiness(MOCK);
        } else {
          setBusiness(null);
        }
        return;
      }

      const { data, error: qErr } = await supabase
        .from("businesses")
        .select("*, town:towns(name, slug), perks(*)")
        .single();
      if (qErr) throw qErr;
      setBusiness(fromRow(data));
    } catch (err) {
      setError(err);
      if (import.meta.env.DEV) setBusiness(MOCK);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { business, loading, error, reload: load };
}
