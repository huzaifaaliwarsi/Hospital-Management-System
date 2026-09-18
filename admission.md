# Admission Department — Complete Flow & Working Context

> Extracted from `pdfs resources/Hospital Managment System/04 Front Desk Billing Portal.pdf`,
> `11 Complete Workflow Architecture.pdf`, and `23 Admission to Discharge Billing Complete Flow.pdf`
> (all stamped **HMS SOURCE OF TRUTH v7.2**, supersedes v7.1). This file is a working reference to
> plan/complete the Admission department — pair it with `HMS_V7.2_NEW_REQUIREMENTS.md` (the full
> 23-PDF gap-analysis + session-by-session build log) before starting new work, since a lot of this
> may already be implemented — see **§7 Current Implementation Status** below.

---

## 1. The One Rule Everything Else Follows

**Admission is created at Front Desk, never inside the Admission Portal.** The Admission Portal
receives the handed-off file and manages the stay — bed, procedures, department requests, running
charges, discharge — but **never collects patient cash** (no Receive Cash button anywhere in it).
Department bills stay separate (Hospital / Lab / Pharmacy / Neurology / etc. each get their own
invoice); Front Desk collects centrally and allocates the receipt across whichever department
invoices the patient is paying down.

---

## 2. End-to-End Flow

### 2.1 Admission Creation (Front Desk)
1. Select Self-Pay or Panel Patient.
2. Verify panel eligibility / authorization if applicable (search the permanent Panel Patient
   Registry, validate active membership).
3. Select admitting doctor, department, and bed preference.
4. Choose configured department fulfillment modes (Hospital-Managed vs Self/External, where
   relevant).
5. Create the admission file.
6. Receive an optional advance (stored as patient credit, not yet allocated to any invoice).
7. Print admission/advance receipt.
8. Send the file to the Admission Portal.

### 2.2 Inpatient Stay (Admission Portal)
1. Admission accepts the case.
2. Assign / confirm bed.
3. Add Hospital services and procedures.
4. Create Lab / Neurology / Pharmacy / other department requests.
5. Apply the High-Cost Medicine gate where required (see §4).
6. Separate department invoices grow independently as charges are posted.
7. Front Desk's payment status stays visible to Admission — but Admission has no way to collect it.

### 2.3 Running Bill & Partial Payment (Front Desk, any time during the stay)
- Patient/attendant can ask "how much bill so far, in which departments?" at any time.
- System prints an **Interim / Running Statement** with a department-wise breakdown.
- Patient may pay a partial amount at Front Desk during the stay.
- **Payment Allocation** screen distributes one physical receipt across N department invoices (or
  leaves an explicit patient credit if the policy allows).

**Worked example (from the PDF):**

| Department | Net Bill |
|---|---|
| Hospital Services | PKR 20,000 |
| Laboratory | PKR 20,000 |
| Pharmacy | PKR 10,000 |
| **TOTAL** | **PKR 50,000** |

If the patient pays PKR 50,000, Front Desk allocates 20k/20k/10k across the three. If they pay
less, Front Desk records a transparent partial allocation (auto-proportional or explicit, per
invoice) — never silently discards the excess or leaves an ambiguous remainder.

### 2.4 Doctor Discharge (Admission Portal, doctor credential gate)
1. Admission user clicks **Discharge**.
2. Doctor credentials popup appears.
3. Doctor's own username/password is validated (not the Admission user's).
4. Doctor completes the Discharge Summary.
5. Clinical discharge is stored under the doctor's identity (doctor ID, name, timestamp, plus the
   Admission user who initiated it).
6. Status → **Clinically Discharged - Billing Pending**.
7. Case appears at Front Desk for final billing.

**The Admission user cannot self-discharge a patient — doctor re-authentication is the only path.**

### 2.5 Final Billing (Front Desk)
1. Verify all department invoices.
2. Apply advance and any prior partial allocations.
3. Collect the remaining Self-Pay patient responsibility, or the Panel patient's share.
4. Post final payment allocations.
5. Print separate department invoices **plus** one consolidated statement.
6. Mark patient financial closure according to payer rules.

