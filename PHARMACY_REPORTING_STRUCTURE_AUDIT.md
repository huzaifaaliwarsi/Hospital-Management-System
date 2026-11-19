# Pharmacy reporting structure audit

Audit date: 19 November 2026. Scope: standalone Pharmacy only.

## Conclusion and evidence boundary

The ten management report pages exist and use a common API and table/export component. The five Sales views also have navigation entries. However, the implementation does **not yet satisfy the final reporting specification**. The main blockers are server-side Sales scope, incomplete reporting contracts, an Operating Profit completeness bug, incomplete historical balances, purchase draft inclusion, and incomplete settlement/return audit trails.

This is a source-code and reporting-structure audit, with seven isolated synthetic checks against the actual TypeScript financial modules. It is **not** production certification, a full browser acceptance run, or confirmation that all existing records reconcile. No patient data, production access, database calls, application mutations, business-rule changes, commits, pushes, or deployments were used in this audit. Existing background-sync changes were preserved.

Requirements: `Pharmacy Final Reporting.pdf`, all four pages, as captured in [Pharmacy requirements context](PHARMACY_FINAL_REPORTING_CONTEXT.md). The earlier [verification plan](HMS_PHARMACY_REPORTING_VERIFICATION_PLAN.md) remains the acceptance baseline. HMS implementation is deliberately deferred to the next audit.

References below use workspace-relative paths. `BE` means `Pharmacy Software/backend/src`; `FE` means `Pharmacy Software/frontend/src`. Line references identify the inspected revision and can move after later edits.

## 1. Current architecture

```text
Management navigation (10 pages) / Sales navigation (5 relevant views)
  -> App.tsx page selection
     -> ReportView.tsx for all management reports and My Shift Reports
        -> GET /api/v1/reports?type=...&from=...&to=...
           -> authenticate -> authorize(reports, view) -> Zod query schema
           -> reportsController.run (query only; no caller identity)
           -> reportsService.run
              -> Income & Expense / Operating Profit / Detailed Income
                 -> loadFinancialData -> projectInvoice -> financialReport
              -> seven other Prisma report projections
        -> common table, CSV, XLSX, browser Print / Save PDF
     -> InvoicesPage -> pharmacy invoice APIs
     -> HmsRequestQueuePage -> medicine-request APIs
     -> BalanceSheetPage -> own cash ledger API
     -> SettlementsPage -> settlement list/submission/review APIs
```

Core entry points:

- `FE/layout/navigation.ts:65`: ten management report entries; `:95`: Sales navigation.
- `FE/App.tsx:32`: report title/type mapping; `:144`: generic report page; `:155`: direct report-page rendering.
- `FE/components/ReportView.tsx:34`: column contract; `:176`: shared query/UI; `:215`: export fetch.
- `BE/app.ts:57`: authentication before `/api/v1/reports` mounting at `:67`.
- `BE/modules/reports/reports.routes.ts:10`: one permission for all report types.
- `BE/modules/reports/reports.schemas.ts:4`: ten supported types; query supports date, method, cashier and limit.
- `BE/modules/reports/reports.service.ts:29`: dispatcher, default 2,000 rows for seven operational reports. Financial reports do not apply this row limit.

The routes are authenticated. The access defect below is authorization/scope **after login**, not an unauthenticated public endpoint.

## 2. Management reports: complete requirement mapping

“Partial” means identifiable code exists, but the stated specification has gaps; it does not mean financial acceptance passed.

