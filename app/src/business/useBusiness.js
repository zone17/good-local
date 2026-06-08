// ============================================================
// useBusiness.js — owner's business + perks data hook (US1 T022).
//
// Reads the owner's own business and its perks directly via the RLS-scoped
// supabase client (businesses_owner + perks_owner policies guarantee the
// caller sees only their own rows — no new verb is added to the contract).
// Real-only (T064): no session -> needsAuth (BusinessApp renders OwnerSignIn);
// a session with no business rows -> business null (points to /business/signup).
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/auth.js";

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

export function useBusiness() {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session ?? null;

      // An owner authenticates with email/password (non-anonymous). A lingering
      // ANONYMOUS patron session — created by visiting the patron app, persisted
      // under the shared gl-auth key (D-017) — is NOT an owner, so it must still
      // see OwnerSignIn (else /business shows "No program" with no way to log in).
      const isAnon =
        session?.user?.is_anonymous ??
        session?.user?.app_metadata?.provider === "anonymous";
      if (!session || isAnon) {
        setNeedsAuth(true);
        setBusiness(null);
        return;
      }
      setNeedsAuth(false);

      // Oldest business = "theirs" when fixtures/dev give an owner several
      // (mirrors get_business_regulars' resolution); production owners have one.
      const { data, error: qErr } = await supabase
        .from("businesses")
        .select("*, town:towns(name, slug), perks(*)")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (qErr) throw qErr;
      // Signed in but no business rows (e.g. a patron session): honest null —
      // BusinessApp points to /business/signup.
      setBusiness(fromRow(data));
    } catch (err) {
      setError(err);
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { business, loading, error, needsAuth, reload: load };
}
