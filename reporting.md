# Front Desk + Admission Reporting — Implementation Plan

Source of truth: `Front_Desk_Admission_Reporting_Complete_Guide_v7_5_Reconstructed.pdf` (v7.5, prepared by iSysware), cross-checked against the actual codebase on 2026-09-24.

**Scope:** Front Desk / Billing Portal + Admission Portal reporting (25 reports total), the universal reporting shell they share, and the cross-portal reconciliation rules between them. Super Admin/Admin's own **Finance Control** (Balance Sheets, Account Settlements) is a separate, already-completed workstream — see `Balance_sheet&Account_settlement.md` — and is only referenced here where a report overlaps it (§3.7, §3.8).

No hardcoded numbers, no fabricated patients/invoices/staff, no fake export toasts anywhere in this scope. Every figure must trace to a real Prisma row and the actual logged-in user.

---

## 1. Current state audit (what's real vs mock vs missing)

This is the critical finding. Confirmed by reading the actual components and routes, not assumed.

### 1.1 The big gap — `SuperAdminReportsView.tsx` is 100% mock data ❌
File: `ch-sharif-and-saeed-hospital---hms/src/features/superAdmin/SuperAdminReportsView.tsx`

This single component is what renders for **10 of the guide's report types** via `SuperAdminModuleView.tsx`'s routing (`management_reports`, `patient_panel_reports`, `billing_reports`, `collection_reports`, `admission_reports`, `inventory_reports`, `staff_reports`, `attendance_reports`, `salary_reports`, `commission_reports`). Every one of them:
- Returns a hardcoded array of fictional rows (`'Muhammad Tariq Khan'`, `'Shahnaz Begum'`, invoice `INV-2026-1049`, fixed dates `'07 Sep 2026'`) from a local `useMemo` switch — **zero API calls**.
- "Export PDF / Excel / Print" just opens a preview modal and fires a success toast (`handleDownloadFile`, `handleConfirmPrint`) — **no file is ever generated**.
- Date filters are wired to component state but never actually re-query anything, because there's nothing to query.

Only **Billing Reports** and **Admission Reports** among this list have a real counterpart elsewhere in the app (Front Desk's own `/front-desk/billing_reports` and Admission's own `/admission/admission_reports` — see below) — but the **Super Admin nav items with the same names** still route to this mock component instead of reusing them.

### 1.2 What's already real ✅

| Report (guide ref) | File | State |
|---|---|---|
| Front Desk Daily Summary (§3.1) | `dashboard.service.ts` → `AdminDashboard.tsx`/`SuperAdminDashboard.tsx`/`FrontDeskDashboard.tsx` | Real, live DB aggregation |
| Billing / Invoice Register, Collection & Receipt (§3.3–3.4, partial) | `frontdeskBilling.service.ts` → `GET /reports/frontdesk-billing` → `FrontDeskBillingReportsView.tsx` | Real — collections by method, discounts, refunds, invoice mix. **Not yet a full invoice-register table** (no per-invoice rows, no drill-down) |
| Cashier Balance Sheet (§3.7) | `cash.service.ts` + new `financeControl.service.ts` → Finance Control screens | Real, live, already built this session |
| Account Settlement (§3.8) | `settlement.service.ts` + `financeControl.service.ts` → Finance Control screens | Real, live, already built this session (including carry-forward) |
| Admission Register / basic status counts (§5.2, partial) | `AdmissionReportsView.tsx` (client-side aggregation over `GET /admissions`) | Real but thin — status/department/doctor counts only, no date filter, no export, no census/LOS/bed detail |

### 1.3 Missing entirely (guide requires, nothing exists) ❌