| ID / existing menu | Current source and row grain | Present | Missing / incorrect | Status |
|---|---|---|---|---|
| M01 Income & Expense | `incomeExpense.ts:5`; financial event projection plus vendor ledger; metric rows | Gross/net billing, actual collections, outstanding, recognized revenue, matched COGS, opex, supplier payments/advances separately | Payment-method/source breakdown absent from table; stock losses not loaded; historical candidate/completeness limitations below | Partial |
| M02 Operating Profit | `operatingProfit.ts:10`; same canonical engine, extra metrics/trend/drill-down payload | Tax-exclusive full-payment revenue, COGS, opex, gross/net profit, vendor informational figures | Overrides unavailable profit, omits separate stock-loss source; response drill-downs/trend ignored by shared frontend; trend dates incorrect for installments | Partial; financial blocker |
| M03 Detailed Income | `reports.service.ts:38`, `financialRecognition.ts:325`; one row per invoice | POS/HMS channel, billed, collected, due, recognition, seller/collector names, exceptions | No invoice-line or individual receipt/installment rows, no clickable source link; recognizedAt returned but not displayed; cashier filter affects collections only | Partial |
| M04 HMS Request / Dispense | `reports.service.ts:59`; one row per request | Request/admission, patient snapshot, requested/dispensed quantities in text, invoice/due/clearance, last handler | No batch/expiry, approved quantities, approver/time, separate dispense events/actors, historical as-of invoice balance | Partial |
| M05 Purchase Inward | `reports.service.ts:90`; purchase header | GRN, vendor, purchase date, payment type, header totals | Includes DRAFT; no line medicine/batch/expiry/landed-cost detail or return-netting; receiver key mismatch; supplier invoice returned but not shown | Partial; totals blocker |
| M06 Stock Movement Audit | `reports.service.ts:124`; ledger entry | Movement type, item, signed qty, timestamp | Batch/actor keys mismatch; cost/value/reference not returned; no expiry/opening/closing reconciliation or historical cost valuation | Partial |
| M07 Vendor Payables Ledger | `reports.service.ts:147`; vendor ledger entry | Vendor, signed amount, entry type | Actor/time/reference contract gaps; no vendor filter, opening/closing or per-vendor running balance; signed global sum is not a payables statement | Partial |
| M08 Detailed Expense | `reports.service.ts:173`; expense | Category/date/amount/method/payee/description/entered/approved by | Voucher/reference/account/approval timestamp not projected; no reversal model in reviewed Expense schema; approved and unapproved amounts included | Partial; eligibility decision required |
| M09 Sales & Purchase Returns | `reports.service.ts:201`; cash refund + supplier credit entries | Sales invoice reference where available, party, refund/credit amount, actor/date/reason | No medicine/qty/batch/disposition/recognized reversals; customer credit differs from cash refunded; purchase source lost; mixed amount signs can cancel in total | Partial |
| M10 Balance & Drawer Settlement | `reports.service.ts:295`; submission | Submitter, period, expected/count/variance/status/reviewer | Not a full drawer ledger; variance reason omitted; accepted amount returned but not displayed; no partial acceptance, receiver transfer trail, opening/post-settlement cash or reviewed timestamp | Partial |

Keeping the ten existing names is appropriate. The principal work is completing their data contracts and scoped behavior, not adding more menu entries.

## 3. Sales reporting and authorization

| Sales requirement | Current implementation | Audit result |
|---|---|---|
| S1 My Sales Invoices | `InvoicesPage`; `/pharmacy/invoices` and detail API | Controller passes query/id without user (`pharmacy.controller.ts:85,94`); service receives no caller scope (`pharmacy.service.ts:1663,1999`). “My” label is not enforced by these read paths. |
| S2 Prescriptions Queue / HMS Dispensing | Shared queue and detail endpoints | `hms-requests.controller.ts:42,46` omit caller scope; `hms-requests.service.ts:275` filters only status. No explicit assigned-user restriction found in these paths. Confirm whether queue is explicitly shared by policy before restricting dispensing workflow. |
| S3 My Balance Sheet | `/cash/balance-sheet` | Correct identity boundary in `cash.controller.ts:14`: passes authenticated `req.user.sub`; ledger filters that user. This is structurally stronger than report/list APIs. Still needs monetary fixture reconciliation. |
| S4 My Settlement | Shared `SettlementsPage` | Page fetches `/cash/settlements` without userId (`:24`); controller `:28` passes query only; service `:170` uses optional caller-supplied userId. Sales can see other users' submissions. Review write action is management-only via cash edit permission. |
| S5 My Shift Reports | Sales menu points to `reports-sales` | Renders company-wide Detailed Income, not a scoped shift report. No authenticated user or shift boundary in report request. All ten report tabs appear. |

### P1 — Server authorization and scope blocker

