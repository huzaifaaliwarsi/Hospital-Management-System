# Reporting — Simple Structure (v2, supersedes the old v7.5 25-report catalog)

Source of truth: `Front Desk Billing Reporting.pdf`, `Admission Reporting.pdf`, `Super Admin_Admin Reporting.pdf` (all "iSysware — Simple Reporting Structure", 2026-09-25), cross-checked against the actual codebase the same day.

**This replaces the older, much larger plan.** The previous `reporting.md` (v7.5, 25-report catalog across Front Desk/Admission/Super Admin) is what got built — and per direct user feedback, it turned out too complex, hard to read, and inconsistent. This file is the new, deliberately smaller spec. It does not throw away the real backend/data work already done (see §5) — it consolidates the *menu* and unifies the *UI pattern* on top of it.

---

## 1. Design goal (all 3 portals, verbatim from the guides)

> School Management System style: simple report menu on the left, proper filters on top, export buttons on the right, and one clean table below. Keep the reporting easy to read and easy to manage.

Universal screen anatomy for every report, no exceptions:
1. **Report Title Bar** — report name + one-line description.
2. **Top Filter Row** — date range + 3–5 relevant dropdowns, one horizontal row where width allows.
3. **Action Buttons** — Filter/Refresh + Reset + Excel + PDF + Print.
4. **Optional KPI Strip** — 3–5 totals, **summary reports only**. Never put a KPI card row on every report — that's exactly the "overloaded" look being removed.
5. **Main Data Table** — clean grid, sortable, searchable, paginated, totals row at the bottom.
6. **Row Action** — View only, where drill-down is actually useful. No action-button clutter per row.

**Visual/component design itself is not in scope for this pass** — the current card/table visual language (built earlier, referred to as the "Antigravity" pattern) stays as-is. What's broken/missing per the user: real, working **filtering** on the reports, and the sheer **number of report menu items** across all three portals, which is what makes the whole thing feel complex and hard to use.

---

## 2. Front Desk / Billing — 9 reports (down from 12+ built today)

Portal rule: Front Desk/Billing collects Hospital cash and owns cashier Balance Sheet + Account Settlement.

| # | Report | Main columns | Top filters |
|---|---|---|---|
| 1 | Daily Billing Summary | Invoices, gross billed, discounts, net billed, collections, outstanding (period totals) | Period/From/To, Cashier, Department |
| 2 | Encounter Register | Encounter No, patient, OPD/Emergency/Observation, department, doctor, date/time, status, Created By | From/To, Encounter Service, Department, Doctor, Status |
| 3 | Invoice Register | Invoice No, patient, department, gross, discount, net, paid, balance, status | From/To, Department, Payment Status, Panel/Self-Pay |
| 4 | Collection & Receipt Report | Receipt No, invoice/admission no, patient, amount, method, date/time, Collected By | From/To, Payment Method, Receipt Status, Cashier |
| 5 | Outstanding / Partial Invoices | Invoice No, patient, net, paid, outstanding, last payment, status | From/To, Department, Status, Panel/Self-Pay |
| 6 | Admission Payment Collections | Admission No, patient, Hospital due, amount collected, receipt, method, remaining Hospital due | From/To, Admission No, Department, Payment Method, Status |
| 7 | Discounts / Refunds / Voids | **One combined** exception report, `Type` filter (discount / refund / void / reversal); amount, reason, performer, approver | From/To, Type, Status, Approved By |
| 8 | My Balance Sheet | Opening/Petty Cash, Cash Collections, Cash Expenses, Cash Refunds, Expected Cash, Physical Cash, Variance, Settled, Remaining | Shift / Day / Custom Period |
| 9 | My Account Settlement | Settlement Ref, period, expected/physical cash, variance, submitted/accepted amount, remaining cash, status | From/To, Settlement Status |

Non-negotiable: Card/POS and Online/Bank amounts show in collection reports but are **never** counted as physical cash in the Balance Sheet.

---

## 3. Admission — 7 reports (down from 15 built today)

Portal rule: Admission manages the inpatient lifecycle but **never** collects Hospital cash — no Balance Sheet, no Account Settlement here, ever.

