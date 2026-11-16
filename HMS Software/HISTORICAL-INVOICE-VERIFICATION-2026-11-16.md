# HMS Historical Invoice / Remaining Collection Verification

Date: 16 November 2026. Scope: HMS only.

## 1. Root cause and existing behavior

The canonical `invoicesService.collectPayment` already appended a PaymentReceipt to the existing HospitalInvoice and updated only cumulative paidTotal/status. It did not replace the original invoice, change its createdAt, or overwrite the first receipt. Commission synchronization and cashier custody already ran inside its transaction.

Confirmed defects were:

- Front Desk invoice/outstanding reports and the executive dashboard used current paidTotal/current status to answer historical questions. Paid invoices could disappear from earlier outstanding reports.
- Some outstanding queries only selected invoices created inside the reporting window, excluding older unpaid invoices.
- Hospital Receivables had a latest-200 row cap, hiding older unpaid balances.
- Management Billing & Collection selected by invoice date and displayed lifetime collections. Later installments on older invoices were absent from the collection period.
- The collection endpoint had no idempotency key. Its existing invoice/admission advisory lock prevented simultaneous reads of stale balances, but a retry could still create another valid partial receipt.
- Invoice-level admission collection allowed amounts above the invoice balance. Remaining-payment collection now caps at invoice debt; legitimate admission deposits remain in the existing admission-billing advance workflow.
- The remaining-payment UI combined discount editing with payment. Receipt history omitted collector display. Digital receipts had no named-account field.
- Thermal reprint of the first installment could use today's paid status and later payments, falsely printing zero historical outstanding.
- The invoice ledger treated negative refund receipts as zero-value voids.
- Management custody opening relied only on prior settlements, omitting older un-settled cash.

## 2. Files changed

Paths below are relative to `HMS Software/`.

| Area | Files |
|---|---|
| Database | `backend/prisma/schema.prisma`; `backend/prisma/migrations/20261116160000_historical_collection_safeguards/migration.sql` |
| Canonical payment API | `backend/src/modules/frontdesk/invoices.service.ts`, `invoices.schemas.ts`, `invoices.routes.ts` |
| Historical balance utility | `backend/src/shared/invoiceAsOf.ts` |
| Reports | `backend/src/modules/reports/frontdeskReports.service.ts`, `frontdeskBilling.service.ts`, `managementReports.service.ts`, `dashboard.service.ts`, `admissionReports.service.ts` |
| Custody account metadata | `backend/src/modules/cash/cash.service.ts` |
| Front Desk UI | `frontend/src/features/frontDesk/billing/HospitalInvoicesView.tsx`, `InvoiceDetailModal.tsx`; `frontend/src/services/invoiceService.ts` |
| Management report UI | `frontend/src/features/superAdmin/reports/ManagementReports.tsx`; `frontend/src/services/managementReportsService.ts` |
| Historical reprints | `frontend/src/components/common/ThermalPaymentReceipt.tsx`; `frontend/src/utils/receiptSettlement.ts` |
| New regression coverage | `backend/tests/historicalInvoiceCollectionsDatabase.test.ts`; `backend/tests/receiptSettlement.test.ts` |
| Updated existing test fixtures/contracts | `backend/tests/dashboard.test.ts`, `frontdeskBillingRefund.test.ts`, `admissionAdditionalPayment.test.ts`; `backend/audit/known-issues.test.ts` |
| Build / evidence | `backend/api/index.js`; `backend/tsconfig.tsbuildinfo`; `backend/historical-regression-results.json`; this report |

No Pharmacy Software file, database, or integration contract was changed by this task. The pre-existing modified `Pharmacy Software/frontend/src/pages/StockInPage.tsx` was left alone. The HMS-to-Pharmacy notification payload and allocation block were retained.

## 3. Original invoice / new receipt workflow

Front Desk selects **Collect Remaining Payment** on the original invoice. The form defaults to outstanding, accepts a smaller positive installment, and retains the request key for retries of the same payment details. Historical/previously collected invoices do not expose the payment form's discount editor.

The existing API authorizes Front Desk/Billing create access, validates monetary precision, locks the invoice's existing accounting scope, checks the request key and remaining amount, then creates one receipt and its linked custody entry. Both use the same actual collection timestamp. It updates only paidTotal/status and invokes the existing collection-based commission synchronization. All writes commit or roll back together.

The public invoice payment endpoint now requires a UUID requestKey. Non-cash collections require a named receiving account. Refund calls from this UI also carry a stable request key. Replay of an already-successful collection returns its original receipt; changed details are rejected.

Invoice number/date, admission linkage, original line IDs, prices and discounts remain intact. The refreshed invoice shows all individual receipts, dates, methods/accounts, amounts and collectors. A historical receipt reprint stops at that receipt's installment instead of using later clearance.

## 4. Numerical verification

Before values below are the behavior identified in the original code; after values are asserted by the regression tests.