`BE/middleware/authorize.ts:39` grants Sales `reports:view`; `reports.routes.ts:10` applies it to every report type; `reports.controller.ts:7` passes no actor. The service does not add role restrictions. Therefore the existing authenticated Sales route chain permits management financial/vendor/settlement reports. Frontend tabs in `ReportView.tsx:316` expose all types, and direct report-page rendering in `App.tsx:155` has no Sales restriction.

Required future correction: enforce allowed report types and own/assigned scope on the server, including detail and export queries. Do not rely on a browser userId. Preserve management access and explicit shared assignments. Add negative tests for cross-user invoice IDs, altered userId/cashierId, and every disallowed report type. This audit did not issue live requests to exercise access against real data.

`financialRecognition.ts:218` applies cashierId/method only to collection events; invoice revenue, due and rows remain company-wide. Supplying cashierId would therefore not fix the “My Shift” defect. Synthetic check reproduced this behavior.

## 4. Confirmed frontend/API contract mismatches

Missing values render as a dash (`ReportView.tsx:128`). The same column definitions drive exports, so these gaps affect both table and downloaded output.

| Report | Frontend expects | API returns / omits | Evidence |
|---|---|---|---|
| Purchase | `enteredBy`, `createdAt` | `receivedBy`; no createdAt | FE `ReportView.tsx:70`; BE `reports.service.ts:103` |
| Stock | `batchNumber`, `actor` | `batch`, `performedBy` | FE `:77`; BE `:134` |
| Stock | `unitCost`, `lineValuation`, `reference` | None of these | FE `:79`; BE `:134` |
| Vendor | `enteredBy`, `occurredAt`, `referenceId` | `actor`, `createdAt`; referenceId omitted | FE `:89`; BE `:161` |
| Settlement | `varianceReason` | Omitted | FE `:120`; BE `:305` |

These are reproducible source-contract defects, not claims that the source records lack actors or references. Map existing fields where possible; derive cost and balances from approved historical sources rather than inventing missing amounts.

## 5. Financial calculation audit

### What is already structurally sound

- Income & Expense and Detailed Income share `financialReport`; Operating Profit calls it too.
- `projectInvoice` orders sale/payment/return events, records period collections on event dates, and recognizes tax-exclusive revenue once the running invoice balance is fully paid (`financialRecognition.ts:155,188`). Decimal arithmetic is used.
- Synthetic invoice 1,000 / historical cost 600: at 500 paid revenue is 0; at 700 paid revenue is 0; at 1,000 paid revenue is 1,000 and COGS is 600. These three checks passed against the actual module.
- Supplier payments are separately presented by both statement wrappers; they are not directly subtracted as operating expenses.
- Sale cost snapshots are written during retail dispensing (`pharmacy.service.ts:1199`). Reporting first reads the snapshot, then legacy batch cost (`financialRecognition.ts:80`).
- HMS collection recording uses invoice locking and receipt identity checks (`hms-requests.service.ts:787`); it creates financial events rather than automatically treating FrontDesk receipts as Pharmacy drawer cash. Cross-application acceptance remains unverified here.
- Returns use invoice locking, optional request keys and quantity limits (`pharmacy.service.ts:1861`). These are safeguards, not proof of all refund/custody scenarios.

### P1 — Operating Profit bypasses incomplete-history protection

The canonical engine returns null operatingProfit when any invoice lacks reliable history/cost (`financialRecognition.ts:360`). `operatingProfit.ts:64` recalculates profit directly and `:229` overwrites the canonical result. A synthetic fully paid 1,000 invoice with missing cost produces canonical null profit but Operating Profit 1,000. This was executed and reproduced without a database.

`projectInvoice` adds the missing-cost issue only after the event loop (`:230`), so revenue/COGS accumulators may already contain partial values. Preserve an explicit completeness contract across all reports, totals, drill-downs and exports. Do not silently substitute zero cost or display incomplete profit as finalized.

### P1 — Historical outstanding can omit invoices settled after the report end

`loadFinancialData` (`financialRecognition.ts:268`) selects prior invoices by in-period activity or their **current** status not PAID. Example: invoice issued in September, unpaid on October 31, paid in November, and currently PAID. For October with no October activity, none of these candidate clauses includes it. Historical October receivables can therefore omit it. A synthetic query-capture check confirmed the candidate shape; the monetary database scenario remains a required regression fixture.

