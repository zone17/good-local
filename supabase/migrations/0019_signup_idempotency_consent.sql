-- ============================================================
-- 0019_signup_idempotency_consent.sql — spec 002-launch-hardening, wave 2.
--
-- (a) Signup idempotency (audit API-002 / ERR-010): the checkout edge fn
--     persists its idempotency key on the pending business row so a retry
--     with the same key returns the original outcome instead of dead-ending
--     on DUPLICATE_PENDING, and an abandoned checkout can be resumed.
-- (b) SMS consent record (audit COMP-003 / spec FR-007): when a patron
--     completes an OTP claim they have agreed, at the input, to receive a
--     one time text; the claim flow stamps when and where that consent was
--     given. Columns are service-role written; no app-role policy changes.
-- ============================================================

-- (a) signup idempotency
alter table businesses add column if not exists signup_idempotency_key text;

create unique index if not exists businesses_signup_idem_key
  on businesses (signup_idempotency_key)
  where signup_idempotency_key is not null;

-- (b) SMS consent
alter table patrons add column if not exists sms_consent_at timestamptz;
alter table patrons add column if not exists sms_consent_source text;
