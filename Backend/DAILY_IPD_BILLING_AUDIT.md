# Daily IPD room/bed billing audit and implementation

## Audit result: partially implemented before this change

Existing functions in `hms-backend/src/modules/admission/admission.service.ts`:
- `postInitialRoomChargeIfApplicable`: initial room tariff line, previously called at PLANNED intake and check-in.
- `closeHospitalDay`: manual daily posting, with a hospital-wide closed-date gate.
- `recalcInvoiceTotals`: recalculates existing invoice lines without overwriting paidTotal.
- `transferBed`: preserves BedTransferHistory and atomically changes occupancy.
- `reconcileAdmissionDischarge` / `dischargePatient`: stop ACTIVE status and release the bed.
- `postWardFixedChargeIfApplicable`: separate existing one-time ward fee; preserved.

Existing Prisma `AdmissionRoomChargeLog` has a PostgreSQL UNIQUE(admission_record_id, business_date) constraint and a unique invoice-line reference. The invoice line already has ROOM_BED, rateSnapshot, gross/net amounts, createdAt and panel split. No new invoice engine was needed.

Missing/incorrect:
- No Vercel cron configuration or scheduled room posting endpoint.
- dayCloseTime was informational, not an enforced posting time.
- Initial and manual billing used UTC dates.
- Front-desk intake uses PLANNED status even though it occupies the selected bed and creates an invoice. Initial billing must support this assigned-intake workflow.
- Whole-day closure prevented safe retry for admissions previously skipped.
- Daily logs lacked assignment, room, bed and posting-actor snapshots.
- Transfers into a first billable room did not immediately post.
- Daily ledger dates used creation timestamps and generic descriptions.

## Implemented behavior

A single shared posting function now serves assigned front-desk intake, successful check-in, first billable transfer and scheduled/manual daily posting. Assigned intake explicitly permits PLANNED status because that workflow already occupies the bed; scheduled billing remains ACTIVE-only. ACTIVE status and assigned bed are rechecked under a PostgreSQL admission row lock. Charge line, audit log and invoice totals commit together; the database unique key prevents concurrent/retried duplicate daily charges.

The dedicated log table only permits chargeType ROOM_BED_DAILY (SQL CHECK constraint). Thus the existing stronger admission/date key implements the business key admission + billingDate + ROOM_BED_DAILY. Ward fixed fees remain separate and do not consume this daily key.

Only the existing ADMISSION invoice is used; the daily engine never creates an invoice. A missing invoice is reported as an error for repair. Invoice locking and rereading obtain current paidTotal and lines before recomputation. Payment receipts and paidTotal are not overwritten.

Tariff is the actual assigned Room.dailyRoomRate. Existing setup deliberately disables independent Bed.dailyRate, and direct ward beds without a priced room remain nonbillable daily. The optional legacy ROOM-ACC lookup preserves existing panel coverage contracts; no service master row is created and no service master price is used.

Room/bed names and identifiers, assignment reference, billing date, posted actor and daily rate are recorded with the linked financial line. First assignment uses the stable reference admissionId:initial:bedId where there is no transfer-history row; transfers use their BedTransferHistory ID. Historical rows retain null new metadata rather than inventing history. The existing createdAt is postedAt, ratePosted is dailyRateSnapshot, and the linked line stores amount and ROOM_BED source.

Ledger API returns these snapshots and uses businessDate. Descriptions include room, bed and billing date. Frontend mapping retains accommodation metadata; daily lines remain separate.

## Transfer and discharge policy

Preserved current behavior: one full daily charge, using the current room at posting time. A transfer does not replace an already posted rate or create a second charge. The next day's scheduled posting uses the current room rate. No proration, retrospective rate replacement or additional discharge-day fee was introduced.

A first billable transfer posts immediately only when there has never been an accommodation charge. Later transfers wait for scheduled posting. Only ACTIVE admissions are billed; DISCHARGE_PENDING and DISCHARGED are excluded, matching the old manual engine. A patient discharged at 09:00 receives no 11:00 charge.

The repository contains no separate formally approved proration/occupied-DISCHARGE_PENDING policy. Any change to those rules requires a hospital decision. Past missed days are not automatically reconstructed from today's tariff. Manual recovery only accepts today's Karachi date.

Existing panel authorization and historical payer-reconciliation checks are retained. They can block a charge; the scheduler reports incomplete processing and retries on later invocations rather than silently closing the date.

## Configuration and scheduler

Hospital Overview setting: **IPD Daily Room/Bed Charge Posting Time**, persisted as extendedProfile.ipdDailyRoomBedPostingTime. Accepts HH:mm or hh:mm AM/PM, defaults visibly to 11:00 AM. Operational timezone is always Asia/Karachi.

Backend vercel.json invokes GET /api/cron/ipd-room-charges every minute. Handler requires Authorization: Bearer CRON_SECRET, fails closed when secret is absent, and returns no-store responses. Vercel supplies this header when CRON_SECRET is configured.