The projection can calculate a historical balance only if the invoice is actually loaded. Do not optimize the query by dropping relevant pre-period history.

### P1 — Purchase Inward includes unposted drafts

Both rows and aggregate in `reports.service.ts:90` filter only purchaseDate. Purchase creation explicitly supports DRAFT without posting stock/ledger (`vendors.service.ts:212,348`). Thus a draft's proposed amounts are included in a report described as goods received. Header status is returned but not displayed. Future correction must distinguish posted inward from drafts and account for returns without changing purchase posting rules.

### P2 — Stock losses absent from profit data sources

`loadFinancialData` reads invoices, refund ledger and Expense only (`financialRecognition.ts:279`). `createStockAdjustment` records stock-adjustment/stock-ledger data (`pharmacy.service.ts:1118`), not Expense. There is no separate loss valuation deduction in the reviewed statement engine. PDF-required stock-loss treatment is incomplete. Agree valuation and prevention of double-counting against retained COGS before implementation.

### P2 — Expense eligibility is underspecified in code

Every Expense in the date range is summed, regardless of approval. Expense creation posts cash immediately and approval is a separate action (`expenses.service.ts:10,33`). The schema has approval fields but no reversal/status structure (`prisma/schema.prisma:834`). The code behavior is confirmed; whether all entered expenses are valid opex needs a business decision. Do not retroactively exclude unapproved cash payments without an agreed rule and reconciliation.

### P2 — Daily trend is not an event-date timeline

`operatingProfit.ts:172` places an invoice's entire period collections and sales on recognizedAt or createdAt. Installments across several days therefore do not retain their receipt dates in this trend. `:149` buckets by UTC date, despite Pakistan date filters. The shared frontend currently discards trend/drill-down payloads; fix semantics before exposing them. `financialRecognition.ts:375` already provides a separate timeline helper worth evaluating, not blindly substituting.

### P2 — Return amount and reference semantics

- Sales return report reads cash refunded, not full invoice credit. For a partially/unpaid invoice these can differ (`pharmacy.service.ts:1932`; `reports.service.ts:201`). Quantity, credit and physical refund need separate columns.
- Vendor return creation stores negative RETURN_CREDIT with `referenceTable: purchase_returns` (`vendors.service.ts:498`), while report `originalRef` only handles `purchases` (`reports.service.ts:264`). This path loses the source reference in the report.
- Report total adds positive customer cash refunds and negative vendor credits (`reports.service.ts:283`), so unlike movements can cancel. Split totals or clearly specify signed net movement.
- `salesReturn` adds saleable stock immediately when restock is true (`pharmacy.service.ts:1913`); schema defaults restock to true (`pharmacy.schemas.ts:152`). No quarantine/inspection approval step is present in this return path. PDF-safe return disposition is not fully represented. This is a business/safety gap to verify, not a change made during this audit.
- COGS reversal is applied only for restocked quantity (`pharmacy.service.ts:1899`); unsafe-return cost retention must reconcile with the chosen loss policy.

## 6. Stock, cost and actor traceability

Retail FEFO allocator orders expiry then batch createdAt, excludes expired/empty batches, and uses a stock transaction lock (`pharmacy.service.ts:98`). Batch cost is captured into invoice lines. Non-batch stock uses medicine purchaseRate rather than receipt-lot FIFO cost (`:111`). Receipt time versus batch creation time, and non-batch FIFO costing, require fixtures and policy confirmation.

The stock report itself does not prove FEFO or opening + in - out = closing: it returns only truncated movement rows and no balance/cost reconciliation. StockLedgerEntry contains reference IDs and actor but no movement cost snapshot (`prisma/schema.prisma:381`). Historical report valuation needs an explicit join to immutable purchase/sale/adjustment evidence.

Actor coverage is uneven:

