import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";

// ---------------------------------------------------------------------------
// Env. Keys come from the running local stack:
//   supabase status -o env       # exports ANON_KEY / SERVICE_ROLE_KEY / API_URL
// JSON fallback (scripting): supabase status -o json | jq -r '.ANON_KEY'
// We accept BOTH the unprefixed CLI names (ANON_KEY, SERVICE_ROLE_KEY, API_URL)
// and the SUPABASE_*-prefixed convention, so either export style works.
// dotenv is imported so a .env file at the repo root is honored if present.
// ---------------------------------------------------------------------------
function firstEnv(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return undefined;
}

function requireEnv(label: string, ...names: string[]): string {
  const value = firstEnv(...names);
  if (!value) {
    throw new Error(
      `Missing ${label}. Run \`supabase status -o env\` and export the keys ` +
        `(one of: ${names.join(", ")}).`,
    );
  }
  return value;
}

const SUPABASE_URL =
  firstEnv("SUPABASE_URL", "API_URL") ?? "http://127.0.0.1:54321";

const ANON_KEY = () => requireEnv("anon key", "SUPABASE_ANON_KEY", "ANON_KEY");
const SERVICE_ROLE_KEY = () =>
  requireEnv("service-role key", "SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY");

// ---------------------------------------------------------------------------
// Seeded fixture ids/constants — must match supabase/seed/seed.sql.
// ---------------------------------------------------------------------------
export const SEED = {
  regionId: "00000000-0000-0000-0000-000000000001",
  regionSlug: "upper-delaware",
  businessId: "00000000-0000-0000-0000-0000000000b1", // The Heron
  businessSlug: "the-heron",
  codeValue: "demo-heron-code-v1",
  ownerUserId: "00000000-0000-0000-0000-0000000000a1", // mira
  adminUserId: "00000000-0000-0000-0000-0000000000ad",
  ownerEmail: "mira@theheron.test",
  adminEmail: "admin@goodlocal.test",
} as const;

// Per-user test passwords (idempotently applied by ensureSeedAuthPasswords).
export const PASSWORDS = {
  [SEED.ownerEmail]: "test-password-mira",
  [SEED.adminEmail]: "test-password-admin",
} as const;

// ---------------------------------------------------------------------------
// Clients.
// ---------------------------------------------------------------------------
function makeClient(key: string): SupabaseClient {
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Service-role client: bypasses RLS. Use only to arrange fixtures / assert. */
export function serviceClient(): SupabaseClient {
  return makeClient(SERVICE_ROLE_KEY());
}

function anonClient(): SupabaseClient {
  return makeClient(ANON_KEY());
}

/** Anonymous patron session (createClient + signInAnonymously). */
export async function anonPatronClient(): Promise<{ client: SupabaseClient; userId: string }> {
  const client = anonClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw new Error(`signInAnonymously failed: ${error?.message}`);
  return { client, userId: data.user.id };
}

/**
 * Idempotently set passwords on the two seeded auth users via the service-role
 * admin API. The seed inserts these users without a password; tests sign in by
 * password, so this bootstrap must run first. Safe to call repeatedly.
 */
export async function ensureSeedAuthPasswords(): Promise<void> {
  const admin = serviceClient();
  for (const [userId, email] of [
    [SEED.ownerUserId, SEED.ownerEmail],
    [SEED.adminUserId, SEED.adminEmail],
  ] as const) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: PASSWORDS[email],
      email_confirm: true,
    });
    if (error) {
      throw new Error(`ensureSeedAuthPasswords(${email}) failed: ${error.message}`);
    }
  }
}

async function signInByPassword(email: string, password: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(
      `signInWithPassword(${email}) failed: ${error.message}. ` +
        `Did you call ensureSeedAuthPasswords() first?`,
    );
  }
  return client;
}

/** Owner session (defaults to seeded mira@theheron.test). */
export function ownerClient(email: string = SEED.ownerEmail): Promise<SupabaseClient> {
  const password = (PASSWORDS as Record<string, string>)[email];
  if (!password) throw new Error(`No known test password for owner ${email}`);
  return signInByPassword(email, password);
}

/** Admin session: seeded admin@goodlocal.test (app_metadata.role=admin). */
export function adminClient(): Promise<SupabaseClient> {
  return signInByPassword(SEED.adminEmail, PASSWORDS[SEED.adminEmail]);
}

// Backwards-compatible alias for earlier scaffolding.
export const DEMO = SEED;