Before the posting time it skips. Afterwards it finds ACTIVE admissions with a priced room and no log for today. Each admission has its own transaction, so a failure does not undo successful admissions. No in-memory timer exists. A 240-second processing budget leaves room within the 300-second function limit; committed entries survive a timeout and the next run selects missing entries.

Minute-frequency Vercel Cron requires Pro/Enterprise. Hobby only supports daily runs and does not meet this configurable-time/retry requirement:
https://vercel.com/docs/cron-jobs/usage-and-pricing
https://vercel.com/docs/cron-jobs/manage-cron-jobs

## Database and activation

Migration: prisma/migrations/202610150001_daily_ipd_room_billing/migration.sql.
Adds nullable assignment/location/name/actor snapshots and fixed charge_type to admission_room_charge_log. Existing financial amounts, date uniqueness and historical entries remain unchanged.

Deployment steps:
1. Resolve existing application build/typecheck errors listed below.
2. Apply migration against the intended database with npm run prisma:migrate:deploy.
3. Generate Prisma client in a clean build environment.
4. Configure CRON_SECRET and IPD_BILLING_SYSTEM_ACTOR_ID (the ID of a dedicated existing PortalUser for billing audit attribution).
5. Deploy the backend on a plan supporting minute cron, deploy frontend, save the hospital posting time, and verify invocation logs.

No migration or deployment was performed against a live hospital database. Live PostgreSQL concurrency and browser/Vercel execution were not exercised. Review any old UTC-dated initial entries near Karachi midnight during rollout; this migration does not relabel historical charges.

## Validation

Focused tests: **72 passed across five files**, including:
- ADM-1001, PKR 500 on Oct 15 immediately at check-in.
- Same-day cron does not duplicate.
- Oct 16 before 11:00 skips; 11:00 plus three retries yields only one additional line.
- Oct 17 total PKR 1,500; paid PKR 1,000 unchanged; outstanding PKR 500.
- Discharged admission is not billed.
- Changed rate preserves prior snapshots.
- Transfer retains history and waits for the next posting time; first billable transfer posts immediately.
- Karachi midnight conversion, posting-time parsing and invalid-date rejection.

Prisma schema validation: passed.
Broader suite run (before the final two added transfer tests): 372 passed, 23 failed, 3 skipped.
Remaining failures: admissionEstimate (3), commissionBlueprint (1), phase5_admission (18), phase6_inventory_pharmacy (1), involving existing assumptions/missing mocks and unrelated payroll/inventory behavior.

Backend typecheck reports device-attendance errors in devices.controller.ts and devices.service.ts. Frontend typecheck reports missing AttendanceRecord.lateMinutes in SuperAdminAttendanceView.tsx. No billing-file type errors remained on the checked revision.

Prisma generation reached a Windows EPERM query-engine DLL replacement error, including an elevated retry. Generated schema types were available for checking, but a clean full generation is required for deployment.

## Files changed

Backend:
- src/modules/admission/admission.service.ts
- src/modules/frontdesk/admissionBilling.service.ts
- src/shared/hospitalClock.ts
- src/modules/setup/setup.schemas.ts
- src/modules/setup/setup.service.ts
- src/app.ts
- prisma/schema.prisma
- prisma/migrations/202610150001_daily_ipd_room_billing/migration.sql
- vercel.json
- .env.example

Frontend (ch-sharif-and-saeed-hospital---hms):
- src/types/hospital.ts
- src/services/admissionBillingService.ts
- src/features/superAdmin/hospitalOverview/EditHospitalProfileModal.tsx
- src/features/superAdmin/hospitalOverview/HospitalOperationsSection.tsx
- src/features/superAdmin/hospitalOverview/RoomChargeDayCloseSection.tsx

Tests:
- tests/dailyIpdRoomBilling.test.ts (new)
- tests/accommodationPricing.test.ts
- tests/admissionRoomFulfillment.test.ts
- tests/admissionTransfer.test.ts
- tests/phase5_admission.test.ts (row-lock mock)

- tests/serviceSourcesDatabase.test.ts (clock injection and scoped admission query for opt-in DB test)

## Follow-up correction
The initial implementation deferred assigned-intake room charges until check-in, which omitted room charges from the immediate front-desk invoice. Corrected to post at assigned intake through the same date-idempotent helper. The 72 focused tests pass after this correction. Existing invoices missing the initial charge are not automatically repaired by this code change.

## Local database repair
Applied 202610150001_daily_ipd_room_billing directly to localhost:5432/chss_hms after confirming all seven new columns were absent, then marked that migration applied. Other historical migrations have incomplete tracking and were not executed. Verified AdmissionRoomChargeLog.findFirst succeeds and the admission/date unique index remains present. This updates the local database only; cloud deployment remains separate.