- Detailed Income shows invoice-level dispensedBy as soldBy, and aggregated collector names; it is not a receipt-level collector audit.
- HMS Dispense shows request handledBy as dispensedBy. A request handled by multiple staff or rejected by a handler cannot be fully reconstructed from that single display field.
- Expense has entered/approved names, but not approval timestamp in the report.
- Purchase, stock and vendor source actors exist but are lost by contract mismatches.
- Settlement shows submitted/reviewed names but omits reviewedAt and the receiving custody record.

Required target: stable original IDs, source module, event timestamp, actor ID/name and appropriate business document reference for each displayed event. Existing pages may offer detail elsewhere; that does not establish traceability in the report/export itself.

## 7. Cash and settlements

Own balance is derived from the authenticated user's signed physical cash entries. Non-physical receipts are separated; handovers are excluded from activity expenses (`cash/balanceSheet.util.ts:3`). Pakistan date presets exist (`:36`). Historical opening/closing calculation also incorporates accepted settlement variance (`cash.service.ts:77`). These formulas require agreed variance/custody examples before sign-off.

Confirmed gaps:

1. Settlement list scope is missing, as described in section 3.
2. Review schema supports only ACCEPTED/REJECTED, no accepted amount or partial outcome (`cash.schemas.ts:48`). Acceptance settles all qualifying earlier physical entries and hands over all physicalCash (`cash.service.ts:148`). PDF partial-acceptance/carry behavior is absent.
3. Accepted handover creates a sender OUT row; reviewed path has no matching receiver IN row (`cash.service.ts:157`). Reviewer identity is not proof of cash receipt. Receiver/custody modeling needs agreement.
4. Submission does not enforce a single pending settlement in the service; the read path exposes pendingSettlement but submission itself proceeds (`cash.service.ts:113`). Review checks status then updates without a guarded status update or lock (`:141`). Duplicate submission/concurrent review are risks requiring a concurrency test; this audit did not reproduce concurrent writes.
5. Management settlement report filters submittedAt, not reviewedAt. A period's submissions and a period's accepted custody movements are different reports; current header rows do not reconcile both.

## 8. Filters, exports, freshness and resource behavior

### Filters and dates

- Shared UI sends Pakistan start/end timestamps (`ReportView.tsx:195`) but displays timestamp cells with the browser's timezone (`:139`). Displayed dates can disagree on a non-Pakistan workstation.
- General schema does not reject from > to (`reports.schemas.ts:19`). Date-only API end dates are expanded in UTC (`reports.service.ts:11`); UI offset dates are a different convention.
- UI offers date filters only. Vendor, medicine/batch, source/channel, actor, status and shift filtering required for practical reconciliation are not present in these shared reports.
- Backend method/cashier parameters exist but apply only to Detailed Income collection projection, not every report.
- Operational date filters select different business events: request date, purchase date, ledger creation, expense date, refund occurrence, settlement submission. Export headers should state that meaning.

### Export integrity gaps

- Export re-fetch stops at 50,000 rows (`ReportView.tsx:224`) while the UI promises all records (`:407`). No pagination beyond that cap.
- On full-export fetch failure it silently returns visible rows (`:228`), producing an incomplete file without an error.
- Financial reports ignore limit altogether. Large historical exports remain unbounded in those paths.
- XLSX/Print append totals only for Detailed Income (`:284`); purchase/expense/return/vendor aggregate footer figures visible in UI are not appended by the common export builder. Metric statements contain their totals as rows.
- CSV omits the title/period rows included in XLSX/Print (`:267`). CSV also formats money as display strings instead of numeric cells.
- Browser Print supports Save PDF; no dedicated PDF generation/visual verification was performed. Popup handling and wide-table pagination need browser checks.
- Rows and full-dataset aggregates are separate concurrent queries, without a consistent snapshot (`reports.service.ts:90` etc.). A write between reads can create discrepancies; no production occurrence measured.

### Freshness and workload

