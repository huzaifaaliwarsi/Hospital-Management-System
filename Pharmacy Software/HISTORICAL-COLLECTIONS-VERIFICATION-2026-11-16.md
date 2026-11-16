# Pharmacy historical invoice and remaining collection verification

Implemented locally on 16 November 2026. Scope: standalone Pharmacy only. No HMS source, migration, database or integration contract was changed.

## Root cause and reference comparison

Pharmacy already stored retail installments in `PharmacyPayment`, and already reconstructed receipt-date collections and historical outstanding through `financialRecognition.ts`. HMS callbacks used deduplicated `PharmacyFinancialEvent` records. The main invoice API returned only invoices (limited to 200), and the table displayed current cumulative `paidTotal`. Consequently a later installment had no independent visible row. Retail remaining-payment posting locked the invoice but lacked a request identity and named payment-account attribution.

Like the completed HMS implementation, the Pharmacy listing now uses a read-only unified transaction projection. Original sales retain invoice references and dates. Subsequent receipts have distinct transaction IDs, their actual payment dates, zero new billing and their own collection amounts. Original rows retain their initial collection. Every row shows the invoice's latest outstanding; summary outstanding counts each invoice once. No zero-on-earlier-rows carry-forward redesign was introduced.

Pharmacy's accounting difference is preserved: partial receipts are collections immediately, but eligible revenue excluding tax and matched Medicine COGS are recognized only upon full payment. The recognition engine was not modified. HMS-linked collection history comes from the existing Pharmacy-side HMS callback events, not newly invented Pharmacy cash receipts. HMS patients continue paying at the authorized HMS Front Desk.

## Changes

Backend:

- `prisma/schema.prisma`: nullable receipt retry key, initial-payment marker and payment-account relation.
- `prisma/migrations/20261116190000_installment_receipt_safeguards/migration.sql`: additive columns, unique request key and account FK; no historical data rewrite.
- `src/modules/pharmacy/pharmacy.schemas.ts`: stable request identity, amount precision, bank/account support, transaction-list mode.
- `src/modules/pharmacy/pharmacy.routes.ts`: authorized read-only collection account endpoint.
- `src/modules/pharmacy/pharmacy.service.ts`: canonical posting now validates account, serializes retries and invoice updates, preserves original receipts, writes method/account/collector/date to the existing ledger; initial POS split receipts have explicit markers; receipt history includes account and HMS financial events. Existing return ledger records retain the selected refund account. Optional transaction injection supports rollback tests.
- `src/modules/pharmacy/invoiceTransactions.ts`: invoice/payment/HMS callback/refund display rows, stable unique row IDs and original invoice IDs; reconstructs original billing from existing dated return events.
- `src/modules/hms-requests/hms-requests.service.ts`: normal HMS collection callbacks reject amounts above remaining invoice balance. Existing authoritative reconciliation behavior and callback contract are preserved.
- `scripts/test-historical-collections.ts`, `package.json`: repeatable database-backed acceptance test command `npm run test:historical-collections`.
- `api/index.js`, `tsconfig.tsbuildinfo`: generated backend build outputs.

Frontend:

- `src/pages/InvoicesPage.tsx`: unified rows, receipt/account/collector/type/date columns, date/status/channel/search filters, unique rows, correct billing/collection/outstanding totals; **Collect Remaining Payment** beside Print and Refund for outstanding retail invoices. All actions resolve to the original invoice ID.
- `src/components/PharmacyInvoiceModal.tsx`: default outstanding amount, partial/full collection, stable retry identity, duplicate-click protection, selected account, complete retail/HMS event history and refresh after posting.
- `src/components/CollectionAccountSelect.tsx`: read-only selection of active collection accounts for authorized Pharmacy users; does not grant vendor/account-management access.
- `src/pages/PosPage.tsx`: named account selection for initial non-cash receipts, including bank transfer.
- `src/components/PharmacyDataTable.tsx`: opt-in full-filtered-result Print/PDF export for this listing, across pagination; other screens retain existing print behavior.
- `src/services/pharmacyApi.ts`: transaction-list opt-in; other invoice consumers retain invoice responses.
- `src/utils/transactionExport.ts`: shared original-invoice action mapping, cent-accurate summary with distinct-invoice outstanding, escaped export HTML used for invoice Excel and Print/PDF.

## Before / after and database evidence

Before: one invoice row with cumulative paid 700; no independent collection row.

After Scenario A:

| Date | Reference | Type | Billing | Collection | Current outstanding |
|---|---|---|---:|---:|---:|
| Nov 1 | same invoice | Original Sale | 1,000 | 500 | 300 |
| Nov 6 | same invoice | Remaining Collection | 0 | 200 | 300 |

