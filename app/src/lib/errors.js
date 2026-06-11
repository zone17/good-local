// ============================================================
// errors.js — the structured error contract (contracts §1.2, §7).
//
// Every failure crosses the seam as an ApiError carrying a stable
// UPPER_SNAKE `code`. Clients branch on `code`, never on `message`
// (message is log-safe, not user copy). `details` carries optional
// structured context (e.g. conflicting id, retry-after).
// ============================================================

/**
 * The full §7 code table: code → { httpish, meaning }.
 * `httpish` is the HTTP-ish status semantic; `meaning` is the §7 description.
 * @type {Readonly<Record<string, { httpish: number, meaning: string }>>}
 */
export const ERROR_CODES = Object.freeze({
  CODE_RETIRED: { httpish: 409, meaning: "scanned code is rotated-out; not counted; business flagged for reprint" },
  CODE_INVALID: { httpish: 422, meaning: "code value matches no current/grace code" },
  DAILY_LIMIT: { httpish: 409, meaning: "one stamp per patron per business per day already used" },
  BUSINESS_SUSPENDED: { httpish: 423, meaning: "business billing suspended; no new check-ins" },
  BUSINESS_NOT_FOUND: { httpish: 404, meaning: "no business for slug/id" },
  REGION_NOT_FOUND: { httpish: 404, meaning: "region missing/misconfigured" },
  OTP_INVALID: { httpish: 422, meaning: "OTP wrong or already consumed" },
  OTP_EXPIRED: { httpish: 410, meaning: "OTP window elapsed" },
  PHONE_INVALID: { httpish: 422, meaning: "phone not valid E.164" },
  DEVICE_ALREADY_LINKED: { httpish: 409, meaning: "device already on this identity" },
  STAMP_CODE_TAKEN: { httpish: 409, meaning: "stamp code not unique for business" },
  PERK_NOT_FOUND: { httpish: 404, meaning: "no such perk for this business" },
  PERK_NOT_READY: { httpish: 409, meaning: "patron not at threshold / already redeemed this cycle" },
  STAFF_RATE_LIMITED: { httpish: 429, meaning: "staff-entry per-business-per-day limit hit" },
  RATE_LIMITED: { httpish: 429, meaning: "generic rate limit (OTP sends, etc.)" },
  OUTSIDE_WINTER_WINDOW: { httpish: 409, meaning: "winter tier not selectable outside Nov–Apr" },
  STRIPE_ERROR: { httpish: 502, meaning: "upstream Stripe failure" },
  INVALID_STATE: { httpish: 409, meaning: "state transition not allowed (e.g., approve non-pending)" },
  DUPLICATE_PENDING: { httpish: 409, meaning: "a pending signup for this establishment exists" },
  STAMP_NOT_FOUND: { httpish: 404, meaning: "no such stamp to void" },
  VALIDATION: { httpish: 422, meaning: "a request field failed validation (details lists fields)" },
  UNAUTHENTICATED: { httpish: 401, meaning: "no/invalid session for required context" },
  FORBIDDEN: { httpish: 403, meaning: "authenticated but wrong context / out-of-RLS-scope" },
  SMS_UNAVAILABLE: { httpish: 503, meaning: "no SMS provider configured/reachable; claiming by text unavailable" },
});

/**
 * Normalized application error. Always carries a §7 `code`; `details`
 * is optional structured context for the client.
 */
export class ApiError extends Error {
  /**
   * @param {string} code     a §7 code (UPPER_SNAKE)
   * @param {string} [message] log-safe message (not user copy)
   * @param {object|null} [details] optional structured context
   */
  constructor(code, message, details = null) {
    super(message || (ERROR_CODES[code]?.meaning ?? code));
    this.name = "ApiError";
    /** @type {string} */
    this.code = code;
    /** @type {object|null} */
    this.details = details;
  }
}

/**
 * Normalize anything thrown across the seam into an ApiError.
 *
 * Handles three shapes:
 *   1. The §1.2 envelope: { error: { code, message, details } } — passed through.
 *   2. A Postgres/PostgREST error: maps the unique-violation on the per-day
 *      stamp constraint to DAILY_LIMIT (§1.3); otherwise uses any `code` the
 *      payload already carries.
 *   3. Anything else — generic VALIDATION fallback preserving the original
 *      message. STRIPE_ERROR is never inferred (only edge functions surface it
 *      explicitly via the envelope).
 *
 * @param {unknown} err
 * @returns {ApiError}
 */
export function toApiError(err) {
  if (err instanceof ApiError) return err;

  // 1. Structured envelope: { error: { code, message, details } }
  const envelope = err && typeof err === "object" && /** @type {any} */ (err).error;
  if (envelope && typeof envelope === "object" && typeof envelope.code === "string") {
    return new ApiError(envelope.code, envelope.message, envelope.details ?? null);
  }

  // 2. Postgres / PostgREST error object.
  const e = /** @type {any} */ (err) || {};
  const message = e.message || e.msg || (typeof err === "string" ? err : "Request failed");

  // RPCs raise `errcode P0001` with MESSAGE = the §7 code, which PostgREST
  // surfaces as { code: "P0001", message: "STAFF_RATE_LIMITED" }. The code
  // travels in the message — map it back so clients can branch on it
  // (audit API-001: without this, every RPC error collapsed to VALIDATION).
  const messageCode = typeof message === "string" ? message.trim() : "";
  if (Object.prototype.hasOwnProperty.call(ERROR_CODES, messageCode)) {
    return new ApiError(messageCode, message, e.details ?? null);
  }
  const haystack = `${message} ${e.details || ""} ${e.constraint || ""} ${e.hint || ""}`.toLowerCase();

  // Unique violation on the per-day stamp constraint → DAILY_LIMIT (§1.3).
  // Postgres SQLSTATE 23505 = unique_violation.
  const isUniqueViolation =
    e.code === "23505" || haystack.includes("duplicate key") || haystack.includes("unique constraint");
  if (
    isUniqueViolation &&
    (haystack.includes("daily") ||
      haystack.includes("per_day") ||
      haystack.includes("one_stamp_per_day") ||
      haystack.includes("stamps_patron_business_day"))
  ) {
    return new ApiError("DAILY_LIMIT", message, e.details ?? null);
  }

  // Pass through a §7 code the payload already carries.
  if (typeof e.code === "string" && Object.prototype.hasOwnProperty.call(ERROR_CODES, e.code)) {
    return new ApiError(e.code, message, e.details ?? null);
  }

  // 3. Generic fallback — preserve the original message; never infer STRIPE_ERROR.
  return new ApiError("VALIDATION", message, e.details ?? null);
}
