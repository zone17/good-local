// ============================================================
// otp-core.test.ts — unit tests for the claim-passport helpers (audit TEST-002).
//
// otp-core was purpose-built framework-free for exactly these tests; the
// fail-closed matrix on devOtpAllowed is security-relevant (a regression
// would leak live OTPs in production HTTP responses).
// ============================================================
import { describe, it, expect } from "vitest";
import { generateOtp, isE164, devOtpAllowed } from "../../supabase/functions/_shared/otp-core";

describe("generateOtp", () => {
  it("zero-pads to six digits at the low boundary", () => {
    expect(generateOtp(() => 0)).toBe("000000");
  });

  it("stays within six digits at the high boundary", () => {
    expect(generateOtp(() => 0.9999999)).toBe("999999");
  });

  it("produces only 6-digit strings across the range", () => {
    for (const r of [0, 0.1, 0.25, 0.5, 0.123456, 0.999999]) {
      const otp = generateOtp(() => r);
      expect(otp).toMatch(/^\d{6}$/);
    }
  });
});

describe("isE164", () => {
  it.each([
    "+18455550142",
    "+12025550100",
    "+447911123456",
    "+861012345678",
  ])("accepts %s", (phone) => {
    expect(isE164(phone)).toBe(true);
  });

  it.each([
    ["missing plus", "18455550142"],
    ["leading zero after plus", "+08455550142"],
    ["too long (16 digits)", "+1845555014212345"],
    ["single digit", "+1"],
    ["letters", "+1845555O142"],
    ["spaces", "+1 845 555 0142"],
    ["empty string", ""],
  ])("rejects %s", (_label, phone) => {
    expect(isE164(phone)).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(isE164(null)).toBe(false);
    expect(isE164(undefined)).toBe(false);
    expect(isE164(18455550142)).toBe(false);
    expect(isE164({})).toBe(false);
  });
});

describe("devOtpAllowed (fail-closed matrix)", () => {
  it("allows only an explicit local env AND the explicit =1 opt-in", () => {
    expect(devOtpAllowed("development", "1")).toBe(true);
    expect(devOtpAllowed("local", "1")).toBe(true);
  });

  it.each([
    ["unset env = production", undefined, "1"],
    ["production env", "production", "1"],
    ["staging env", "staging", "1"],
    ["local env without flag", "local", undefined],
    ["local env with wrong flag value", "local", "true"],
    ["local env with empty flag", "development", ""],
    ["both unset", undefined, undefined],
  ])("fails closed: %s", (_label, env, flag) => {
    expect(devOtpAllowed(env, flag)).toBe(false);
  });
});