Everything else in the guide's 25-report catalog has **no backend endpoint and no real UI**: Appointment/Visit Register (§3.2), Patient/Invoice Ledger (§3.5), Admission Hospital Payment Collection Report (§3.6), Outstanding/Partial Invoice (§4.1), Discount/Panel Discount (§4.2), Refund/Void/Reversal (§4.3), Department/Service Revenue (§4.4), Admission Daily Summary (§5.1), Inpatient Census (§5.3), Bed Occupancy/Ward Utilization (§5.4), Bed/Ward/Room Transfer History (§5.5), Length of Stay (§5.6), Running Hospital Bill/Interim Statement (§5.7), Hospital Payment Request & Status (§5.8), Pharmacy Medicine Request (§5.9), Medicine Request Fulfillment (§5.10), High-Value Medicine Approval Visibility (§5.11), Pharmacy Clearance Status (§5.12), Discharge Clearance (§5.13), Admission Service Consumption (§5.14), Inpatient Outstanding Balance (§5.15).

**Good news:** for most of these, the *source data already exists* in real tables from prior work (admissions, invoices, payment requests, pharmacy-bridge, wards/rooms/beds) — this is a reporting/aggregation layer to build on top of live data that's already being written correctly, not a new domain to model from scratch. Confirmed source tables per report are listed in §4.

### 1.4 Universal reporting shell — partially real, partially fake
The guide's §2 "Universal Report Controls" (date presets, filters, PDF/Excel/Print with real header/footer, Export History for background jobs) is the pattern `FrontDeskBillingReportsView.tsx` and the new Finance Control screens already follow correctly (real `jspdf`/`xlsx`/print via `tableExportService.ts`). `SuperAdminReportsView.tsx` imitates the same visual shell but every control inside it is inert. The shell itself doesn't need reinventing — it needs to stop wrapping fake data.

---

## 2. Ownership rules carried into this build (guide §1)

| Area | Owner | Rule |
|---|---|---|
| Reception/Encounter, all Hospital cash/card/online collection, Cashier Balance/Settlement | **Front Desk/Billing only** | Admission portal must never show a "collect payment" control; already enforced backend-side (`authorize.ts` — `ADMISSION` has no `cash` grant) |
| Admission Case, Bed Allocation/Transfer, Pharmacy request initiation, Discharge | **Admission** | Bed allocations: one active allocation per bed, enforced at the transfer step |
| Hospital Invoice/Charges | HMS Billing (created by Front Desk) | Server-calculated totals only; rate snapshots stay historically stable |
| Pharmacy Bill | Standalone Pharmacy | Never merged into Hospital Bill or a single "paid" flag |

**Audit attribution rule (applies to every report in this plan):** use actor-specific columns — `Created By`, `Collected By`, `Approved By`, `Refunded By`, `Settled By`, `Changed By`, `Requested By`, `Dispensed By` — never a generic "User" column, and the approver must be a distinct field from the performer when approval is required.

---

## 3. Universal reporting shell (build once, reuse everywhere)

Every report page in this plan uses the same shell, so a new report is mostly "plug a data source into the shell," not "design a new screen."

