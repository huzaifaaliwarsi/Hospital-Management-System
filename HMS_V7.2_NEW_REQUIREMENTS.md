# HMS v7.2 — New Requirements & Gap Analysis

## Resume Prompt for Next Session
_(paste this verbatim to continue exactly where 2026-09-15 session 8 left off)_

> Continue the HMS v7.2 work per `HMS_V7.2_NEW_REQUIREMENTS.md`. **Front Desk portal is now 13/13 nav items real — Panel Billing shipped in session 8, closing out the portal.** No Front Desk nav item falls through to `ModulePlaceholderView` anymore. Super Admin's v7.2 slice (§3.1) and §2.2 Department Sub-Invoice Split (session 7) remain done as before. **Panel Billing (session 8):** new `PanelRemittance`/`PanelRemittanceAllocation` models (migration `20260915105116_v72_panel_remittance`, additive-only, generated via the safe static-diff procedure — no live-DB shadow connection), new `frontdesk/panelBilling.*` backend module (`GET /panel-billing/verify/:panelPatientId`, `GET /panel-billing/contract-resolution`, `GET /panel-billing/panels/:id/statement`, `POST/GET /panel-billing/panels/:id/remittances`), reusing the existing `resolvePanelCoverage()` helper and the same allocation algorithm as `admissionBilling.collectPayment` (explicit-sum-must-match-exactly or auto-proportional with largest-remainder rounding). Frontend: `services/panelBillingService.ts` + `features/frontDesk/panelBilling/` (`PanelBillingView` with Verification/Contract-Resolution, Interim Statement, and Remittance-history tabs behind a Corporate Panel selector, `RecordPanelRemittanceModal`). **A real correctness bug was found and fixed along the way:** `admission.service.ts`'s `createPlannedAdmission` had zero active-membership validation for `panelPatientId` (unlike `appointments.service.ts`'s `bookAppointment`, which already had it) — fixed by mirroring the existing check; live-verified the fix actually blocks admission creation against an inactive panel patient (404 `Panel patient not found or inactive`). **Bounded cleanup pass done alongside:** centralized the `toErrorMessage` helper (previously redefined verbatim in 4 service files) into `utils/apiErrors.ts`; fixed `InvoiceDetailModal.tsx`'s local `useState` toast anti-pattern to use the real `useToast()` context (matching its sibling `AdmissionStatementModal.tsx`); formalized the repeated inline `bg-purple-100 text-purple-800` "Panel" badge convention (6 call sites across `AppointmentsView`/`AdmissionPaymentRequestsView`/`NewAdmissionView`) into one shared `components/common/PanelBadge.tsx`. Explicitly left alone (documented, not silently skipped): the 3 per-file `STATUS_BADGE` maps (genuinely different vocabularies, not true duplication) and the ~10 files' hand-rolled loading/error blocks that don't yet use `StateViews.tsx` (all already live-verified working code — new Panel Billing screens use `StateViews.tsx` from the start instead, as the better direction going forward). 72/72 backend tests passing (12 new this session), `tsc --noEmit` + `npm run build` clean both sides. **Live-verified end-to-end against the real dev DB** (frontdesk-role account, not just mocked tests): created an active EFU Life Health panel patient, verified membership, resolved an 80%-coverage contract (PKR 1,500 → 300 patient share / 1,200 panel receivable, matches Worked Example 7's shape), booked+checked-in a real appointment producing a `HospitalInvoice` with `panelReceivable=1200`, fetched the Interim Statement (realized 0 / outstanding 1200), recorded a PKR 700 remittance with auto-allocation, re-fetched the statement (realized 700 / outstanding 500, sums exactly), confirmed an over-allocation (PKR 10,000) is correctly rejected, and confirmed the cashier's cash balance sheet stayed untouched (panel remittance is a separate B2B ledger, never patient cash). **No browser click-through this session** (Chrome extension previously declined, same limitation as session 5) — confidence rests on the live curl verification above plus tests/tsc/build, not a manual UI pass. **Standing safety rule (still in force):** never point `prisma migrate diff`'s `--shadow-database-url` at a database with real data — use `--from-schema-datamodel <old-schema-copy>`/`--to-schema-datamodel <new-schema>` (pure static file diff, zero DB connection) instead. **Next natural work, not yet started:** a real browser click-through of Panel Billing when Chrome access is available; the Admin/Super Admin *review* side of Provider Settlements and Account Settlements; §2.4 Doctor Clinical Discharge Authorization + Discharge Summary (Admission portal); §2.6 High-Cost Medicine Authorization Policy; §2.7 Salary/Commission Tax UI on the Admin portal's Doctor Tax screen — ask the user which to prioritize.

## Progress Log
_(most recent first)_

- **2026-09-15 (session 8) — Panel Billing built end-to-end, completing the Front Desk portal to 13/13 nav items; one real pre-existing bug found and fixed; bounded Front Desk code-cleanliness pass.** See the Resume Prompt above for full detail (schema, backend module, frontend, the `admission.service.ts` panel-membership bug fix, the cleanup scope, and the live curl verification steps) — not duplicated here to avoid drift between the two.

- **2026-09-15 (session 7) — §2.2 Department Sub-Invoice Split implemented, tested, and live-verified; Panel Billing's design questions resolved by re-reading the source PDFs directly.**
  - **Design resolution (grounded in the actual client PDFs, not guessed):** re-read `13 Department Billing Split and Settlement.pdf` and `16 Panel Patient Complete Flow.pdf` in full. Confirmed §2.2's open question — "is a Department Invoice a literal new row per (admission × department)?" — is **yes, literal**: the PDF's own PKR 50,000 worked example splits one patient's bill into 3 independently-owned invoice rows (Hospital Services/Laboratory/Pharmacy), each with its own gross/discount/net, never merged. This is also why Panel Billing was correctly deferred (user's own call, confirmed by the PDF): its Interim Statement, Contract Resolution and Provider Settlement are all explicitly per-department in the source spec, so none of it can be built correctly before §2.2 exists.
  - **Backend — `admission.service.ts`:** `addAdmissionService` now resolves the posted service's own `departmentId` first, then finds-or-creates the `HospitalInvoice` for `(admissionRecordId, departmentId)` — a Lab/Radiology service posted against a General-Medicine admission bills to its own Lab/Radiology invoice, never the admitting department's. `checkInAdmission`'s seed invoice is now tagged with the admission's own department. No new model — reuses `HospitalInvoice`'s existing `admissionRecordId` (already one-to-many) + `departmentId` (added for Appointments in session 5).
  - **`shared/panelCoverage.ts`** 🆕 — extracted the Panel Service-tier coverage-resolution logic (previously duplicated inline in `appointments.service.ts`) into one shared helper; `admission.service.ts` now uses the same logic, so Appointments and Admission billing can never drift apart on Patient Share / Panel Receivable math. `InvoiceLineItem` gained `patientShare`/`panelReceivable` (additive) so a multi-line department invoice can sum them per line, same pattern as `lineGross`/`discountAmount`.
  - **`frontdesk/admissionBilling.{schemas,service,controller,routes}.ts`** 🆕, mounted at `/api/v1/admission-billing` — `GET /:id/statement` (Running Bill / Interim Statement, §2.10: every department invoice for the admission plus a display-only consolidated sum, explicitly marked `isNotFinalDischargeInvoice`) and `POST /:id/collect-payment` (Payment Allocation, §2.11: one physical collection split across N department invoices — explicit `allocations` array, or auto-proportional-to-outstanding with largest-remainder rounding so the split always sums exactly to the collected amount; rejects an amount exceeding total outstanding rather than silently discarding the excess).
  - **Frontend:** `services/admissionBillingService.ts`, `features/frontDesk/billing/AdmissionStatementModal.tsx` (department-invoice table + consolidated totals + Collect Payment form, auto or manual per-department allocation) — wired into `BillingPendingDischargesView.tsx`'s "Finalize" action (previously just a link-out to the generic single-invoice Hospital Invoices list).
  - **Migration** `20260915095050_v72_line_item_patient_panel_split` — generated via `prisma migrate diff --from-schema-datamodel/--to-schema-datamodel` (two static schema files, zero DB connection for the diff itself), applied via plain `migrate deploy`. No repeat of session 6's incident.
  - **8 new backend tests** (department-invoice routing incl. a same-department-reuse case and a different-department-new-invoice case, panel coverage split on an admission line, Interim Statement consolidation, auto-allocation proportionality, explicit-allocation sum/cap validation, over-allocation rejection) — **60/60 passing**, `tsc --noEmit` clean.
  - **Live end-to-end verification against the real dev DB** (curl, `frontdesk`-role account): created a real admission (Administration dept, doctor "Aaliyan"), checked in, posted one service each to Administration (PKR 1,500) and General Medicine (PKR 1,800) — confirmed via distinct `hospitalInvoiceId`s in the responses — fetched the Interim Statement (2 department rows, consolidated total 3,300), collected a PKR 2,000 payment with no explicit allocation (auto-proportional: 909.09 / 1090.91, sums exactly), re-fetched the statement (both invoices `PARTIALLY_PAID`, consolidated outstanding 1,300 correctly), and confirmed `My Balance Sheet` shows the un-split PKR 2,000 physical cash total for the cashier (no double-counting from the 2-receipt split).
  - **Deliberately not attempted:** Panel Billing itself (Panel Verification, Contract Resolution, Panel Interim Statement, Panel Remittance) — design is now resolved (see above) but the build is its own pass; Running Bill printing/PDF export; the Admin/Super Admin review side of settlements (pre-existing gap, unrelated to §2.2).

## Progress Log
_(most recent first)_

- **2026-09-15 (session 6) — Front Desk portal completed to 12/13 nav items (only Panel Billing deliberately deferred), following a data-loss incident earlier in the session.**
  - **Data-loss incident (see the Resume Prompt above for the safety rule going forward):** the dev database was found completely empty (all tables, 0 rows) mid-session. Root-caused (best-effort, not 100% certain) to an earlier `prisma migrate diff --shadow-database-url "$DATABASE_URL"` call that pointed the shadow-database flag at the live `chss_hms` database itself instead of an isolated one — traced through `_prisma_migrations` ending up untracked despite tables existing. No backup existed; recovered login access by re-running `prisma/seed.ts` (restores 6 bootstrap/demo `PortalUser` accounts + 4 base `Department` rows only — all other data from days 1-4 is gone and needs manual recreation). All subsequent schema work this session used a DB-connection-free static diff (`--from-schema-datamodel`/`--to-schema-datamodel`) instead.
  - **OPD / Observation / Emergency queues** ✅ — `HospitalInvoicesView.tsx` gained an `encounterTypeFilter` prop (backend already supported `?encounterType=` on `GET /invoices`); 3 new dispatcher cases, zero backend/schema change.
  - **Admission Payment Requests** 🆕 — backend was fully missing (Admission portal could raise a request via `POST /admissions/:id/request-advance`, but nothing let Front Desk see or fulfill it). Added `hms-backend/src/modules/frontdesk/paymentRequests.{schemas,service,controller,routes}.ts`, mounted at `/api/v1/admission-payment-requests` (`GET /` list, `POST /:id/collect` — supports partial fulfillment across multiple collections, caps at the remaining requested balance, writes the same `UserCashBalance` ledger pattern as every other Front Desk collection). Frontend: `services/paymentRequestService.ts`, `features/frontDesk/paymentRequests/{AdmissionPaymentRequestsView,CollectPaymentRequestModal}.tsx`. 4 new backend tests.
  - **Front Desk / Billing Reports** 🆕 — backend was fully missing. Added `reports/frontdeskBilling.service.ts` (real aggregation: collections by payment method, discounts, refunds, invoice-status mix, gross/net/outstanding — all read from the existing `UserCashBalance`/`HospitalInvoice` ledger, no new reporting table) + `GET /reports/frontdesk-billing` (reuses the Super Admin dashboard's date-preset query shape). `FRONT_DESK_BILLING` role gained `reports: ['view']` in `authorize.ts` (previously had none). Frontend: `services/frontdeskBillingReportService.ts`, `features/frontDesk/reports/FrontDeskBillingReportsView.tsx`.
  - **My Account Settlement** 🆕 — backend had a schema (`AccountSettlement`/`SettlementTransaction`) but zero service/routes (only balance-sheet *viewing* existed, no *submitting*). Added `cash/settlement.{schemas,service}.ts` + `POST /cash/settlements` (bundles every currently-unsettled `UserCashBalance` row into one settlement, computes variance against the cashier's physical count, requires a reason if variance ≠ 0, flips those rows `isSettled = true`) + `GET /cash/settlements` (history). Frontend: `services/settlementService.ts`, `features/frontDesk/settlement/MyAccountSettlementView.tsx`. 4 new backend tests; live curl-verified end-to-end (submit → rows settled → re-check correctly reports nothing left → history shows it).
  - Backend: 53/53 tests passing (8 new this session), `tsc --noEmit` clean. Frontend: `tsc --noEmit` + `npm run build` clean.
  - **Deliberately not attempted:** Panel Billing (Panel Verification, Contract Resolution, Interim Statement, Panel Remittance) — zero backend exists for any of it; §2.5/§2.8 explicitly flag open design questions to resolve first. The Admin/Super Admin *review* side of a submitted Account Settlement (accept/reject/partial-accept) also doesn't exist yet — only the cashier's own submit + history.

- **2026-09-15 (session 5) — Front Desk Appointments module built end-to-end (real, DB-backed), plus two real bugs found and fixed along the way.**
  - **Bug fix (found first, unrelated to Appointments):** `FRONT_DESK_BILLING` role had no `identity` module permission at all, so `GET /staff` (the doctor list) 403'd — New Admission's "Admitting Doctor" dropdown was silently empty and the form couldn't be submitted. Fixed in `authorize.ts` — Front Desk gets `identity: ['view']` (read-only).
  - **Backend (`hms-backend/src/modules/frontdesk/appointments.*`)** — the CRUD/advance/check-in service already existed from an earlier session but had never been wired to any frontend; extended it rather than rebuilding:
    - **Schema** (migration `20260915083041_v72_appointment_department_invoice`): `HospitalInvoice` gained `departmentId` (tags which department the invoice belongs to — a plain tag, not the full §2.2 split), `patientShare`, `panelReceivable` (additive, default 0, doesn't touch existing `total`/`paidTotal`/`status` arithmetic). `PaymentReceipt` gained a direct `appointmentId` FK, replacing the old fragile `reference`-substring-matching used to find an appointment's pre-Check-In advance receipts.
    - `checkInAppointment` now resolves Panel coverage via the existing `PanelDiscountRule.coveragePercent`/`capAmount` (added last session, previously unused by any code): Panel Service rule match → coverage-split (Patient Share + Panel Receivable = gross fee, capped) → else legacy flat `discountPercent` (unchanged pre-v7.2 behavior) → else NOT_COVERED (patient pays full, panel receivable = 0 — never assumed covered).
    - `listAppointments`/`getAppointment` now include `paymentReceipts` directly on the appointment (pre- and post-Check-In, dual-linked) so "Advance Paid" is reliably queryable at any status.
    - 3 new unit tests added to `tests/phase4_frontdesk.test.ts` (department tagging + self-pay split, panel coverage split with cap, NOT_COVERED fallback) — **45/45 backend tests passing**, `tsc --noEmit` clean.
  - **Frontend bug fix (found while building the billing preview):** `services/panelService.ts`'s `fetchCorporatePanels()` mapper silently dropped `coveragePercent`/`capAmount`/`preauthorizationRequired` from every discount rule (only `replaceDiscountRules()`'s mapper had them) — fixed, both mappers now agree.
    - **`services/frontdeskApiService.ts`** — replaced the old unverified/unused `createAppointment`/`updateAppointmentStatus` (flagged wrong in a prior session's comment — no such routes exist) with a real, fully-typed `appointmentsApiService`: `getAppointments`, `getAppointmentById`, `bookAppointment`, `updateAppointment`, `cancelAppointment`, `collectAdvance`, `checkInAppointment` — verified against the actual `appointments.schemas.ts` shapes.
    - **`features/frontDesk/appointments/`** 🆕 — `AppointmentsView.tsx` (KPIs, Date/Department/Doctor/Status/Search filters — all backend-filtered, not client-side — table, status-aware contextual actions), `BookAppointmentModal.tsx` (Self-Pay temporary identity **inline** via `newSelfPayPatient` — no `patientRegistryService.createPatient()` call, no permanent record — vs. Panel Patient Registry search; live billing preview incl. Panel coverage/cap/preauth; doubles as the Reschedule modal via a `rescheduleAppointment` prop, reusing `PATCH /appointments/:id`), `CollectAdvanceModal.tsx`, `CancelAppointmentModal.tsx` (mandatory reason; existing advance flagged, never silently refunded), `AppointmentDetailModal.tsx`.
    - Check-In opens the existing `InvoiceDetailModal` unmodified (real `HospitalInvoice`, not a separate Department Invoice model — see the schema note above).
    - Wired into `FrontDeskModuleView.tsx`'s `appointments` case (was falling through to `ModulePlaceholderView`).
    - `tsc --noEmit` clean, `npm run build` clean, on both projects.
  - **Not done / explicitly out of scope this session (per direct instruction — Appointments only, then stop):** Walk-In/OPD/Admission-Intake changes, the full §2.2 Department Sub-Invoice Split, Department-tier/Global-tier panel coverage rules (only the Service tier exists in schema), Provider Settlement realization off Panel receivables.
  - **Verification gap:** the Chrome extension was declined this session, so there was no browser click-through — confidence rests on 45/45 automated backend tests (3 new, covering the new split/tagging logic specifically) plus clean `tsc`/`build` on both sides, not a manual UI pass. Recommend the user (or a future session with Chrome available) do one real click-through: Book (Self-Pay + Panel) → Collect Advance → Check-In → confirm the opened invoice and `My Balance Sheet` reflect it.

- **2026-09-14 (session 4) — Front Desk Billing built out: Hospital Invoices, Billing Pending Discharges, My Balance Sheet, Walk-In Intake. All real, all live-verified end-to-end with the `fdtest01` Front-Desk-role test account (encounter → service line → discount → payment → refund → cash balance sheet → outstanding filter — every step curl-verified against the real dev DB).**
  - **`services/invoiceService.ts`** 🆕 — wraps the real, pre-existing (and previously unused-by-any-frontend) `/invoices*` and `/encounters` billing API: list/detail, add service line, apply discount, collect payment, refund, create encounter.
  - **`InvoiceDetailModal.tsx`** 🆕 — the shared billing action surface: view lines/receipts, Add Service Line, Apply Discount, Collect Payment, Refund. Reused across every billing nav item.
  - **`HospitalInvoicesView.tsx`** 🆕 — real invoice list/search/filter. Also serves `payments_receipts` / `discounts` / `refunds` / `outstanding_balances` (via an `outstandingOnly` prop) — a deliberate consolidation since those actions live per-invoice on the real backend, not as separate global lists; building 4 near-duplicate list pages wasn't worth it today.
  - **`BillingPendingDischargesView.tsx`** 🆕 — real queue: admissions with `status = DISCHARGE_PENDING` (a pre-existing, real `AdmissionStatus` value — this *is* the v7.2 "Clinically Discharged → Billing Pending" status Front Desk should see, no new schema needed). Links into Hospital Invoices to finish billing.
  - **`MyBalanceSheetView.tsx`** 🆕 — dedicated page for the cashier's own live `/cash/balance-sheet` (dashboard had a condensed version; this is the full one, matching the `my_balance_sheet` nav item).
  - **`WalkInIntakeView.tsx`** 🆕 — real OPD/Observation/Emergency encounter creation (`POST /encounters`), same patient-search/register pattern as New Admission, opens the resulting invoice immediately via `InvoiceDetailModal`.
  - New nav item `billing_pending_discharges`; `FrontDeskModuleView.tsx` now routes 8 real pages total (`new_admission`, `walk_in_intake`, `billing_pending_discharges`, `hospital_invoices`, `payments_receipts`, `discounts`, `refunds`, `outstanding_balances`, `my_balance_sheet` — 9 nav items, 6 distinct pages).
  - Backend: 38/38 tests passing, `tsc --noEmit` clean both sides throughout.
  - **Deliberately not attempted today**: the Department Sub-Invoice Split (§2.2) — this billing flow still runs on the pre-v7.2 single-invoice-per-encounter/admission model (real, tested, working). Splitting one invoice into one-per-department is a genuinely separate, larger schema change with an open design question (see §7's open questions) — attempting it today risked breaking the newly-built-and-verified billing flow above along with `phase4_frontdesk.test.ts`/`phase5_admission.test.ts`. Recommend tackling it as its own dedicated pass, informed by how real usage of what's built today shapes the requirements.
  - **Still placeholder** (`ModulePlaceholderView`, 100% mock data): Appointments, OPD/Observation/Emergency queues, Admission Payment Requests, Panel Billing, Front Desk Reports.

- **2026-09-14 (session 3) — Front Desk work started: v7.2 §2.9 relocation (admission creation) + real dashboard, both backend-verified live with a real Front Desk-role account.**
  - **Security fix (found while testing, fixed immediately):** the `Staff.clinicalAuthPasswordHash` field added in session 1 was leaking in plaintext-hash form through every `doctor: true` / `performedBy: true` Prisma include across `admission.service.ts`, `frontdesk/appointments.service.ts`, and `frontdesk/invoices.service.ts` (any endpoint returning a doctor). Fixed at the root instead of patching each callsite: added `previewFeatures = ["omitApi"]` and a global `omit: { staff: { clinicalAuthPasswordHash: true } } }` to the Prisma client (`src/db/client.ts`) — the field is now structurally absent from every query result everywhere, present or future. Removed the now-redundant manual `sanitizeStaff()` scrubbing from `staff.service.ts`. Verified via curl: the hash no longer appears in `/admissions`, `/staff`, or `/staff/:id` responses.
  - **§2.9 — Admission begins at Front Desk**: `authorize.ts` — `FRONT_DESK_BILLING` role gained `admission: create` (was `view, edit` only). Reused the existing, already-correct `admissionService.createPlannedAdmission` (no duplicated logic) — Front Desk now has a real entry point into it.
  - **New Admission page** 🆕 — `features/frontDesk/newAdmission/NewAdmissionView.tsx`, new nav item `new_admission`. Real patient search across Panel + Self-Pay (reuses `patientRegistryService.ts`, same cache as Super Admin's Patient Registry), "+ Register New Patient" reuses the existing `PatientModal.tsx` outright, real Department/Doctor/Bed dropdowns (existing live caches), submits to `POST /admissions`. Verified end-to-end with an actual `FRONT_DESK_BILLING`-role test account (not just Super Admin) — admission created successfully, correct admission number returned.
  - **`FrontDeskModuleView.tsx`** 🆕 — dispatcher mirroring `SuperAdminModuleView`'s pattern, wired into `App.tsx` for the front-desk portal. `new_admission` is the first real page; every other Front Desk nav item still falls through to `ModulePlaceholderView` (which is 100% hardcoded mock data — `mockInvoices`, `mockStaff`, fake patient names — confirmed while investigating; used by every Front Desk module before today, and still used by all but one).
  - **`FrontDeskDashboard.tsx` rebuilt from scratch** — was 100% hardcoded (fake KPIs, fake "Zainab Bibi"/"Muhammad Bilal" patient rows, fake receipts). Now real: today's Appointments/OPD/Observation/Emergency/Invoices counts (from `/appointments` + `/invoices`, encounterType really is a column on `HospitalInvoice` — confirmed via schema, not guessed), today's Admissions count, Outstanding Balance (sum of real `balanceDue`), Cash/Online collected this shift (from `/cash/balance-sheet` — the logged-in cashier's real unsettled collections), Recent Patients/Invoices/Transactions tables all from live data.
  - **Found and fixed 3 more pre-existing bugs while wiring this** (in `services/frontdeskApiService.ts`, which had zero frontend callers until today — never tested against the real backend): `getCashBalance()` called `/cash/balance` (real route is `/cash/balance-sheet`) — fixed; `getPatients`/`createPatient`/`getPatientById` called a bare `/patients` that doesn't exist (real routes are split `/patients/panel` and `/patients/encounters`) — removed in favor of the already-correct `patientRegistryService.ts`; `createAppointment`/`updateAppointmentStatus`/`createInvoice` left in place but flagged unverified-and-likely-wrong in comments (unused today, not worth fixing blind).
  - Backend: 38/38 tests passing, `tsc --noEmit` clean both sides throughout. Every new/changed piece smoke-tested live against the dev DB, including a from-scratch `FRONT_DESK_BILLING` test account (not reused Super Admin credentials) to actually prove the RBAC change works.
  - **Not done yet** (this is one page of a whole portal — see §3.3 for the full list): Running Bill/Interim Statement (§2.10), Payment Allocation screen (§2.11), Department Sub-Invoice Split (§2.2 — the big one; `New Admission` creates the file but billing still runs through the pre-v7.2 single-invoice model until this lands), Billing Pending Discharges queue, Department Collection Summary, Panel verification/remittance forms, and every other Front Desk nav item besides `new_admission` (still `ModulePlaceholderView`). Admission Portal's `create` permission was deliberately left in place rather than revoked (see the `authorize.ts` comment) — full v7.2 compliance would remove it once Front Desk's flow is confirmed as the only path in practice.

- **2026-09-14 (session 2) — Super Admin §3.1 fully closed out; all previously-deferred items now shipped, backend-verified live.**
  - **Salary Profile CRUD + Salary Tax UI** 🆕 — `POST /staff/:id/salary-profile` (new endpoint; the base Salary Profile CRUD genuinely didn't exist before today, only a read-only view via `/staff/:id/360`). Creating a profile server-side closes out whichever row was previously current (`effectiveTo = new effectiveFrom`) — same effective-dated-history pattern as `StaffEmploymentHistory`/`DoctorCommissionRule`, never edits history in place. Frontend: `SalaryProfileModal.tsx` (Wallet icon, all Staff Users rows) shows the current profile and lets Super Admin set a new one (basis, base amount, salary tax method/value, effective date). Live-verified via curl (profile created, `/360` reflects it as current).
  - **Doctor Commission UI** 🆕 — the backend `/commission/rules` endpoint existed pre-v7.2 but had **zero frontend** until today. Built `DoctorCommissionView.tsx` (new dedicated page, wired to the pre-existing `doctor_commission` nav item) — lists all rules, "Add Commission Rule" form (doctor, optional service, Fixed/% rate, Gross/Net basis, **Commission Tax method/value** — v7.2 §2.7, independent of Salary Tax). Live-verified via curl.
  - **Doctor-Sponsored Discount Tracking toggle** 🆕 — `Staff.doctorSponsoredDiscountTrackingEnabled` (migration `20260914133526_v72_doctor_discount_toggle`), exposed in `StaffUserModal.tsx`'s Add/Edit form, shown only when Staff Category = Doctor. Live-verified via curl.
  - **Panel Discount Rule UI extension** ✅ — `SuperAdminCorporatePanelsView.tsx`'s existing discount-rule editor now has Coverage %, Cap Amount, and a Preauthorization Required checkbox per rule, alongside the legacy flat `discountPercent`. Live-verified via curl against `PUT /corporate-panels/:id/discount-rules` — reproduces Worked Example 7's 80%-coverage shape exactly.
  - Backend: 38/38 tests still passing, `tsc --noEmit` clean both sides throughout every step above.
  - **Super Admin's v7.2 slice (§3.1) is now complete** — every item in that section either has a real UI, or is explicitly out of Super Admin's scope (department sub-invoice split §2.2, discount-source enum §2.3, admission relocation §2.9, statements/allocation §2.10/§2.11 — all Front Desk/Admission portal work, see §3.3/§3.4 below).

- **2026-09-14 (session 1) — Super Admin slice of Phase A + §3.1 shipped, backend-verified live.** Schema: `OutsourcedProvider`, `ProviderSettlement`, `HighCostMedicinePolicy` models; `Department.fulfillmentOwnership`/`outsourcedProviderId`; `Staff` clinical-auth credential fields (§2.4); `StaffSalaryProfile` salary-tax fields (schema only — see note below); `DoctorCommissionRule` commission-tax fields (§2.7); `PanelDiscountRule` coverage/co-pay/preauth/cap fields (§2.5) — migration `20260914125654_v72_super_admin_foundation`, applied and `prisma generate`d. Backend: full CRUD for Outsourced Providers, singleton get/update for High-Cost Medicine Policy, Provider Settlements create/list (server-computes `alreadySettledAmount`, rejects over-limit settlement — verified against Worked Example 6's exact numbers via live curl), Department outsourcing validation, Staff clinical-auth set/reset-password/activate/deactivate (password hash never leaves the service layer — verified via live curl), Department/Panel-discount-rule schemas extended. All under `hms-backend/src/modules/setup/*` and `identity/staff.*` and `commission/commission.*`. 38/38 backend tests passing, `tsc --noEmit` clean both sides. Frontend: 3 new Super Admin pages (Outsourced Providers, High-Cost Medicine Policy, Department Payables/Provider Settlements) wired into nav + `SuperAdminModuleView.tsx`; Department Add/Edit modal gained a Fulfillment Ownership + Provider picker section; Staff Users table gained a per-doctor Clinical Discharge Authorization action + modal (set/reset/activate/deactivate).
  - **Deferred at the time, closed out in session 2 below**: Salary Tax UI, Doctor Commission UI, Doctor-Sponsored Discount toggle, Panel Discount Rule UI extension. Still correctly out of scope for Super Admin: §2.2 (department sub-invoice split), §2.3 (discount-source enum), §2.9 (admission→Front Desk move), §2.10/§2.11 (statements/allocation) — Front Desk/Admission portal work per §3.3/§3.4.

---

**Source:** 23 PDFs in `pdfs resources/Hospital Managment System/`, every one stamped *"HMS SOURCE OF TRUTH v7.2 — Supersedes v7.1"* (prepared by iSysware Software Solutions). This is a **binding spec revision**, not optional reading — v7.2 explicitly overrides whatever v7.1/earlier rules the current build was implemented against.

**Method:** Each PDF was extracted and read in full (`pdftotext -layout`), then cross-checked line-by-line against the live `hms-backend/prisma/schema.prisma` and `src/modules/**` as of **2026-09-14** to separate "already real" from "genuinely new." Every 🆕/🔧 tag below was verified against actual code — not guessed from the PDFs alone.

**Status legend:**
- 🆕 **NEW** — no model/field/flow like this exists in the codebase today; net-new build.
- 🔧 **REWORK** — something exists but the shape/ownership is fundamentally different from what v7.2 requires.
- ✅ **Already aligned** — current implementation already matches the v7.2 rule.

**Relation to existing docs:** `PROJECT_MASTER_SPEC.md` / `prompts/*.md` capture the pre-v7.2 baseline (what's built: Setup, Identity, Front Desk billing, Admission, Inventory, Pharmacy-bridge — all against a *single invoice per admission* model). `SUPERADMIN_COMPLETION_PLAN.md` tracks the Super Admin UI rewiring (mock → real DB) done on 2026-09-13/14 — that work is unaffected by this doc and stays valid. **This document is additive scope on top of both**, not a replacement.

---

## 1. The Eight Non-Negotiable v7.2 Rules

(from `01 Hospital Managment System.pdf` §8 — treat every one of these as a hard constraint on any new code)

1. Admission is created at **Front Desk / Billing**, not inside the Admission Portal.
2. Front Desk may collect admission advance and any later partial/final Hospital collections.
3. Admission Portal receives the admission file and manages bed, stay, procedures, department requests, running charges and discharge workflow — **never collects Hospital patient cash**.
4. Each bill-owning department has a **separate sub-invoice**. Front Desk remains the single central patient-collection point.
5. Collected money is **allocated** to the related department invoice; settlement to outsourced departments happens later through an authorized settlement workflow.
6. Hospital-funded discount affects Hospital Services only. Doctor-sponsored discount is explicitly charged against that doctor's commission.
7. Only a doctor with valid **clinical authorization credentials** may clinically discharge an admitted patient.
8. High-cost medicine requests are blocked until the configured authorization policy is satisfied. Panel patients keep patient-share and panel-receivable amounts separate at department-invoice level. Salary tax and commission tax are separate doctor configuration streams with effective dates.

---

## 2. Cross-Cutting New Domain Concepts (build these first — everything else depends on them)

This is the dependency-ordered foundation. Per-portal UI work in §3 is blocked on these landing in the backend first (same pattern `SUPERADMIN_COMPLETION_PLAN.md` used: schema → service → routes → frontend).

### 2.1 🆕 Outsourced Provider Master
No `OutsourcedProvider` model exists in schema today. Needed:
- `Department` gains `fulfillmentOwnership: INTERNAL | OUTSOURCED` + `outsourcedProviderId` FK.
- New `OutsourcedProvider` model: provider code, legal/display name, linked department(s), representative, phone/email, address, payment terms, settlement cycle, allowed payment methods (Cash/Bank/Cheque/Online), bank/cheque details, tax/withholding config + effective date, default acknowledgement representative/designation, active status.

### 2.2 🔧 Department Sub-Invoice Split (biggest structural change)
**Today:** `HospitalInvoice` is one invoice per admission/appointment (`admissionRecordId` or `appointmentId`, single FK). `InvoiceLineItem.serviceRateId` → `ServiceRate.departmentId` gives department *indirectly* per line, but there is no department-level invoice aggregate (gross/discount/net/paid/outstanding per department).

**v7.2 needs:** One patient can have **many department invoices** (Hospital Services, Laboratory, Pharmacy, Neurology, …), each with its own gross, owner-specific discount/contract adjustment, net, paid, outstanding — while Front Desk still shows one consolidated statement as a presentation layer only. Formula (`19 Formulas...pdf`):
```
Department Net Invoice = Department Gross Charges − Owner-Specific Discounts/Contract Adjustments + Approved Adjustments
Patient Consolidated Total = Σ Department Net Invoices
Department Outstanding = Department Net Invoice − Patient Allocations − Panel Realizations Applied − Other Approved Credits
```
Design options to evaluate: (a) keep `HospitalInvoice` per-admission but add a `DepartmentInvoice` child grouping layer, or (b) make `HospitalInvoice` genuinely per-(admission × department). Recommend (a) — less disruptive to existing `PaymentReceipt`/reporting relations, and matches "consolidated statement is presentation only, ownership is department-specific" wording exactly.

### 2.3 🔧 Discount Ownership / Source
**Today:** `InvoiceLineItem.discountAmount` + free-text `discountReason`. No structured source, no automatic commission linkage.

**v7.2 needs:** A `DiscountSource` enum — `HOSPITAL_FUNDED | DOCTOR_SPONSORED | PANEL_CONTRACT | PROVIDER_APPROVED` — where:
- `HOSPITAL_FUNDED` → posts only to Hospital Services invoice.
- `DOCTOR_SPONSORED` → reduces patient charge on that line **and** is automatically deducted from that doctor's `DoctorCommissionAccrual` (new linkage — doesn't exist today).
- `PANEL_CONTRACT` → contract pricing/coverage, not a generic discount.
- `PROVIDER_APPROVED` → only affects that department/provider's own ownership.

### 2.4 🆕 Doctor Clinical Discharge Authorization + Discharge Summary
**Today:** Discharge uses `DualDischargeClearance` (3 gates: `CLINICAL`/`HOSPITAL_BILLING`/`PHARMACY`, each `PENDING→CLEARED` by any `PortalUser`) — verified in `admission.service.ts:dischargePatient()`. This is a **different mechanism** from what v7.2 specifies.

**v7.2 needs:**
- `Staff` (doctor) gains a **separate clinical-authorization credential** — its own username/password, distinct from portal login (`PortalUser`). A doctor can be "Staff Record Only" (no portal login) and still hold discharge authorization.
- Discharge action pops a credential prompt (doctor username/password) — validated server-side, never a free-typed approver name.
- New `DischargeSummary` capture: Final Diagnosis, Treatment/Procedures, Condition at Discharge, Medicines/Instructions, Follow-Up (advice/doctor/date), Additional Notes.
- System stores doctor Staff ID, name, department, authorization timestamp, and the actual Admission-portal user who initiated it.
- Resulting status: `Clinically Discharged - Billing Pending` → case routes to Front Desk for financial closure. (Current `AdmissionStatus` enum needs this intermediate state — today's flow goes straight through the 3-gate clearance to `DISCHARGED`.)
- Passwords must never appear in reports/exports/discharge records.

### 2.5 🔧 Panel Patient Share vs Panel Receivable Split
**Today:** `PanelDiscountRule` is a flat `discountPercent` per `(panel, serviceRate)` — a simple % knock-off, not a Patient-Share/Panel-Receivable ledger split.

**v7.2 needs**, per department invoice line:
- `Contract/Tariff Amount` (panel-negotiated), `Patient Share` (co-pay/non-covered), `Panel Receivable` (covered portion), tracked **separately**, with `Patient Share + Panel Receivable = Contract Amount`.
- A `Panel Remittance` record: panel company, receipt/remittance ref, amount, **allocation by department invoice** — panel receivable is only "realized" once remittance is posted and allocated, never assumed from billing alone.
- Optional per-panel preauthorization/referral requirement field on the panel/member/contract.
- Panel interim statement must show Patient Share paid/outstanding **and** Panel Receivable separately (never blend panel-covered amount into "patient cash due").

### 2.6 🆕 High-Cost Medicine Authorization Policy
Nothing like this exists in schema/pharmacy-bridge today (no threshold/authorization concept found anywhere). Needs:
- A policy config (Setup module): `enabled`, `thresholdAmount` (PKR, management-configured — never hard-coded), `thresholdBasis` (Line Total, recommended default; optional Per Unit), `attendantConfirmationRequired`, `managementApprovalRequired` (Admin/Super Admin), `combinedLogic` (Attendant Only / Management Only / Either / Both), `panelPreauthAddOn` (optional).
- Trigger formula: `Medicine Line Amount = Quantity × Approved Unit Rate`; if `basis = LINE_TOTAL` and amount exceeds threshold → request status `AUTHORIZATION_REQUIRED`.
- Authorization record: medicine/qty/rate/line total/threshold; attendant name/relationship/contact/CNIC + confirmation checkbox + confirmed-by-user + timestamp; management authorizing username/password (real credential validation, not a typed name) + role + reason + timestamp; optional panel authorization/reference.
- Gate sits between Admission's Pharmacy request and the `pharmacy-bridge` hand-off — a `Pending`/`Rejected` request must never reach Pharmacy dispense.

### 2.7 🆕 Doctor Salary Tax + Commission Tax (separate streams)
**Today:** `StaffSalaryProfile` has `deductionRules`/`allowanceRules` JSON but no tax field. `DoctorCommissionRule` has `rate`/`basis` (Fixed/% , Gross/Net — this part already matches v7.2) but no tax field either.

**v7.2 needs**, added independently with their own effective-dated history:
- **Salary tax**: method/rate/value + effective date, on the salary profile. `Net Salary Payable = Salary Payable Before Tax − Salary Tax`.
- **Commission tax**: method/rate/value + effective date, on the commission rule/profile. `Net Commission Payable = Commission Before Tax − Commission Tax − other approved deductions + adjustments`, where `Commission Before Tax = max(0, Calculated Commission − Doctor-Sponsored Discount ± approved adjustments)`.
- Hard rule: salary and commission remain **independent ledgers/approvals/payments/outstanding** — never merged or cross-deducted.

### 2.8 🆕 Outsourced Provider Settlement Workflow
Depends on 2.1 + 2.2. New `ProviderSettlement`/ledger concept:
```
Realized Department Amount = Patient Collections Allocated + Panel Remittances Realized for that Department
Provider Payable = Realized Amount (subject to contract adjustments/withholding) − Already Settled
```
- Full/Partial settlement by authorized Billing/Admin/Super Admin, payment method per provider's allowed methods (Cash/Bank/Cheque/Online), settlement **cannot exceed** eligible realized payable.
- Voucher fields: department/provider, period, eligible realized amount, already settled, settlement amount, method/reference, representative name/designation, settled-by (actual user), received/acknowledged-by, date/time, remarks.
- Partial settlement leaves remaining payable open, never silently zeroes it.

### 2.9 🔧 Admission Creation Moves to Front Desk
**Today (verified):** `grep "admissionRecord.create"` → only one hit, in `hms-backend/src/modules/admission/admission.service.ts`. Admission creation lives entirely inside the **Admission module**, both backend and (per `AdmissionDashboard`/Admission nav) frontend.

**v7.2 needs:** The "New Admission" create action (patient type, panel search + verification, admitting doctor, department, bed preference, fulfillment-mode choices, optional advance + receipt) must be **owned by Front Desk / Billing** — `frontdesk` module gets the create endpoint + UI; `admission` module becomes receive-only (accepts the handed-off file, no create action, no cash collection anywhere in its screens).

### 2.10 🆕 Running / Interim Statement
Printable **at any time** during a stay, explicitly marked "not the final discharge invoice," showing department subtotals, department-specific discounts/contract pricing, patient share, panel share, advance, payments, current outstanding — all department-wise. No such report/view exists yet.

### 2.11 🆕 Explicit Payment Allocation Screen
Every partial/final payment at Front Desk must show each department's outstanding *before* posting, and let the user allocate the receipt across department invoices line-by-line:
```
Σ Department Allocations = Posted Patient Payment Amount
```
— except where an explicit unallocated patient-credit balance is intentionally permitted by policy. Today's Front Desk billing (`frontdesk/invoices.service.ts`) posts payments against a single invoice; this per-department allocation UI/logic doesn't exist.

---

## 3. Per-Portal Breakdown

### 3.1 Super Admin Portal — `02 Super Admin Portal.pdf`, `12`, `13`, `20`
New nav sections needed (§2.1–2.9 above, surfaced as UI):
- **Hospital Management** → Department Billing Configuration (Internal/Outsourced toggle, billing-owner flag, separate-invoice flag, allowed-discount-owner rules)
- **New: Outsourced Providers** master (add/edit, link to department(s))
- **New: Department Payables** — view realized provider payable by department/provider
- **New: Provider Settlements** — Full/Partial Settle, payment method/reference, representative acknowledgement, voucher print
- **New: High-Cost Medicine Policy** — §2.6 config screen
- **Panel Management** rework — contract/tariff mapping, coverage %, patient co-pay, exclusions/caps, preauthorization requirement (extends today's flat `PanelDiscountRule`)
- **Staff/Doctor profile** gains: clinical discharge username + credential status (reset/activate, password never shown), salary tax config, commission tax config, doctor-sponsored-discount tracking toggle

Setup workflows to build:
- *Outsourced department setup*: Create/verify Department → set billing ownership + Internal/Outsourced → link Provider profile → configure settlement/payment methods + representative → activate.
- *Doctor financial setup*: Create Doctor in Staff Master → salary profile + salary tax → commission rules + commission tax → create/activate clinical discharge credentials → review history/effective dates.

Portal rule to enforce: **no user may manually type an approver name to bypass credential-based management authorization** (applies to high-cost medicine, discharge, and any future authorization gate).

### 3.2 Admin Portal — `03 Admin Portal.pdf`
Same operational scope as Super Admin (§3.1) minus anything touching protected Super Admin accounts (already enforced pattern in this codebase — see `AdminDashboard.tsx`'s governance banner, `authorize.ts`). New for Admin specifically:
- **Department settlement review** workflow: open provider/department ledger → select unsettled realized amount → Full/Partial → payment method/reference → capture representative acknowledgement → post + print voucher.
- **Doctor Tax** management screen (salary tax + commission tax, separate effective-dated history).
- Rule: all settlement and doctor-tax changes must store the actual logged-in user (already the codebase's convention via `createdById`/`updatedById` — extend it to these new entities).

### 3.3 Front Desk / Billing Portal — `04`, `05`, `11`, `13`, `16`, `17`, `20`–`23` — **largest scope of new work**
This portal gains the single biggest new responsibility: **admission creation** (§2.9), plus everything downstream of it.

New/reworked nav & pages:
| Page | What's new |
|---|---|
| **New Admission** (moved here from Admission portal) | Patient Type (Self-Pay/Panel), Search Panel Patient + validate active membership, Admitting Doctor, Department, Bed preference, Fulfillment-mode choices, Advance amount/method, notes → Create Admission → Receive Advance → Print Admission Receipt → hand off to Admission Portal |
| **Running Bill / Interim Statement** 🆕 | Department-wise view, print interim statement (marked not-final) |
| **Department Invoices** 🆕 | Separate Hospital/Lab/Pharmacy/Neurology/etc. invoice views (§2.2) |
| **Payments / Receipts + Payment Allocation** 🔧 | Receive Advance/Partial/Final, then explicit per-department allocation screen (§2.11) before posting |
| **Billing Pending Discharges** 🆕 | Queue of `Clinically Discharged - Billing Pending` cases (§2.4) → finalize department invoices → apply advance/prior payments → collect remaining due → print separate department invoices + consolidated statement |
| **Department Collection Summary** 🆕 | Collected/allocated by department/provider |
| **Provider Settlement** 🆕 (where authorized) | Full/Partial Settle + voucher (§2.8) |
| **Panel forms** 🆕 | Panel Verification (member ID, active status, authorization/referral ref), Contract Resolution (tariff, coverage, patient share, panel receivable), Panel Interim Statement, Panel Remittance (allocation by department invoice) |

Final-billing workflow to build: receive Billing-Pending case → freeze/verify department sub-invoices → apply only authorized owner-specific discounts → apply advance + prior partial payments → collect remaining patient responsibility → allocate receipt → print final department invoices + consolidated statement.

Rules to enforce: Front Desk is the *only* Hospital-cash collection point in the whole system; advance is patient credit until allocated; Hospital-funded discount never silently reduces Lab/Pharmacy/outsourced invoices; doctor-sponsored discount is never treated as a generic hospital discount.

### 3.4 Admission Portal — `05`, `11`, `14`, `20`
**Loses:** admission-creation responsibility (moves to Front Desk, §2.9) — becomes purely a receive-and-manage portal. Confirm/audit that no "Create Admission" / cash-collection UI remains reachable here once Front Desk owns creation.

**Gains:**
- **Doctor Discharge Authorization** 🆕 (§2.4): Discharge button → doctor credential popup (username/password) → validate → Discharge Summary form → store doctor ID/name/time → status → `Clinically Discharged - Billing Pending` → send to Front Desk. *Admission user cannot self-discharge.*
- **High-Cost Medicine gate** 🆕 (§2.6) on Department/Pharmacy requests — request blocked at `Authorization Required` until policy satisfied; cannot be sent to Pharmacy while pending/rejected.
- **Department Requests**: Hospital Managed/Internal vs Self/External fulfillment mode selection (field-level — may already partly exist via `medicationMode` `SELF`/enum on `AdmissionRecord`, worth checking for reuse before building fresh).
- Financial visibility stays **read-only** (running bill/payment status view) — no Receive Cash button anywhere in this portal, ever.

### 3.5 Inventory Management Portal — `06`
No structural v7.2 changes found — scope (Items/Categories/Units/Suppliers/Locations, Purchase Requirements, Fund Requests, Purchases/GRN, Stock Ledger, Supplier Ledger, Department Issue/Return, cash/settlement) matches the existing baseline spec. Two rules to keep true as other work lands: medicine stock stays entirely outside HMS Inventory (Pharmacy owns it — already the architecture); Department billing/service settlement (§2.8) is a **distinct** concept from Inventory's own Supplier Ledger settlement — don't conflate the two settlement flows when building UI.

### 3.6 Standalone Pharmacy — `07` (integration), `08` (Pharmacy Super Admin), `09` (Pharmacy Manager), `10` (Sales/Dispensing)
Core Pharmacy scope (medicine master, batches/expiry, FEFO, dispensing, Pharmacy invoice, Pharmacy cash) is unchanged from baseline. New integration surface, all downstream of §2.6:
- Every portal (Super Admin, Manager, Sales/Dispensing) must **check and respect High-Cost Medicine authorization status** before allowing dispense — `Authorized/Rejected/Pending` status received from HMS; **no portal may bypass a pending authorization**, and Manager/Sales staff specifically cannot override by typing an approver name.
- **HMS reconciliation** 🆕 (Pharmacy Super Admin): review Pharmacy invoice → view amount collected by HMS Front Desk → match allocation/reference → reconcile Pharmacy departmental ledger → escalate mismatches. New `Integration Reference` record: Admission ID, Medicine Request ID, patient/case ref, authorization status, dispense ref, Pharmacy invoice ref.
- Rule: one dispense must never create duplicate charges; Pharmacy invoice ownership stays with Pharmacy even when HMS Front Desk centrally collects the patient's money (ties into §2.2/§2.8 — Pharmacy is effectively always "outsourced" from a settlement-ownership point of view, even though it's architecturally a separate project).

---

## 4. Formulas Reference (verbatim from `19 Formulas and Calculation Rules.pdf`)

```
Department Net Invoice        = Department Gross Charges − Owner-Specific Discounts/Contract Adjustments + Approved Adjustments
Patient Consolidated Total    = Σ Department Net Invoices

Sum of Department Allocations = Posted Patient Payment Amount   (or explicit unallocated credit, if policy allows)

Available Patient Credit      = Advances + Unallocated Overpayments − Allocations Applied to Department Invoices

Department Outstanding        = Department Net Invoice − Patient Allocations − Panel Realizations Applied − Other Approved Credits

Panel Contract Amount         = Tariff/Contract Calculation for Eligible Service
Patient Share + Panel Receivable = Contract Amount (subject to approved contract adjustments)

Realized Department Amount        = Patient Collections Allocated + Panel Remittances Realized for that Department
Provider Settlement Outstanding   = Eligible Provider Payable from Realized Amount − Provider Settlements Already Posted

Medicine Line Amount          = Quantity × Approved Unit Rate
  → Authorization Required when the configured threshold rule evaluates true.

Calculated Commission         = Fixed Amount  OR  Commission Base × Commission %
Commission Before Tax         = max(0, Calculated Commission − Doctor-Sponsored Discount ± Approved Commission Adjustments)
  (if commission base = NET_AFTER_DISCOUNT, hospital-funded/contract pricing may also affect the base;
   Doctor-Sponsored Discount is still tracked explicitly and charged against the doctor's commission regardless)

Commission Tax                = Taxable Commission Base × Configured Commission Tax Rate  (or configured method/value)
Net Commission Payable        = Commission Before Tax − Commission Tax − Other Approved Commission Deductions + Approved Adjustments

Salary Payable Before Tax     = Period Base Salary + Allowances − Attendance Deductions − Other Approved Deductions ± Adjustments
Net Salary Payable            = Salary Payable Before Tax − Salary Tax (effective salary-tax configuration)

Independence rule: Salary Payable and Commission Payable are separate ledgers, approvals, payments and outstanding balances — never merged.
```

---

## 5. Worked Examples (for dev reference / test fixtures — `17 Worked Business Examples.pdf`)

1. **Self-Pay + advance + split billing**: PKR 20,000 advance at admission. During stay: Hospital 40,000, Lab 15,000, Pharmacy 10,000 (gross 65,000). Advance allocated to actual invoices as configured; a later PKR 25,000 partial payment is allocated explicitly by department; remaining due collected + allocated at final billing.
2. **PKR 50,000 full-payment split**: Hospital 20,000 / Lab 20,000 / Pharmacy 10,000 = 50,000 total. Full payment → receipt allocated exactly PKR 20,000 / 20,000 / 10,000 to the three department invoices. Physical collection is central; invoice ownership is never merged.
3. **Hospital-funded discount**: Hospital Services 20,000 − 5,000 discount = 15,000 net. Lab (20,000) and Pharmacy (10,000) untouched. New total 45,000.
4. **Doctor-sponsored discount + commission**: Doctor-eligible service = 5,000, configured commission = 1,000. Doctor gives a PKR 500 doctor-sponsored discount → patient charge becomes 4,500, doctor's commission payable *before tax* becomes 500 (commission tax applied separately after).
5. **Doctor salary tax**: Salary profile and salary-tax profile are independent of commission; salary tax is deducted using the effective tax config; commission tax is never mixed into salary tax.
6. **Outsourced Lab partial settlement**: Realized eligible amount = 180,000. Authorized user settles 100,000 by Bank Transfer → status `Partially Settled`, remaining payable = 80,000. Voucher stores bank reference + provider representative acknowledgement.
7. **Panel patient**: Lab contract invoice = 30,000. Panel covers 80% = 24,000 Panel Receivable; patient co-pay = 6,000 (Front Desk collects this). The 24,000 is **not** assumed realized for provider settlement until the panel company actually pays and that remittance is allocated to Lab.
8. **High-cost medicine**: Rate 6,000 × qty 2 = 12,000 line total vs threshold 10,000 → authorization popup mandatory; Pharmacy cannot dispense until all configured attendant/management/panel authorization requirements are satisfied.

---

## 6. Suggested Build Order

Mirrors the phased approach `SUPERADMIN_COMPLETION_PLAN.md` already used successfully (schema → service → routes → tests → frontend, one coherent slice at a time):

**Phase A — Foundation schema (blocks everything else)**
1. `OutsourcedProvider` model + `Department` outsourcing fields (§2.1)
2. Department sub-invoice grouping layer (§2.2) — the highest-risk design decision, do this first and get it reviewed before building on top of it
3. `DiscountSource` enum + doctor-commission linkage (§2.3)
4. Doctor clinical-auth credentials + `DischargeSummary` model + new admission status (§2.4)
5. Panel Patient Share/Receivable split + `PanelRemittance` (§2.5)
6. High-Cost Medicine policy + authorization record (§2.6)
7. Salary tax + commission tax fields (§2.7)
8. `ProviderSettlement` ledger/voucher (§2.8)

**Phase B — Front Desk becomes the admission-creation owner (§2.9)** — relocate the create endpoint/UI; Admission module becomes receive-only. This is a routing/ownership change more than new business logic, but touches both portals' navigation and should land as its own reviewed slice.

**Phase C — Per-portal UI, in the order patients actually flow through them**
Front Desk (New Admission, Running Bill, Payment Allocation) → Admission (Discharge Authorization, High-Cost gate) → Front Desk again (Billing Pending Discharges, final billing, Department Collection Summary) → Super Admin/Admin (Outsourced Providers, Provider Settlements, Doctor Tax, High-Cost Policy config, Panel Management) → Pharmacy integration (authorization-status gate, HMS reconciliation).

**Phase D — Reports**
Department billed vs collected vs panel receivable vs provider payable vs settled vs outstanding; doctor discounts/commission tax/salary tax; high-cost authorizations; user accountability (§ "Management Reporting" in doc 22).

---

## 7. Open Questions to Confirm Before Building (not answered by the PDFs)

- Is a "Department Invoice" a literal new row per (admission × department), or a computed grouping over existing `InvoiceLineItem`s? (Affects §2.2 design — recommend confirming with the client/spec author before Phase A.)
- Default High-Cost Medicine threshold value, and whether it's hospital-wide or per-department.
- Whether `AdmissionStatus` needs a brand-new `CLINICALLY_DISCHARGED_BILLING_PENDING` enum value, or whether the existing `DualDischargeClearance` 3-gate system should be *replaced outright* by doctor credential re-auth, or the two should coexist (e.g., doctor credential re-auth becomes the `CLINICAL` gate's clearing mechanism instead of any-portal-user clearing it).
- Provider settlement withholding/tax config — exact calculation method expected (flat %, slab, external reference)?
- Whether Doctor "Staff Record Only" + discharge-authorization-without-portal-login is meant to let a visiting/consultant doctor discharge patients without ever getting a `PortalUser` account at all — confirm this against existing `identity` module's role model before implementing.
