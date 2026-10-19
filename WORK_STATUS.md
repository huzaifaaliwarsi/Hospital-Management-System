# Remaining fixes — paused 2026-10-19 at user request

User requested work in order: payments, security, discharge, pharmacy safety,
sync, accounts/history, then failing tests/reports/settings. User subsequently
asked to stop within two minutes. No deployment or database migration was run.

## Changes made this session

- Admission collection now persists a receipt for each allocation; only the
  actual advance is unlinked. Previously a split receipt could be credited twice.
- Payment-request collection reuses the admission transaction, links admission,
  invoice and request, and sends Pharmacy collection notifications after commit.
- Reject duplicate invoice allocations and payments after discharge/cancellation.
- Added transaction locks to admission/request collection and HMS cashier settlement.
- Invoice collection cannot allocate Pharmacy credit across unrelated admissions.
- Dispense callback credits already linked advances as well as unlinked deposits.
- Both bridge middleware implementations require the integration secret; ordinary
  sessions cannot submit callbacks. Bridge identities cannot use role-authorized
  application routes. HMS now applies forced-password-reset middleware globally.
- Discharge reconciliation checks actual pending requests and unpaid medicine
  charges, includes reversal amounts in the net receipts, and no longer permits
  the alternate final-discharge path to bypass reconciliation. Manual Pharmacy
  clearance also checks pending/unpaid records.
- Inventory supplier/item deletion deactivates master records and retains history.
- Pharmacy stock allocation takes a transaction lock and retail repeated medicine
  lines reserve quantities; negative adjustments validate stock and batch ownership.
  Retail payment collection takes an invoice lock. Broader Pharmacy safety is unfinished.
- Fixed a setup code-parser TypeScript error and removed an unused import.

## Verification

- HMS backend typecheck: PASS.
- Pharmacy backend typecheck: PASS.
- 22 focused tests PASS: admissionPaymentLink, admissionAdditionalPayment,
  paymentSafetyGates.
- Pharmacy advance DB tests now cover both linked and unlinked deposits, but
  these two tests were SKIPPED (RUN_SERVICE_DB_TESTS not enabled).
- Original full-suite baseline: 14 files failed, 14 passed, 3 skipped;
  23 tests failed, 244 passed, 3 skipped, plus suite/import failures.
  Many old mocks lack current Prisma methods. Full suite has not been rerun
  after the last changes; do not claim all tests pass.

## Next work / known gaps

1. Finish payment reconciliation: historical split/unlinked receipts need a
   read-only audit before any repair. Existing unallocated credit should be
   reconciled before another collection. Panel Pharmacy responsibility and
   refunds need consistent recalculation. Notifications still lack durable retry.
2. Verify security end to end, including revoked/disabled sessions, scope of
   cash routes, and all integration callers after bridge restriction.
3. Update getClearances/readiness reporting to match the new actual discharge
   gates; ensure request creation/dispense/discharge share compatible locks.
4. Finish Pharmacy safety: duplicate refunds and cumulative returned quantities
   are NOT fixed. No returns schema or migration was added. HMS fulfillment still
   validates stale request data outside its transaction and does not pass its
   pending stock deductions into allocateFefoBatches. Check all other stock-out
   paths and concurrent payment/refund paths.
5. Partial dispensing/rejection sync remains unfinished. HMS callback currently
   deduplicates on request reference as well as event ID and marks requests
   DISPENSED too broadly. Pharmacy rejection has no HMS callback. Collection
   callback is additive and lacks receipt deduplication. Add reliable retries.
6. Accounts: only HMS cashier submission lock added. Pharmacy settlements and
   cross-system settlement release/retry/idempotency remain to be fixed.
7. Run meaningful regression/concurrency/integration tests; fix original failing
   tests; inspect reports and incomplete settings. No full UI verification done.

Existing user changes were present before work; additional unrelated workspace
changes appeared during the session. Preserve them. Do not reset whole files or
assume every item in git diff belongs to this task.