- Report query has 30-second staleTime, no polling (`ReportView.tsx:188`). Global focus-refetch is disabled (`queryClient.ts:12`). StaleTime does not itself schedule a refresh.
- POS, return, dispense and expense mutations invalidate operational/dashboard/financial keys but the inspected callbacks omit `['reports']` (`PosPage.tsx:454`, `InvoicesPage.tsx:470`, `HmsRequestQueuePage.tsx:562`, `ExpensesPage.tsx:113`). Revisiting a recently cached report can temporarily show pre-mutation figures; an already-open report needs explicit refresh/event invalidation. No additional polling is recommended as a default fix.
- Logout clears query cache (`context/AuthContext.tsx:60`), which is a positive boundary; server authorization still needs fixing.
- Financial loader fetches related lines, payments and events with no row bound; wrappers additionally load vendor history through period end. `financialReport` repeatedly filters all refunds for every invoice (`:337`), creating work proportional to invoice count times refund count.
- Seven operational reports cap displayed rows at 2,000 and compute separate counts/aggregates. There is no report pagination control to traverse omitted records in the table.
- No DB timing, process counts, heap measurements or Namecheap performance improvements are claimed in this audit. Query reduction must preserve historical completeness; the historical candidate bug shows why date pruning needs regression tests.

## 9. Verification actually performed

Executed a Node in-memory harness that transpiled and loaded the actual financialRecognition and operatingProfit TypeScript modules, using existing local TypeScript/Prisma Decimal dependencies. The Prisma client import was stubbed; all database methods were synthetic arrays or query captures. No application server was started and no database/network calls were made.

| Check | Result |
|---|---|
| Invoice 1,000, payment 500: recognized revenue 0 | PASS |
| Second payment 200, cumulative 700: recognized revenue 0 | PASS |
| Final payment 300: revenue 1,000 / COGS 600 | PASS |
| Different cashier filter zeros collection but retains company invoice revenue | Gap reproduced |
| Missing cost: canonical operatingProfit null | PASS completeness safeguard |
| Same missing-cost invoice: Operating Profit returns 1,000 | Defect reproduced |
| Historical query uses current PAID status and in-period candidate events | Query-risk condition confirmed |

Seven assertions passed. “Passed” for a defect check means the undesirable behavior was reproduced, **not that the report is approved**.

Previously recorded local financial tests in the background optimization work: Income & Expense 32 checks and Revenue Recognition 29 checks passed at that earlier checkpoint. They were not rerun for this audit and do not cover all gaps above. No full browser/HTTP role matrix, concurrent settlement test, export download comparison, full financial suite, typecheck or build was run in this analysis-only step. No runtime source was changed, so there is no new implementation build to certify.

## 10. Recommended verification/fix order for the next Pharmacy step

1. **Authorization first:** management type allowlist; own/assigned invoice, request and settlement scope; genuine Sales shift report. Test direct URLs, HTTP requests, detail IDs and exports for two separate Sales users.
2. **Reporting contracts:** match every displayed/exported column to API fields; expose document references, actors, approval timestamps and line/batch detail within existing report names. Add contract checks that fail when a column is missing.
3. **Financial integrity:** retain unavailable profit for missing history, correct historical candidate selection, exclude drafts from posted inward, reconcile return-credit versus cash-refund totals.
4. **Agree pending rules:** expense eligibility/reversals, stock losses and unsafe returns, partial cash acceptance/receiver custody, explicit queue assignment, clearance by approved credit, and non-batch historical cost.
5. **Complete exports and dates:** same filtered dataset/totals; explicit truncation/error handling; consistent Pakistan event timestamps; numeric spreadsheet money cells; inspect wide PDF/print layouts.
6. **Acceptance fixtures:** 500/200/300 installments, tax/discount, multi-lot cost, later master cost change, cross-month final payment, recognized/unrecognized returns, draft/post/return purchases, advances, pending/rejected/partial settlement, parallel review, expired/quarantine stock and cashier isolation.
7. **Reconcile end to end:** source document -> operational ledger -> report -> export for each of the 15 views. Record expected/actual totals and evidence, then run relevant typechecks/builds/regression tests after any fixes.
8. **Only after Pharmacy review:** start the separate HMS reporting implementation audit. Do not infer HMS correctness from Pharmacy results.

## Deliverable and stop point

This file is the only newly authored artifact for this Pharmacy audit. Existing context documents and all application changes are preserved. Findings are documented for review; none has been silently fixed. Reporting should not yet be described as fully verified or ready for unconditional production sign-off.