### 2.6 Panel Admission Variation
- Panel patient is selected from the permanent Panel Patient Registry (not re-entered per visit).
- Each department invoice calculates **Patient Share** and **Panel Receivable** independently.
- Interim statement shows patient responsibility separately from panel responsibility.
- Front Desk collects the patient co-pay/share only; the panel balance stays receivable until
  remittance — panel-covered amount is never treated as patient cash due.
- Provider/outsourced settlement waits for the panel receivable to actually be **realized** (cash
  in hand), never books against the mere invoice figure.

### 2.7 Outsourced Department Settlement (Lab / Neurology / etc.)
1. Super Admin/Admin marks a department as Outsourced and links an Outsourced Provider.
2. Provider profile holds: representative, payment terms, allowed payment methods, bank/cheque
   details, settlement cycle, optional tax/withholding rules.
3. Front Desk still collects/allocates the patient's money — the provider never collects directly
   through Admission.
4. Billing/Admin/Super Admin opens **Provider Settlement**, pays Full or Partial against the
   **eligible realized** provider payable only (collected patient share + panel cash actually
   received — never the gross invoice).
5. Settlement voucher captures the representative's acknowledgement and the actual settling user.
6. Remaining payable stays outstanding for a later settlement.

### 2.8 Doctor Commission, Discount & Tax
- Doctor-sponsored discount is **not** a general hospital discount — it reduces the linked doctor
  service and is explicitly deducted from that doctor's own commission payable.
- Commission tax is configured separately (per doctor commission tax profile) and deducted from the
  commission stream only.
- Salary tax is configured separately and deducted from the salary stream only.
- **Salary and Commission remain fully independent balances/payment streams** — never netted
  against each other.

### 2.9 High-Cost Medicine Gate
1. Admission/doctor requests a medicine under Hospital-Managed mode.
2. System computes line amount = quantity × approved rate, compares against the configured
   threshold.
3. If exceeded, request status becomes **Authorization Required**.
4. Attendant confirmation and/or Admin/Super Admin credential approval is captured, per the
   configured policy (`ATTENDANT_ONLY` / `MANAGEMENT_ONLY` / `EITHER` / `BOTH`).
5. Only an **Authorized** request proceeds to Pharmacy — Rejected/Pending can never be dispensed.

### 2.10 Final Status Chain

```
ADMISSION CREATED AT FRONT DESK
  → ACTIVE IN ADMISSION
  → DOCTOR CLINICALLY DISCHARGED
  → BILLING PENDING
  → FRONT DESK FINANCIAL CLOSURE
  → DEPARTMENT / PANEL / PROVIDER LEDGERS CONTINUE AS REQUIRED
```

---

## 3. Discount Ownership (who a discount actually reduces)

| Discount source | Financial effect |
|---|---|
| Hospital-funded | Reduces the Hospital Services invoice only, unless another explicit owner-funded policy applies. |
| Doctor-sponsored | Reduces the linked doctor service; deducted from that doctor's commission payable. |
| Panel contract/tariff | Contract pricing/coverage — **not** a generic Hospital discount. |
| Outsourced department/provider | Only a provider/department-approved adjustment affects that department's own ownership. |

---

## 4. Main Forms / Key Fields (Front Desk side of Admission)

| Form | Key fields |
|---|---|
| New Admission | Patient type, Panel Patient/member details if applicable, doctor, admitting department, expected/actual date, bed preference, fulfillment modes, advance amount/method, notes |
| Payment Allocation | Payment amount, department invoice rows, allocation amount per row — **unallocated balance must be zero before posting** |
| Running Statement | Department subtotals, discounts/contract pricing, patient share, panel receivable, advance, paid, outstanding |

**Portal-specific rules (Front Desk):**
- Front Desk is the HMS patient-cash collection point, full stop.
- Advance is patient credit until explicitly allocated to actual invoices.
- Hospital-funded discount posts only to Hospital Services unless another explicit owner-funded
  policy exists.
- Doctor-sponsored discount is never a general hospital discount — see §2.8/§3.

---

## 5. Recommended Front Desk Navigation (from the PDF, for cross-reference)