### 3.1 Controls every report needs
- Search + server-side filters + sort + pagination
- From/To date with presets: Today, Yesterday, This Week, This Month, Previous Month, Custom
- Role-aware columns (a user never sees a column/row their role can't view)
- Export PDF, Export Excel, Print — **using the currently applied filters**, via the real `tableExportService.ts` pattern already built (not `SuperAdminReportsView.tsx`'s fake modal)

### 3.2 Standard export header/footer (already implemented in `tableExportService.ts`, reuse as-is)
Hospital logo + name + report title → filter block (date range + every applied filter) → KPI summary + table → footer with **actual** `Generated By` user + timestamp + page X of Y. Excel: typed columns, no merged cells, metadata on its own sheet.

### 3.3 Page composition pattern (guide §7)
`A. Title bar + export buttons` → `B. Filter bar` → `C. KPI strip (4–8 cards)` → `D. Main table (server pagination)` → `E. Totals footer` → `F. Detail drawer (open source row without losing filters)` → `G. Audit metadata`.

---

## 4. Report catalog — condensed, mapped to real source data

Every report below already has its underlying transactions written to a real table by existing modules; this column is what a report's query joins against.

### 4.1 Front Desk / Billing (guide §3–4)

| # | Report | Real source tables/services already available | Status |
|---|---|---|---|
| 3.1 | Daily Summary/Dashboard | `dashboard.service.ts` (extend with partial/unpaid count + refund-attention count) | Mostly done |
| 3.2 | Appointment/Visit/Encounter Register | `Appointment`, `HospitalInvoice` (`appointments.service.ts`) | New endpoint |
| 3.3 | Billing/Invoice Register | `HospitalInvoice`, `InvoiceLineItem` (`invoices.service.ts`) | New endpoint (dashboard KPI already exists via `frontdeskBilling.service.ts`; needs the actual row-level register) |
| 3.4 | Collection & Receipt Report | `PaymentReceipt`, `UserCashBalance` (`invoices.service.ts`, `admissionBilling.service.ts`) | New endpoint |
| 3.5 | Patient/Invoice Ledger | `HospitalInvoice` + `InvoiceLineItem` + `PaymentReceipt`, append-only | New endpoint |
| 3.6 | Admission Hospital Payment Collection Report | `AdmissionPaymentRequest` + `PaymentReceipt` (`paymentRequests.service.ts`) | New endpoint |
| 3.7 | Cashier Balance Sheet | `cash.service.ts` / `financeControl.service.ts` | **Done** (Finance Control) |
| 3.8 | Account Settlement | `settlement.service.ts` / `financeControl.service.ts` | **Done** (Finance Control) |
| 4.1 | Outstanding/Partial Invoice | `HospitalInvoice` (`balanceDue`/status) | New endpoint |
| 4.2 | Discount/Panel Discount | `InvoiceLineItem` discount fields, `CorporatePanel` | New endpoint |
| 4.3 | Refund/Void/Reversal | `PaymentReceipt.isReversed`, refund entries in `UserCashBalance` | New endpoint |
| 4.4 | Department/Service Revenue | `InvoiceLineItem` × `Department`/`ServiceRate` | New endpoint |

### 4.2 Admission (guide §5)

| # | Report | Real source tables/services already available | Status |
|---|---|---|---|
| 5.1 | Admission Daily Summary/Inpatient Dashboard | `AdmissionRecord`, `Bed` | New endpoint (extend `AdmissionReportsView`'s pattern with date scope + bed occupancy) |
| 5.2 | Admission Register | `AdmissionRecord` (`admission.service.ts`, already backs `fetchAdmissions`) | Partial — needs date filters, referral source, export |
| 5.3 | Inpatient Census | `AdmissionRecord` + `Bed` as-of a timestamp | New endpoint |
| 5.4 | Bed Occupancy/Ward Utilization | `Bed`, `BedTransferHistory` | New endpoint |
| 5.5 | Bed/Ward/Room Transfer History | `BedTransferHistory` | New endpoint |
| 5.6 | Length of Stay | `AdmissionRecord.admitDate`/`dischargeDate` | New endpoint |
| 5.7 | Running Hospital Bill/Interim Statement | `HospitalInvoice` scoped to `admissionRecordId`, excludes Pharmacy | New endpoint |
| 5.8 | Hospital Payment Request & Status | `AdmissionPaymentRequest` (`paymentRequests.service.ts`) | New endpoint (Admission-side read view; Front Desk already writes it) |
| 5.9 | Pharmacy Medicine Request Report | `PharmacyClearance`/pharmacy-bridge request records | New endpoint |
| 5.10 | Medicine Request Fulfillment | Same + `PharmacyDispense` | New endpoint |
| 5.11 | High-Value Medicine Approval Visibility | `HighCostMedicineApproval`-equivalent (`highCostMedicine` module) | New endpoint |
| 5.12 | Pharmacy Clearance Status | `PharmacyClearance` | New endpoint |
| 5.13 | Discharge Clearance | `DischargeClearance`, `DischargeSummary` | New endpoint |
| 5.14 | Admission Service Consumption | `InvoiceLineItem` scoped to admission charges | New endpoint |
| 5.15 | Inpatient Outstanding Balance | `HospitalInvoice.balanceDue` scoped to admissions | New endpoint |

### 4.3 Key formulas (guide §6, must match exactly — some already implemented in Finance Control)
- `Net Billed = Gross Billed − Approved Discount`
- `Outstanding = Net Billed − Valid Payments + Valid Refund/Reversal effect`
- `Expected Cash = Opening Float + Cash Collections + allowed carry − Cash Expenses − Cash Refunds − previous cash deposits` — **the "allowed carry" term is exactly the carry-forward liability already built into `settlement.service.ts` this session**
- `Variance = Physical Cash − Expected Cash` — already implemented
- `Occupancy % = Occupied bed-time / Available bed-time × 100`
- `Length of Stay = Discharge time − Admit time` (active cases: report as-of time − admit time)
- `Medicine Fulfillment % = Dispensed Qty / Requested Qty × 100`
- `Hospital Outstanding = Hospital Net Charges − valid Billing-collected Hospital payments` (never includes standalone Pharmacy due)

---

## 5. Implementation steps

### Step 1 — Kill the mock reports, reuse what's real
- Wire `SuperAdminModuleView.tsx`'s `billing_reports` and `admission_reports` module IDs to the **existing real** `FrontDeskBillingReportsView`/`AdmissionReportsView` (shared, same pattern as Finance Control's `balance_sheets`/`account_settlements` fix) instead of `SuperAdminReportsView`.
- For the remaining mock-only types (`collection_reports`, `staff_reports`, `attendance_reports`, `salary_reports`, `commission_reports`, `inventory_reports`, `patient_panel_reports`) — each needs its own real backend + view per §4; until built, remove them from `SuperAdminReportsView`'s coverage rather than ship fabricated data. `management_reports` (KPI benchmarks) is out of scope for this reporting guide — it belongs to a separate analytics workstream.

### Step 2 — Backend: one `reports` sub-module per domain, reusing existing services where the query already exists
`hms-backend/src/modules/reports/`
- `frontdeskReports.service.ts` — Appointment Register, Invoice Register, Collection & Receipt, Patient/Invoice Ledger, Admission Hospital Payment Collection, Outstanding/Partial, Discount, Refund/Void, Department Revenue (§4.1's 9 endpoints).
- `admissionReports.service.ts` — Daily Summary, Register (extended), Census, Bed Occupancy, Transfer History, LOS, Running Bill, Payment Request status, Service Consumption, Outstanding Balance (§4.2's non-Pharmacy 10 endpoints).
- `admissionPharmacyReports.service.ts` — the 4 Pharmacy-linked Admission reports (§5.9–5.12), reading pharmacy-bridge tables read-only.
- `admissionDischargeReports.service.ts` — Discharge Clearance (§5.13).
- All new routes mounted under `/api/v1/reports/*`, gated by the existing `authorize('reports', 'view')` policy (already grants `FRONT_DESK_BILLING` and `ADMISSION` view access — confirmed in `authorize.ts`).

### Step 3 — Frontend: real report views on the same shell
- One `services/*ReportService.ts` per backend service above, following `frontdeskBillingReportService.ts`'s existing pattern exactly (typed response, no mock fallback).
- One view component per report (or a handful of shared table/KPI components parameterized like `tableExportService.ts`'s `ExportColumn<T>` pattern), wired into `FrontDeskModuleView.tsx` / `AdmissionModuleView.tsx` nav routing — **not** back into `SuperAdminReportsView`.
- Reuse `tableExportService.ts` (already built) for every report's Print/PDF/Excel — no new export code per report.

### Step 4 — Cross-portal reconciliation pass (guide §6)
After Step 2–3, verify the 7-step flow reconciles: Admission creates charge stream → raises payment request → Front Desk collects + receipts → Admission's read-only view syncs → discharge freezes the bill → Hospital + Pharmacy clearance → bed released. Each step's report must show the same numbers from both sides for the same filter.

### Step 5 — QA pass (guide §8's 20-point checklist)
Re-run the checklist per report once built: date filtering matches across UI/PDF/Excel, actor attribution is real, Admission never shows a payment-collection control, Hospital/Pharmacy bills never merge into one paid flag, discharge blocks correctly, bed allocation integrity holds, ledger running balances reconcile, online/card excluded from physical cash, refund/void preserves the original transaction, role scope is enforced on export too, and dashboard KPI → report total → transaction ledger reconcile for the same filter set.

---

## 6. Non-negotiable rules carried into this build (guide §12-equivalent, restated for reporting)
1. A report never implies a portal performed an action it only viewed or requested (Admission "Payment Request Report" shows *requested*, not *collected*).
2. Every actor field shows the real logged-in user — never a generic "Admin" label, never fabricated.
3. Hospital Bill and Pharmacy Bill never collapse into one paid/cleared flag.
4. Invoice totals are server-calculated; historical rate snapshots stay stable after rate changes.
5. Refund/void/reversal preserves the original transaction — compensating entry only, no rewriting history.
6. A bed never has two active allocations; a transfer closes the old one before opening the new one.
7. Export PDF/Excel/Print always uses the filters currently applied on screen.
8. A user cannot export rows/columns their role can't view in the UI.

---

## 7. Order we'll actually build in
1. Step 1 (stop shipping mock data — reroute the two report types that already have a real home)
2. Step 2 (backend report services, grouped by domain, reusing existing tables)
3. Step 3 (frontend views on the shared shell + real export)
4. Step 4 (cross-portal reconciliation verification)
5. Step 5 (QA checklist)

---

## 8. Build status (2026-09-24)

**Step 1–3 — Done.** Front Desk (12 reports) and Admission (15 reports, incl. 4 Pharmacy-linked) are fully built on real backend endpoints under `/api/v1/reports/frontdesk/*` and `/api/v1/reports/admission/*`, with real Print/PDF/Excel export via `tableExportService.ts`, and verified live in the browser end-to-end (real transactions, correct empty states where no data exists yet).

**Super Admin/Admin reporting (this session's last phase) — Done.**
- `SuperAdminModuleView.tsx`'s `billing_reports` and `admission_reports` nav items now open `SuperAdminFrontDeskReportsHub` / `SuperAdminAdmissionReportsHub` (`src/features/superAdmin/reports/`) — a sidebar hub giving oversight access to the **entire** real report catalog each portal owns (not just a single thin summary), reusing the exact same components Front Desk/Admission render for themselves. No data ever drifts between what a cashier sees and what oversight sees, because it's the same component and the same API call.
- `collection_reports` → `CollectionReportViewPage`, `patient_panel_reports` → `PanelPayerReportView` (both real, already built for Front Desk this session — reused directly rather than building Super-Admin-only duplicates).
- `management_reports` (KPI benchmarks) stays on the old mock view, unchanged — explicitly out of scope for this guide (separate analytics workstream).
- `inventory_reports` / `staff_reports` / `attendance_reports` / `salary_reports` / `commission_reports` now show an honest `ReportModuleNotBuilt` empty state instead of `SuperAdminReportsView`'s fabricated rows — these are HR/Payroll/Inventory domains explicitly out of scope for the v7.5 reporting guide, with no source endpoint to build on yet.
- Verified live: reconciled the same PKR 6,000 collection / 3-invoice / 1-admission figures across Front Desk's own screens, the Super Admin Billing Reports hub, Collection Reports, and Patient/Panel Reports — same numbers everywhere, confirmed both under `super-admin` and `admin` portals (both route through `SuperAdminModuleView`).
- `npx tsc --noEmit` clean (only the 2 pre-existing unrelated errors elsewhere in the app).

**Still outstanding:** Step 4 (formal cross-portal reconciliation pass write-up) and Step 5 (guide §8's 20-point QA checklist re-run) haven't been done as a dedicated pass — spot-checks during live verification didn't surface any mismatch.
