// ============================================================
// error-seam.test.ts — the client error contract survives the seam
// (audit API-001 regression guard).
//
// RPCs raise `errcode P0001` with MESSAGE = the §7 code, which PostgREST
// surfaces as { code: "P0001", message: "STAFF_RATE_LIMITED" }. The seam
// must map that back to a branchable §7 code — before this fix, every RPC
// business error collapsed to the generic VALIDATION fallback and the
// per-code UI copy never rendered.
// ============================================================
import { describe, it, expect } from "vitest";
import { toApiError, ApiError, ERROR_CODES } from "../../app/src/lib/errors.js";

describe("toApiError — PostgREST P0001 shape (message carries the code)", () => {
  it.each([
    "STAFF_RATE_LIMITED",
    "PERK_NOT_READY",
    "STAMP_CODE_TAKEN",
    "OUTSIDE_WINTER_WINDOW",
    "DAILY_LIMIT",
    "CODE_RETIRED",
    "FORBIDDEN",
    "RATE_LIMITED",
  ])("maps { code: 'P0001', message: '%s' } to its §7 code", (code) => {
    const err = toApiError({ code: "P0001", message: code });
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe(code);
  });

  it("tolerates whitespace around the code", () => {
    expect(toApiError({ code: "P0001", message: " PERK_NOT_FOUND " }).code).toBe("PERK_NOT_FOUND");
  });
});

describe("toApiError — §1.2 envelope", () => {
  it("passes the envelope code through", () => {
    const err = toApiError({ error: { code: "DUPLICATE_PENDING", message: "x", details: { id: 1 } } });
    expect(err.code).toBe("DUPLICATE_PENDING");
    expect(err.details).toEqual({ id: 1 });
  });

  it("maps the SMS_UNAVAILABLE envelope (claim-passport no-provider path)", () => {
    const err = toApiError({ error: { code: "SMS_UNAVAILABLE", message: "no messaging provider configured" } });
    expect(err.code).toBe("SMS_UNAVAILABLE");
    expect(ERROR_CODES.SMS_UNAVAILABLE.httpish).toBe(503);
  });
});

describe("toApiError — fallbacks stay intact", () => {
  it("maps the per-day unique violation to DAILY_LIMIT", () => {
    const err = toApiError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "stamps_patron_business_day"',
    });
    expect(err.code).toBe("DAILY_LIMIT");
  });

  it("falls back to VALIDATION for arbitrary messages (never leaks unknown codes)", () => {
    const err = toApiError({ message: "TypeError: Failed to fetch" });
    expect(err.code).toBe("VALIDATION");
  });

  it("does not treat a §7-code SUBSTRING as a code", () => {
    const err = toApiError({ message: "RATE_LIMITED: too many requests from this address" });
    expect(err.code).toBe("VALIDATION");
  });
});