| Section | Pages / Modules |
|---|---|
| Patient Flow | Appointments, Walk-In/Encounter Intake, New Admission, Admission File Handoff |
| Billing | Department Invoices, Running Bill, Interim Statement, Payments/Receipts, Admission Payments, Discounts, Refunds, Outstanding, Panel Billing |
| Allocations | Payment Allocation by Department Invoice |
| Cash Control | My Balance Sheet, My Account Settlement |
| Department Finance | Department Collection Summary, authorized Provider Settlement handoff/processing where permitted |

---

## 6. Cross-Portal Actors in This Flow

| Actor | Responsibility |
|---|---|
| Front Desk / Billing | Creates admission, all cash collection (advance/partial/final), payment allocation, interim/final statements, department invoice printing |
| Admission Portal | Accepts the file, bed lifecycle, hospital services/procedures, department requests, high-cost medicine gate on requests, sends to doctor for discharge — **zero cash collection anywhere** |
| Doctor (credential gate) | Re-authenticates to clinically discharge; completes Discharge Summary |
| Admin / Super Admin | Configures Outsourced Providers, High-Cost Medicine policy/threshold, doctor commission/tax rules, Panel contracts; opens Provider Settlements; reviews Account Settlements |
| Pharmacy (standalone, integration boundary) | Only dispenses a Hospital-Managed request once its High-Cost gate (if triggered) is Authorized |

---

## 7. Current Implementation Status (cross-checked against `HMS_V7.2_NEW_REQUIREMENTS.md`)

This repo already has a **detailed, session-by-session gap-analysis and build log** for exactly this
scope — read `HMS_V7.2_NEW_REQUIREMENTS.md` in full before assuming anything below is still open,
it changes fast. As of its last entry (**session 10, 2026-09-15**):

- ✅ **§2.9 Admission begins at Front Desk** — done (session 3). `FRONT_DESK_BILLING` role has
  `admission: create`; `NewAdmissionView.tsx` is the real entry point.
- ✅ **§2.2 Department Sub-Invoice Split** — done (session 7). Confirmed against `13 Department
  Billing Split and Settlement.pdf`'s own worked example: a **literal** new `HospitalInvoice` row
  per (admission × department), not a computed grouping. `admissionBilling.{schemas,service,
  controller,routes}.ts` at `/api/v1/admission-billing` — `GET /:id/statement` (Running/Interim
  Statement) and `POST /:id/collect-payment` (Payment Allocation — explicit per-department array,
  or auto-proportional with largest-remainder rounding, rejects over-allocation).
- ✅ **§2.4 Doctor Clinical Discharge Authorization** — done (session 10). New `DischargeSummary`
  model, `admissionService.clinicalDischarge()` verifies the doctor's own bcrypt-hashed
  `clinicalAuthPasswordHash`, `grantClearance('CLINICAL')` now rejects outright (doctor auth is the
  *only* path). `ClinicalDischargeModal.tsx` wired into `AdmissionDetailModal`'s Clearances tab.
- ✅ **§2.6 High-Cost Medicine Authorization Policy** — done (session 10). New
  `HighCostMedicineAuthorization` model, `AUTHORIZATION_REQUIRED` clearance status,
  `authorizeHighCostMedicine()`/`rejectHighCostMedicine()` respecting the configured
  `ATTENDANT_ONLY`/`MANAGEMENT_ONLY`/`EITHER`/`BOTH` logic. `HighCostMedicineAuthorizationModal.tsx`
  wired into the Pharmacy tab.
- ✅ **Admission Portal frontend** — "fully real" per session 9: all 11 nav items live
  (`dashboard`, `planned_admissions`, `admission_check_in`, `active_admissions`,
  `bed_board_transfers`, `hospital_services_procedures`, `medication_fulfillment_mode`,
  `pharmacy_requests`, `hospital_payment_requests`, `discharge_clearances`, `final_discharge`,
  `admission_reports` — see `ADMISSION_NAV_GROUPS` in `src/constants/portalNavigations.ts`).
- ✅ **§2.5 Panel Patient Share/Receivable split** — done (session 7), via
  `shared/panelCoverage.ts`, shared with Appointments so the two can't drift.