| # | Report | Main columns | Top filters |
|---|---|---|---|
| 1 | Admission Summary | Admissions, discharges, active patients, occupied/available beds, pending discharge, Hospital outstanding (period totals) | From/To, Department, Ward, Doctor, Status |
| 2 | Admission Register | Admission No, patient, Panel/Self-Pay, department, doctor, ward/room/bed, admit/discharge date-time, status | From/To, Department, Doctor, Ward, Panel/Self-Pay, Status |
| 3 | Inpatient Census / Bed Report | Current admitted patients + ward/room/bed + occupied/available bed info (tabs or one combined screen) | As-of Date, Department, Ward, Room/Bed, Bed Status |
| 4 | Transfer / Length of Stay | Transfer history + LOS: from/to ward/room/bed, transfer time, reason, admit/discharge times, LOS | From/To, Admission No, Department, Ward, Doctor |
| 5 | Running Hospital Bill / Payment Status | Hospital charges, Billing-collected payments, Hospital outstanding, latest receipt/payment status — **read-only** | From/To, Admission No, Department, Payment/Clearance Status |
| 6 | Pharmacy Request & Fulfillment | Medicine, requested qty, urgency, request status, dispensed qty, Pharmacy invoice/clearance, high-cost approval status | From/To, Admission No, Medicine, Request Status, Approval Status |
| 7 | Discharge Clearance Report | Clinical Ready, Hospital Clearance, Pharmacy Clearance, outstanding/credit status, discharge date/time, completed by | From/To, Department, Doctor, Clinical Status, Hospital Clearance, Pharmacy Clearance |

Non-negotiable: Hospital Bill and Pharmacy Bill stay separate everywhere, including inside the Discharge Clearance report (two distinct clearance states, never merged).

---

## 4. Super Admin / Admin — 8 reports (down from reusing the *entire* Front Desk + Admission catalogs)