Summary: billing 1,000; collections 700; outstanding **300**, not 600. Recognized revenue and COGS remain zero.

After Scenario B: a Nov 16 remaining-collection row shows billing 0 and collection 300. Database assertions verify exactly **one invoice and three receipts**, original date Nov 1, original service lines and original receipt unchanged, cumulative paid 1,000, status PAID and outstanding zero. Revenue 1,000, matched COGS 600, operating profit 400 in this no-tax/no-expense fixture; no repeated recognition on Nov 17. Existing regression tests separately verify tax exclusion.

Actual local data was also inspected read-only. `INV-0002` had two pre-existing receipts of PKR 6 each. The compiled backend now returns:

| UTC timestamp | Type | Billing | Collection | Outstanding |
|---|---|---:|---:|---:|
| 2026-11-16 11:29:22.766 | Original Sale | 12 | 6 | 0 |
| 2026-11-16 11:31:37.311 | Remaining Collection | 0 | 6 | 0 |

These rows reference the same invoice; payment and invoice row IDs are different. No live invoice or receipt was rewritten for this check.

## Reconciliation and testing

- **35 new database assertions passed**: actual POS initial posting, 500 + 200 + 300, immutable original date/lines/first receipt, initial collection retained, unique transaction rows, frontend summary, original-invoice action IDs, date filter and full print export data, overpayment and request-conflict rejection, selected account, independent concurrent collectors, concurrent identical retries, HMS callback retry and custody separation, return traceability and matched revenue/COGS reversal.
- **29 existing revenue database checks passed**: full-payment recognition, taxes/discounts, historical periods, cash/card/online, cashier attribution, HMS callbacks, reconciliation, returns, cancellation, expenses and no duplicate COGS recognition.
- **32 existing income/expense database checks passed**: vendor ledger, purchase payments, bank accounts/refunds, supplier advances, cash custody, carry-forward, account settlement and operating-profit reconciliation.
- Total: **96 passing database assertions**. Rollback tests preserved all existing records. The concurrency test created narrowly identified temporary invoices/users, then removed those fixtures in a scoped transaction. No concurrency-test invoices remained after completion.
- Nov 1 historical outstanding remains 500 after final clearance; Nov 6 remains 300. Nov 6 new billing is zero and collections are 200.
- Cash custody is 500; digital account movement is 500. All three collection ledger entries carry the actual collector. Retries do not add receipts or ledger entries.
- A later 100 bank refund appears once as a separate dated event; original displayed billing remains 1,000. Refund-period revenue changes by -100 and matched COGS by -60.
- Normal HMS collection callbacks cannot overpay. Duplicate callbacks yield one Pharmacy event and no Pharmacy cash-ledger collection. The existing authoritative historical reconciliation remains available.
- Backend typecheck and production build passed. Frontend TypeScript check and production build passed. Vite reports its existing large-bundle warning.
- Pharmacy local database `pharmacy_db` has **16 migrations applied**, no pending migrations. HMS was not migrated or modified.

## Limits and deployment notes

- No production deployment or interactive browser visual acceptance was performed. Verification used the actual database, canonical posting/report services, shared frontend helpers, compiled backend listing and both production builds.
- As in the HMS reference, transaction mode loads the complete matching dataset and the shared table performs filtering, sorting and pagination in memory; this avoids silently dropping old invoices behind the former 200-row limit. Very large datasets may warrant server-paged projection later.
- New retail POS receipts explicitly distinguish initial payments. Legacy rows have no such marker: receipts at the original invoice timestamp are treated as initial split payments; otherwise the earliest positive receipt on the invoice's Pakistan calendar day is treated as initial. Later receipts remain independent. No historical rows are backfilled or rewritten.
- HMS callbacks provide their existing receipt reference, date, method and collector. They do not provide a Pharmacy payment-account ID. Such collections belong to HMS custody; a Pharmacy bank account is not fabricated. Undated legacy reconciliation events remain explicitly undated, and the existing recognition engine flags incomplete history rather than inventing a reporting date.
- Existing return logic adjusts current invoice balances. The listing reconstructs original billing from the existing immutable return events and displays returns separately; this change does not replace the approved return engine.
- `prisma generate` encountered Windows EPERM while replacing a loaded native engine DLL. The generated client exposes the new fields and successfully passed all database tests/builds using the existing engine. A clean regeneration after the process holding that DLL is stopped remains an environment maintenance item; no unrelated process was terminated.