- ✅ **Admission-creation advance is now a real receipt** — fixed 2026-09-18, auditing
  `NewAdmissionView.tsx` against this doc's §2.1. Previously the form's "Deposit" field only wrote
  `AdmissionRecord.estimatedAmount` (a plain number) — no `PaymentReceipt`, no cashier
  `UserCashBalance` entry, despite the success screen claiming it was "logged." Root cause:
  `PaymentReceipt` had no FK back to `AdmissionRecord` at all (it already had one for `Appointment`,
  added specifically for this same pre-invoice-advance case). Fixed:
  - Migration `20260918130811_v72_admission_advance_receipt` — additive `admission_record_id` FK on
    `payment_receipts`.
  - `admission.service.ts`'s `createPlannedAdmission` now accepts `advanceAmount`/`paymentMethod`/
    `paymentReference`, posts a real receipt + `UserCashBalance` entry (mirrors
    `appointments.service.ts`'s `bookAppointment` advance pattern exactly), and returns
    `{ admission, advanceReceipt }` instead of the bare admission.
  - `NewAdmissionView.tsx` split the one ambiguous "Deposit" field into two: "Estimated Total Cost"
    (still just `estimatedAmount`, a planning figure, never collected) and a new "Advance Received
    Now" block with a real Payment Method dropdown — success screen now shows the real receipt
    number/amount, or an honest "no advance collected" note instead of the old false claim.
  - Backend test added (`phase5_admission.test.ts`) covering the receipt + ledger creation; existing
    test updated for the new return shape. 82/82 backend tests passing, `tsc --noEmit` clean both
    sides.
  - **Known, deliberately-not-fixed observations from the same audit** (repo-wide patterns, not
    unique to Admission — flagged, not changed): (1) Panel patients are always inline-registered as
    a brand-new `PanelPatient` on every admission (same in Appointments/Walk-In) rather than
    searched from the permanent registry per this doc's §2.1 point 2 — makes "verify active
    membership" vacuous today; (2) Department/Doctor/Bed dropdowns are point-in-time snapshots of an
    async-primed cache (`useMemo(() => Service.getX(), [])`) — a page rendered before that prime
    resolves can show empty dropdowns until a manual refresh.

### Still explicitly open (per the doc's own "next natural work" note, session 10)
- **No real browser click-through yet** of Panel Billing or the whole Admission portal (including
  the two new §2.4/§2.6 gates) — every verification so far is curl + automated tests, not a manual
  UI pass. **This is the highest-value next step before calling Admission "done."**
- Admin/Super Admin **review** side of Provider Settlements and Account Settlements (submit-only
  exists; accept/reject/partial-accept review does not).
- §2.7 Salary/Commission Tax **UI** on the Admin portal's Doctor Tax screen (backend fields exist).
- §3.6 Pharmacy-side integration respecting the High-Cost authorization status — this session only
  gated the **HMS/Admission** side; the standalone Pharmacy project's own dispense check is
  unstarted.
- A pre-existing, not-yet-closed `tsc` drift flagged mid-session-10 in `appointments.service.ts` /
  `idGenerator.ts` (an un-awaited call, a possibly-undefined array index) from concurrent editing —
  worth a `tsc --noEmit` sanity pass on `hms-backend` before starting new Admission work, to confirm
  it's still clean or pick this up first.

### How to use this when we start working
1. Run `tsc --noEmit` on both `hms-backend` and the frontend first — confirm current baseline is
   clean (per the note above, it may not be).
2. Do the real browser click-through of the Admission portal end-to-end (§2.1–§2.10 above) — this
   is the one thing no prior session has actually done, and it's the fastest way to surface real
   bugs (see the earlier `InvoiceDetailModal`/`HospitalInvoicesView` sessions in this same
   conversation — every real bug found there was a UI-reachability or stale-state issue, not a
   backend logic bug; Admission likely has the same class of gap).
3. Treat `HMS_V7.2_NEW_REQUIREMENTS.md`'s Resume Prompt as the source of truth for exact file/model
   names before writing new code — don't re-derive what already exists.