Portal rule: management oversight, not a duplicate operational menu. Admin and Super Admin get the identical normal report set (Super Admin's extra restrictions are a security concern, not a separate reporting menu).

| # | Report | Main columns | Top filters |
|---|---|---|---|
| 1 | Management Summary | Total billing, collections, outstanding, expenses, active admissions, occupied beds, pending settlements — summary only | From/To, Department, Portal/User |
| 2 | Billing & Collection Report | Invoice No, patient/payer, department, gross, discount, net, collected, outstanding, payment method, Collected By | From/To, Department, User/Cashier, Payment Method, Payment Status, Panel |
| 3 | Outstanding / Panel Report | Self-Pay + Panel outstanding, partial/unpaid invoices, panel/company, due amount, status | From/To, Payer Type, Panel, Department, Status |
| 4 | Admission & Bed Summary | Admissions, discharges, active patients, department/ward, occupied/available beds, Hospital due, discharge status | From/To, Department, Doctor, Ward, Admission/Discharge Status |
| 5 | Expense Report | Date, category, amount, method, details/reference, Entered By | From/To, Category, Payment Method, Entered By |
| 6 | Balance Sheet & Account Settlements | User-wise opening/petty cash, cash collections, expenses/refunds, expected/physical cash, variance, submitted/accepted/remaining — **consolidated oversight view**, not the same screen as a cashier's own | From/To, Portal, User, Settlement Status |
| 7 | Staff / Payroll / Doctor Commission | Staff/doctor, attendance days, salary basis, payroll amount, doctor commission amount, status | Payroll Period, Department, Staff/Doctor, Status |
| 8 | Inventory / Pharmacy Summary | Purchases/stock movement, low stock/expiry, Pharmacy request/clearance — **summary only**, detailed ledgers stay in their own modules | From/To, Category/Department, Status |

Non-negotiable: don't duplicate every Front Desk/Admission operational report as a separate Super Admin menu item. Use drill-down from a summary row instead of a parallel full menu.

---

## 5. What this means for the existing build (audit, 2026-09-25)

The prior session already built real, live, tested backend endpoints for the old 25-report catalog (`/api/v1/reports/frontdesk/*`, `/api/v1/reports/admission/*`) plus real Finance Control (Balance Sheet/Settlement) screens. **None of that real data plumbing needs to be thrown away.** The gap this new guide is calling out is entirely at the IA/menu and UI-consistency layer:

- **Too many menu items.** Front Desk currently exposes ~12 report entries where the new spec wants 9 (mainly by merging Discount/Refund/Void/Reversal into one report with a `Type` filter instead of separate menu items — v7.5's §4.1 had these as 3 separate catalog rows). Admission currently exposes far more than 7. Super Admin currently reuses the *entire* Front Desk and Admission report hubs verbatim instead of its own smaller 8-report management set.
- **Filtering isn't reliably wired.** Per the user, several existing reports don't actually filter — this needs a pass report-by-report to confirm each Top Filter Row in §2–4 actually re-queries the backend, not just updates local UI state.
- **KPI card overload.** The guide is explicit: KPI strips belong only on summary reports (#1 in each portal's list), not on every single report screen.
- **Visual pattern stays.** The card/table look-and-feel already built (the "Antigravity" pattern) is not being redesigned — only which reports exist, their filters, and the KPI-strip discipline.

## 6. Recommendation: consolidate/refactor, not rebuild from scratch

Rebuilding from zero would throw away real, working, already-tested backend endpoints and data wiring — pure waste, and a regression risk for zero benefit, since the actual problem is menu sprawl and inconsistent filtering, not broken data. The right-sized fix:

1. **Trim each portal's report menu down to the exact list in §2/§3/§4** — hide or merge the extra entries (Discount/Refund/Void/Reversal → one report + Type filter is the biggest single consolidation).
2. **Give Super Admin its own 8-report set** instead of embedding the full Front Desk/Admission hubs — reuse the underlying data services, but present them through Super Admin's own summary-first screens with drill-down, per §4.
3. **Audit every kept report's Top Filter Row** against the exact filter list per report above, and fix any filter that doesn't actually re-query.
4. **Strip KPI strips off every non-summary report** — keep the strip only on the 3 "Summary" reports (Daily Billing Summary, Admission Summary, Management Summary) and My Balance Sheet/Settlement (which are inherently KPI-shaped).
5. Re-verify the cross-portal reconciliation rule (same figures, same filters, both sides) still holds after the menu consolidation.

## 7. Build order

1. Front Desk/Billing menu consolidation + filter audit (9 reports).
2. Admission menu consolidation + filter audit (7 reports).
3. Super Admin/Admin — replace the reused hubs with its own 8-report set + drill-down.
4. Full filter pass across all 24 reports (re-verify each Top Filter Row actually re-queries).
5. KPI-strip cleanup (summary reports only).

---

## 8. Progress log (2026-09-25)

### 8.1 Front Desk / Billing — ✅ DONE (all 9 reports)

Browser-tested as the `frontdesk` user (Playwright, every sidebar report opened, every filter set → Filter → confirmed the query params reach the API → Reset). Backend + frontend `tsc` clean (only the 4 pre-existing unrelated frontend errors remain).

| # | Report (menu id) | Top filters (all re-query the backend) |
|---|---|---|
| 1 | Daily Billing Summary (`front_desk_billing_reports`) | Period, Cashier, Department |
| 2 | Encounter Register (`fd_encounter_register`) | Period, Encounter Service, Department, Doctor, Status |
| 3 | Invoice Register (`fd_invoice_register`) | Period, Department, Payment Status, Panel/Self-Pay |
| 4 | Collection & Receipt (`fd_collection_report`) | Period, Payment Method, Receipt Status (Active/Reversed), Cashier |
| 5 | Outstanding / Partial (`fd_outstanding_invoices`) | Period, Department, Status, Panel/Self-Pay (+ Last Payment, Payer columns) |
| 6 | Admission Payment Collections (`fd_admission_payment_collections`) | Period, Admission No (text), Department, Payment Method, Status (+ Department, Remaining Due columns) |
| 7 | Discounts / Refunds / Voids (`fd_discount_report`, also `fd_refund_void_report`) | Period, Type (Discount/Refund/Void-Reversal), Performed By — ONE combined report, new endpoint `/reports/frontdesk/exceptions` |
| 8 | My Balance Sheet (`my_balance_sheet`) | Period: Current Shift / Today / Yesterday / Week / Month / Custom. Lines: Opening/Petty Cash, Cash Collections, Cash Expenses, Cash Refunds, Non-cash (never physical), Expected Cash, Physical Counted, Variance, Settled, Remaining. Settle button only on Current Shift. |
| 9 | My Account Settlement (`my_account_settlement`) | History filter: Period (All Time … Custom From/To), Settlement Status |

Shared `GenericReportView` (used by every register report, all portals): Filter + Reset buttons, in-table search, click-to-sort columns, 50-row pagination, Totals row at the bottom (money columns; `noTotalColumns` opt-out), KPI strip only when `showKpis` (summary reports only). Dropdown sources come from one endpoint: `/reports/frontdesk/filter-options` (departments, doctors, cashiers, panels).

Known limits (by design, not bugs):
- No "Approved By" filter on Discounts — the schema stores no discount approver. "Performed By" is used instead (invoice creator for discounts, cashier for refunds/voids).
- "Void" = reversed receipts. There is no separate invoice-void flow in the schema.
- Invoice Register rows keep both **View** and **Ledger** buttons (spec says View only) — remove Ledger if unwanted.

### 8.2 Admission — ✅ DONE (all 7 reports from `Admission Reporting.pdf`; details in §8.4)

Decision (user, 2026-09-25): Admission gets the full **7** PDF reports, not the earlier trimmed 4.

| # | Report | Filters required | Status |
|---|---|---|---|
| 1 | Admission Summary | From/To, Department, Ward, Doctor, Status | ✅ |
| 2 | Admission Register | From/To, Department, Doctor, Ward, Panel/Self-Pay, Admission Status | ✅ |
| 3 | Inpatient Census / Bed Report (one combined screen) | As-of Date, Department, Ward, Room/Bed, Bed Status | ✅ |
| 4 | Transfer / Length of Stay (one combined screen) | From/To, Admission No, Department, Ward, Doctor | ✅ |
| 5 | Running Hospital Bill / Payment Status (read-only) | From/To, Admission No, Department, Payment/Clearance Status | ✅ |
| 6 | Pharmacy Request & Fulfillment | From/To, Admission No, Medicine, Request Status, Approval Status | ✅ |
| 7 | Discharge Clearance Report (Hospital + Pharmacy clearance kept separate) | From/To, Department, Doctor, Clinical Status, Hospital Clearance, Pharmacy Clearance | ✅ |

Rules: Admission never collects cash — no Balance Sheet / Account Settlement in this portal. Hospital Bill and Pharmacy Bill stay separate.

### 8.3 Super Admin / Admin — build plan (2026-09-26, source: `Super Admin_Admin Reporting.pdf`, read in full)

#### 8.3.1 What the PDF says (the rules we must follow)

- **Same menu for Admin and Super Admin.** Super Admin's extra restrictions are security rules, not a separate report menu. (Both portals already share `CANONICAL_HOSPITAL_MANAGEMENT_NAV_GROUPS`, so one change covers both.)
- **Do NOT copy the Front Desk and Admission report menus into Super Admin.** Management gets its own 8 reports. When detail is needed, use a **View / drill-down from a summary row**, not a duplicate menu item.
- Balance Sheet & Settlements here = **consolidated, user-wise oversight**. It is not the cashier's own "My Balance Sheet" screen.
- **Same UI pattern as Front Desk reports** (`GenericReportView`): title bar → one row of filters (date range + 3–5 dropdowns) → Filter/Refresh + Reset + Excel + PDF + Print → KPI strip **only on summary reports** → one clean sortable/searchable/paginated table with a **totals row** → row action **View** only where useful.

#### 8.3.2 Problem today (audited 2026-09-26)

Super Admin's sidebar currently has 3 report groups that must go:

| Group id | What it shows today | Problem |
|---|---|---|
| `hm_fd_reports` | 7 Front Desk reports (Daily Billing Summary, Encounter Register, Invoice Register, Collection, Outstanding, Admission Payment Collections, Discounts/Refunds/Voids) | Direct copy of the Front Desk menu — the PDF says not to do this |
| `hm_adm_reports` | 4 Admission reports, some of them **old v7.5 screens** (`InpatientOutstandingReportView`, old `AdmissionReportsView`) | Copy of the Admission menu, and not even the new version |
| `hm_reporting` ("Other Reports") | Management Reports (old hardcoded `SuperAdminReportsView`) + Inventory/Staff/Attendance/Salary/Commission reports that only show a **"not built"** placeholder | Placeholders, no real data |

#### 8.3.3 Target menu — ONE `REPORTS` group, 8 reports

| # | Menu id (new) | Report | Top filters (from PDF) | Main columns | KPI strip? |
|---|---|---|---|---|---|
| 1 | `sa_management_summary` | Management Summary | From/To, Department, Portal/User | Table by department: billing, collections, outstanding, active admissions, occupied beds | ✅ Yes: Total Billing, Collections, Outstanding, Expenses, Active Admissions, Occupied Beds, Pending Settlements |
| 2 | `sa_billing_collection` | Billing & Collection | From/To, Department, User/Cashier, Payment Method, Payment Status, Panel | Invoice No, patient/payer, department, gross, discount, net, collected, outstanding, payment method, Collected By | ❌ No |
| 3 | `sa_outstanding_panel` | Outstanding / Panel | From/To, Payer Type (Self-Pay/Panel), Panel, Department, Status | Invoice No, patient, payer type, panel/company, net, paid, due amount, status | ❌ No |
| 4 | `sa_admission_bed` | Admission & Bed Summary | From/To, Department, Doctor, Ward, Admission/Discharge Status | Department/ward rows: admissions, discharges, active patients, occupied/available beds, Hospital due, discharge status | ✅ Yes (summary report) |
| 5 | `sa_expense` | Expense Report | From/To, Category, Payment Method, Entered By | Date, category, amount, method, details/reference, Entered By | ❌ No |
| 6 | `sa_balance_settlements` | Balance Sheet & Account Settlements | From/To, Portal, User, Settlement Status | Per user: opening/petty cash, cash collections, expenses/refunds, expected cash, physical cash, variance, submitted, accepted, remaining | ❌ No |
| 7 | `sa_staff_payroll_commission` | Staff / Payroll / Doctor Commission | Payroll Period, Department, Staff/Doctor, Status | Staff/doctor, attendance days, salary basis, payroll amount, doctor commission amount, status | ❌ No |
| 8 | `sa_inventory_pharmacy` | Inventory / Pharmacy Summary | From/To, Category/Department, Status | Purchases/stock movement, low stock/expiry, Pharmacy request/clearance counts — summary only | ✅ Yes (summary report) |

Every dropdown is fed by one endpoint (`GET /reports/management/filter-options`: departments, doctors, wards, cashiers/users, portals, panels, expense categories, staff) so all 8 reports use the same lists.

#### 8.3.4 Data source per report (checked against `schema.prisma`)

| # | Backend endpoint (new, under `/api/v1/reports/management/*`) | Source |
|---|---|---|
| 1 | `/summary` | `HospitalInvoice` + `PaymentReceipt` (billing/collections/outstanding), `UserCashBalance` category EXPENSE/PURCHASE (expenses), `AdmissionRecord` + `Bed` (admissions/beds), `AccountSettlement` status SUBMITTED (pending settlements) |
| 2 | `/billing-collection` | Same query shape as Front Desk Invoice Register + collection (method, Collected By) — **reuse the service code** from `frontdeskReports.service.ts`, add the Cashier and Panel filters |
| 3 | `/outstanding-panel` | Reuse the Front Desk outstanding query, add `corporatePanelId` filter + panel name column |
| 4 | `/admission-bed` | Reuse the Admission Summary service (`/reports/admission/summary`), add Ward + Doctor rows grouping as needed |
| 5 | `/expenses` | **There is no `Expense` table.** Built from `PurchaseOrder` (inventory purchases: amount, paymentMethod, invoice reference, createdBy) + `UserCashBalance` rows with category `EXPENSE` / `PURCHASE` / `PETTY_CASH_ISSUE`. Category filter = these source types. ⚠️ Limit: plain `UserCashBalance` expense rows have no free-text details field — reference column will show the linked receipt/PO number where one exists |
| 6 | `/balance-settlements` | `UserCashBalance` grouped per user + module scope (Portal filter = `BILLING` / `INVENTORY` / `PHARMACY`), joined to `AccountSettlement` (expected, physical, variance, submitted/accepted, status) |
| 7 | `/staff-payroll-commission` | `SalarySlip` (+ `PayrollRun` period, status) + `AttendanceRecord` payable days + `DoctorCommissionAccrual` per doctor for the same period |
| 8 | `/inventory-pharmacy` | `PurchaseOrder` / `StockLedger` movement, low stock (`StockItem` below reorder level), near-expiry (`MedicineBatch.expiryDate`), `PharmacyClearance` counts by status |

#### 8.3.5 Steps (we do them one by one; each step ends with `tsc` clean + browser test before moving on)

| Step | What gets done | Done when |
|---|---|---|
| **Step 1 — Menu cleanup** | Remove the `hm_fd_reports`, `hm_adm_reports` and `hm_reporting` groups from `CANONICAL_HOSPITAL_MANAGEMENT_NAV_GROUPS`. Add ONE `REPORTS` group with the 8 menu ids from §8.3.3. Remove the Super Admin routing for all old Front Desk/Admission report ids and the "not built" placeholders in `SuperAdminModuleView.tsx` (old ids redirect to the nearest new report so bookmarks don't break). Front Desk and Admission portals are **not touched**. | Super Admin + Admin sidebars show only 8 reports; no Front Desk/Admission report pages reachable from Super Admin; FD/Admission portals still work |
| **Step 2 — Shared base** | Backend: new `managementReports.{schemas,service,controller}.ts` + routes under `/reports/management`, plus `/filter-options`. Check Admin role has `reports:view`. Frontend: `features/superAdmin/reports/` folder, `managementReportsService.ts`, reuse `GenericReportView` + `reportFilters.tsx` (`useReportFilters`, `FilterSelect`). | Filter-options endpoint returns data for both `superadmin` and `admin` |
| **Step 3 — Report 1: Management Summary** | Endpoint + screen, KPI strip (7 totals), per-department table, row **View** drills into Report 2 filtered by that department | All 4 filters re-query the API |
| **Step 4 — Report 2: Billing & Collection** | Endpoint + screen, all 7 filters, totals row, row **View** → existing invoice detail | Filters confirmed in the API request |
| **Step 5 — Report 3: Outstanding / Panel** | Endpoint + screen, Payer Type + Panel filters, panel column | Same |
| **Step 6 — Report 4: Admission & Bed Summary** | Endpoint + screen, KPI strip, department/ward table | Same |
| **Step 7 — Report 5: Expense Report** | ⏸️ **Deferred (user, 2026-09-26):** a proper Expense Management module will be built later in Super Admin. Until then the menu item stays and shows a simple table page in the same report UI. Build the real report after Expense Management exists | Deferred |
| **Step 8 — Report 6: Balance Sheet & Account Settlements** | User-wise consolidated endpoint + screen, Portal/User/Status filters, row **View** → that user's settlement history | Figures match each cashier's own My Balance Sheet for the same period |
| **Step 9 — Report 7: Staff / Payroll / Doctor Commission** | Endpoint + screen, Payroll Period filter (month), Department, Staff/Doctor, Status | Same |
| **Step 10 — Report 8: Inventory / Pharmacy Summary** | Endpoint + screen, KPI strip, summary table only | Same |
| **Step 11 — Cleanup** | Delete unused old Super Admin report imports/files (`SuperAdminReportsView` report paths, `ReportModuleNotBuilt` usage, v7.5 view imports that are no longer referenced anywhere) | `tsc` clean, no dead imports |
| **Step 12 — Full browser test** | Playwright as `superadmin` **and** `admin`: open all 8, set every filter → Filter → confirm params reach the API → Reset → Excel/PDF/Print buttons work → totals row correct. Cross-check: Report 2 collection total = Front Desk Collection report total for the same period/filters | All 8 pass for both users |

Progress on these steps is logged in §8.6.

### 8.4 Admission — what was built (2026-09-25)

Browser-tested as the `admission` user (Playwright): all 7 sidebar reports open, every filter set → Filter → params confirmed in the API request → Reset clears and reloads. Backend + frontend `tsc` clean.

| # | Menu id | Screen / endpoint | Filters | Notes |
|---|---|---|---|---|
| 1 | `admission_reports` | `AdmissionSummaryView` → `GET /reports/admission/summary` | Period, Department, Ward, Doctor, Status | The only Admission report with a KPI strip (admissions, discharges, active, pending discharge, beds occupied/available, Hospital outstanding); table = per-department breakdown |
| 2 | `adm_register_report` | `AdmissionRegisterReportView` → `/admission/register` | Period, Department, Doctor, Ward, Panel/Self-Pay, Admission Status | Row **View** → running Hospital bill modal |
| 3 | `adm_census` | `CensusBedReportView` → `/admission/census-beds` | As-of Date, Department, Ward, Room/Bed (text), Bed Status | One combined screen: one row per bed + occupant. Past As-of dates use admit/discharge times against the admission's current bed (earlier beds are in #4) |
| 4 | `adm_transfer_los` | `TransferLosReportView` → `/admission/transfer-los` | Period, Admission No, Department, Ward, Doctor | One row per transfer; never-transferred admissions show one row. LOS in days |
| 5 | `adm_outstanding_balance` | `HospitalBillStatusReportView` → `/admission/hospital-bill-status` | Period, Admission No, Department, Payment Status, Hospital Clearance | Read-only. Charges, payments collected by Billing, outstanding (negative = credit), latest receipt, latest payment-request status. Pharmacy bill never included. Row **View** → running bill |
| 6 | `adm_pharmacy_requests` | `PharmacyRequestFulfillmentView` → `/admission/pharmacy-request-fulfillment` | Period, Admission No, Medicine (text), Request Status, Approval Status | One row per requested medicine: requested vs dispensed, Pharmacy invoice, clearance, high-cost approval |
| 7 | `adm_discharge_clearance_report` | `DischargeClearanceReportView` → `/admission/discharge-clearance` | Period, Department, Doctor, Clinical Status, Hospital Clearance, Pharmacy Clearance | Hospital and Pharmacy clearance always separate columns; Balance = Settled / Credit / Outstanding |

- "Stay overlaps the period" is the date rule for Summary, Transfer/LOS and Bill Status, so **Today** still shows every patient currently admitted (not only today's new admissions).
- Dropdown sources: `GET /reports/admission/filter-options` (departments, doctors, wards).
- Old v7.5 report ids (`adm_daily_summary`, `adm_bed_occupancy`, `adm_bed_transfers`, `adm_length_of_stay`, `adm_service_consumption`, `adm_payment_request_status`, `adm_medicine_fulfillment`, `adm_high_value_approvals`, `adm_pharmacy_clearance_status`) now route to the report that absorbed them. Old component files are untouched (Super Admin still imports some — clean up tomorrow).
- Shared helpers moved to `components/reports/reportFilters.tsx` (`useReportFilters`, `useFilterOptions`, `FilterSelect`, `opts`) — Front Desk and Admission both use them; Super Admin should too.
- `GenericReportView`: point-in-time reports (`noDateFilter`) now still show the filter bar when they pass `extraFilters`.

Known limits:
- **No "urgency" field** exists on Pharmacy requests in the schema — the column shows the request's notes ("Notes / Urgency") instead.
- Admission Summary's "Hospital Outstanding" sums only positive dues (patients in credit count as 0).

### 8.5 Next — start here

Super Admin / Admin reporting: follow the 12 steps in §8.3.5 in order, starting with **Step 1 (menu cleanup)**.

### 8.7 Super Admin / Admin — round 2 changes (2026-09-26, user feedback)

- **No KPI cards anywhere.** Management Summary and Inventory / Pharmacy Summary are now record tables (Section | Metric | Value); Management Summary also lists per-department rows. Admission & Bed Summary has its own endpoint `/reports/management/admission-bed` (reuses the Admission Summary service) with Occupied / Available Beds as columns.
- **Montserrat font** for Super Admin and Admin (same class as Front Desk: `html.portal-montserrat`, set in `App.tsx`).
- **Payment columns always visible:** `GenericReportView` got a `compact` prop (tighter padding, wrapping headers/text, money never wraps); management tables put PKR in the header (e.g. `Net (PKR)`). No horizontal scroll at 1440px+ on any of the 8 reports; at 1366px two tables scroll ≤ 56px.
- Billing / Outstanding: the Invoice # is the View action (opens invoice detail) instead of a separate Actions column.
- **Finance Control → Balance Sheets** now reuses the Front Desk `MyBalanceSheetView` (new optional `userId` / `title` / `filterExtra` props) with a User dropdown — identical layout, read-only (no Settle button).
- **Finance Control → Account Settlements** now uses `GenericReportView` (Period default All Time, User, Status) with Review / View / Reverse row actions; review and reverse modals unchanged. Backend `/cash/finance-control/settlements` accepts `preset=all`.
- Removed unused `FinanceKpiStrip.tsx`, `FinanceDateFilterBar.tsx` and their service functions.
- **Security:** `/cash/balance-sheet/:userId` and `/cash/finance-control/*` GETs now need `cash:approve` (Admin / Super Admin). Before, any Front Desk cashier could read another cashier's balance sheet. Verified: Front Desk → 403 on another user, 200 on own sheet.
- **Shared bug fixes (Front Desk benefits too):** Excel export failed for any report whose title contains "/" (sheet-name rule) — fixed in `tableExportService`; totals row showed Discount without PKR (regex matched "disCOUNT") — fixed.
- Not browser-tested: Accept / Partially Accept / Return / Reject / Reverse on a real settlement — the dev DB was reset by the user during testing, so no settlements exist.


### 8.8 Expense Management (2026-09-26)

Super Admin **and Admin** manage hospital operating expenses (user decision — Admin included). Every other role gets 403.

- **Schema** (migration `20260926170000_expense_management`, additive only, generated by static schema diff): `Expense` (EXP-26-0001 numbering, date, category, amount, payment method, paid to, reference, details, optional department, status ACTIVE/VOID + void reason/by/at, created/updated by) + enums `ExpenseCategory` (12 fixed categories) and `ExpenseStatus`.
- **Backend** `modules/expenses` at `/api/v1/expenses`: `GET /` (Period incl. All Time, Category, Payment Method, Entered By, Department, Status ACTIVE/VOID/ALL), `GET /:id`, `POST /`, `PUT /:id`, `POST /:id/void`. Permission key `expenses` (SUPER_ADMIN + ADMIN full). Entries are never deleted — voided with a reason; a voided entry cannot be edited. Global audit-log middleware records every write.
- **Frontend**: Financial Control → Expenses = `features/superAdmin/expenses/ExpenseManagementView.tsx` (GenericReportView table + Add Expense button via new `headerActions` prop, Edit / Void per row, Add/Edit form modal, Void modal). Reports → Expense Report reads the same data.
- Management Summary now shows **Hospital Expenses (Expense Management)** separately from **Cashier Drawer Expenses / Purchases** (`UserCashBalance`).
- Expenses do not touch any cashier's balance sheet — they are recorded centrally by management.
- Browser-tested as `superadmin` and `admin`: add → edit → shows in Expense Report → void → hidden from active list, shown under Status "All" with reason; totals exclude voided. API: Front Desk 403 on list/create; bad amount rejected; voided entry edit rejected. Test entries removed afterwards.
- Also fixed in `GenericReportView`: any header containing "id" (e.g. "Paid To") was styled as an ID column — now matches whole words only.

### 8.6 Super Admin / Admin — progress log

| Step | Status | Notes |
|---|---|---|
| 1 Menu cleanup | ✅ Done 2026-09-26 | `hm_fd_reports` / `hm_adm_reports` / `hm_reporting` replaced by ONE `hm_reports` group (8 ids = keys of `MANAGEMENT_REPORT_VIEWS` in `features/superAdmin/reports/ManagementReports.tsx`). All Front Desk / Admission report imports + routing removed from `SuperAdminModuleView`; old report URLs now redirect (real URL change) to the management report that replaces them; Super Admin dashboard links point to the new ids. New pages show a temporary "Report is being built" state. Browser-tested as `superadmin` and `admin`: sidebar shows only the 8 reports, old groups gone, 6 old URLs redirect correctly; Front Desk + Admission smoke test still 42/42 pages OK |
| 2 Shared base | ✅ 2026-09-26 | Backend `managementReports.{schemas,service,controller}.ts`, routes `/reports/management/*`, new permission `management-reports` (ADMIN + SUPER_ADMIN only; Front Desk gets 403). One `/filter-options` endpoint. Frontend `services/managementReportsService.ts` + `features/superAdmin/reports/ManagementReports.tsx` (reuses `GenericReportView` + `reportFilters`) |
| 3 Management Summary | ✅ built, awaiting user review | 7 KPIs + per-department table. Collections = Front Desk Collection report total (verified 23,800 = 23,800) |
| 4 Billing & Collection | ✅ built, awaiting user review | 6 filters, row View → invoice detail |
| 5 Outstanding / Panel | ✅ built, awaiting user review | Rows chosen by amount due (panel invoice can be PAID by patient while panel still owes) — Patient Due / Panel Due / Total Due columns. Total = Summary outstanding (10,500) |
| 6 Admission & Bed Summary | ✅ built, awaiting user review | Reuses `AdmissionSummaryView` + `/reports/admission/summary` with its own title |
| 7 Expense Report | ✅ 2026-09-26 | Reads Expense Management (§8.8): Period, Category, Payment Method, Entered By. Voided entries excluded |
| 8 Balance Sheet & Settlements | ✅ built, awaiting user review | Per user per portal (Billing/Inventory/Pharmacy) |
| 9 Staff / Payroll / Commission | ✅ built, awaiting user review | Month filter |
| 10 Inventory / Pharmacy Summary | ✅ built, awaiting user review | 5 KPIs + per stock item table (no stock items in dev DB yet) |
| 11 Cleanup | ✅ 2026-09-26 | Deleted unused `SuperAdminReportsView.tsx`. Also fixed `GenericReportView` totals row printing Discount totals without PKR (regex matched "disCOUNT") — affects Front Desk reports too |
| 12 Full browser test | ✅ first pass 2026-09-26 | All 8 as `superadmin` and `admin`: every filter reaches the API, Reset works, no errors. FD/Admission smoke 42/42 still OK |