| Scenario | Before | Verified after |
|---|---|---|
| Original invoice | Already preserved | Exactly 1 invoice; original 1-Nov timestamp and lines unchanged |
| 500 on 1 Nov + 500 on 16 Nov | Separate receipts already supported; retries unprotected | Exactly 2 receipts; cumulative paid 1,000; status PAID |
| 1-Nov outstanding after later clearance | Current status/paidTotal could yield 0 | 500 |
| 16-Nov new billing for that invoice | Invoice-date engine already leaves billing on 1 Nov | 0 |
| Collection income on each payment day | Canonical receipt-based summary already recognizes installments | 1 Nov: 500; 16 Nov: 500 |
| Old-invoice row in Billing & Collection on 16 Nov | Omitted by invoice-date filter | Invoice Net 1,000; New Billing 0; Collected in Period 500; Outstanding 0 |
| First-receipt reprint after clearance | Could show previously paid 500 / outstanding 0 | Previously paid 0; receipt 500; outstanding 500 |
| 10,000 invoice / three installments | Supported without retry protection | 4,000 + 3,000 + 3,000; exactly 3 receipts; PAID |
| Mixed departments, 60:40, installment 500 | Existing canonical allocation retained | Department allocations 300 + 200 |
| 20% doctor commission, two receipts of 500 | Existing collection calculation retained | Two accruals of 100; total 200; replay does not add accruals |
| Refund of 100 on 17 Nov | Collection report netted it; invoice running ledger missed it | -100 once in 17-Nov collection; invoice ledger debt 100; 1-Nov snapshot still 500 |
| Concurrent requests, 700 + 700 against 1,000 | Existing lock retained | One succeeds, one rejects; paid 700 |
| Concurrent identical retry for remaining 300 | No request deduplication | Same receipt returned twice; final 2 receipts / 2 custody entries / paid 1,000 |
| IPD invoice 800; 200 then 600 | Historical status filtering could hide it | Earlier outstanding 600; final paid; original date/admission link preserved |
| Receivables with more than 200 newer rows | Older debt hidden | Original outstanding invoice remains visible with 205 newer unpaid fixtures |

## 5. Income and outstanding reconciliation

The real-database test compares Front Desk collection/billing, invoice register/ledger, receivables, Management Summary, Billing & Collection, executive dashboard and IPD outstanding.

- Billing stays on invoice createdAt.
- Collections use signed receipt collectedAt independently of invoice date.
- Cutoff debt reconstructs signed patient receipts and dated panel remittance allocations through report end, then applies the shared balance and department allocation functions.
- Historical status filters apply to reconstructed status instead of the current stored status.
- For each 500 collection in the fixture, applicable commission cost is 100 and collection-based operating profit is **400**. The test asserts these figures and `income - operating costs` directly.
- Custody transfers are not added to income or operating costs. Inventory purchase/expense recognition policy was not changed.

## 6. Departments and commission

The existing `allocateCollection`, `allocateInvoiceAmount`, department collection ledger, and `commissionService.syncInvoiceCollections` remain authoritative. Mixed-department receipts reconcile to the full installment in cents. Department Payables reports 500 realized on 16 Nov for the historical test invoice while new billing is zero. Commission remains tied to collection events, not unpaid invoice totals; repeated synchronization and payment retries do not generate extra accruals.

## 7. Cash / online / settlements

The 1-Nov cash receipt creates 500 physical custody for its actual collector. The 16-Nov bank receipt creates 500 non-physical collection for a different collecting user and records `HMS Bank Test Account`; it adds zero physical cash. The signed account breakdown is derived from the same receipts, not a separate posting engine. Linked refunds retain or explicitly identify their digital account.

Cashier Balance Sheets and Management Balance & Settlements were checked against receipt/custody amounts. The original collector still has 500 opening/remaining custody on 16 Nov before handover, even without a prior settlement. Management custody derives opening from historical physical entries less accepted handovers and their dated reversals.

Admission-role collection permission remains denied by the existing backend `frontdesk/create` authorization; admission clinical workflows were not given collection access.

## 8. Checks and limitations

- Targeted regression run: **13 files, 94 tests passed**, including the rollback database scenario and independent-connection concurrency test.
- Additional final rollback run, including explicit profit assertions and the >200 receivables case: **2 database tests passed**.
- Full HMS backend run: **478 passed, 10 failed, 9 skipped**. The remaining failures are in unchanged `phase5_admission.test.ts` (4), `phase6_inventory_pharmacy.test.ts` (3), and `inventorySafety.test.ts` (3); they concern existing admission/pharmacy mocks and inventory allocation/timeouts. They were not fixed because those modules are outside this change. Machine-readable output is `backend/historical-regression-results.json`.
- Frontend TypeScript check passed. Backend TypeScript compilation and build passed. Frontend production build passed; Vite retains its existing large-bundle warning.
- Additive migration applied successfully to the local `localhost:5432/chss_hms` database. No historical financial rows were rewritten.
- Main financial scenarios run inside a rollback-only transaction. The real concurrency test needs committed, uniquely tagged temporary fixtures; its exact rows were removed in `finally`. Final database check found **0 test invoices and 0 test users**. Receipt numbering may have unused numbers after these isolated concurrent test transactions, preserving uniqueness.
- Prisma generated the updated client/types, but its standard generation command reported a Windows lock while replacing the already-loaded native engine. The existing native engine successfully ran the updated client in database tests and builds. No unrelated process was terminated.
- Digital account attribution is a named snapshot on receipts and linked custody records. Existing rows without an account remain explicitly legacy/unrecorded; account names were not invented or backfilled. This does not introduce a separate bank master, opening-bank-balance system, or external bank reconciliation integration.
- Existing legacy positive void receipts have no timestamped void event. The change preserves current exclusion rules; an unknown historical void date cannot be inferred. The canonical negative-receipt refund path is verified to affect its own period once. Likewise, this change does not invent historical versions of service prices changed outside the remaining-payment flow.
- No production/cloud deployment or live browser financial posting was performed. Local API/build artifacts and the local database migration are ready.
