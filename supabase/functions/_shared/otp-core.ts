// ============================================================
// otp-core.ts — pure-ish helpers for the claim-passport edge fn (T029).
//
// Kept framework-free so it is unit-testable and the runtime shell stays thin.
// ============================================================

/** Generate a zero-padded 6-digit OTP as a string. */
export function generateOtp(rng: () => number = Math.random): string {
  return String(Math.floor(rng() * 1_000_000)).padStart(6, "0");
}

/** Minimal E.164 check (leading +, 2–15 digits, no leading zero). */
export function isE164(phone: unknown): phone is string {
  return typeof phone === "string" && /^\+[1-9]\d{1,14}$/.test(phone);
}

/**
 * Whether OTP delivery may expose the dev code in the HTTP response.
 * FAIL-CLOSED (security review 2026-06-06): requires BOTH an explicitly
 * non-production environment AND the dedicated EXPOSE_DEV_OTP=1 opt-in.
 * An unset environment is treated as production. Real deployments deliver
 * OTPs only via the messaging provider; local dev opts in deliberately.
 */
export function devOtpAllowed(
  environment: string | undefined,
  exposeFlag: string | undefined,
): boolean {
  const env = environment ?? "production"; // unset = assume production
  const envIsLocal = env === "development" || env === "local";
  return envIsLocal && exposeFlag === "1";
}
