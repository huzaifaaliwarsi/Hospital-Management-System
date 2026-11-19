# Pharmacy Final Reporting - complete specification context

## 1. Source, purpose and verification status

- Source: [Pharmacy Final Reporting.pdf](<Pharmacy Final Reporting.pdf>), all **4 pages**, dated **18 November 2026**, prepared for iSysware / CH Sharif and Saeed Hospital.
- Context prepared: 19 November 2026. All pages were text-extracted and visually inspected, including the installment table spanning pages 3-4.
- Purpose: preserve all reporting requirements for subsequent code, database, API, UI and export verification.
- **Specification context only: current application compliance is NOT VERIFIED in this task.** No previous successful test substitutes for checking each PDF requirement.
- Companion: [HMS context](HMS_FINAL_REPORTING_CONTEXT.md). Shared work order: [verification plan](HMS_PHARMACY_REPORTING_VERIFICATION_PLAN.md).
- Normalize the PDF's `P&L;` rendering to `P&L`; no accounting rule changes are implied.

`M01-M10` are context IDs for source management entries 01-10. `S1-S5` follow source section B. Page references are physical PDF pages.

## 2. Required scope and navigation

**Keep the existing ten management report names; do not introduce unnecessary new menus.** The PDF asks to verify/fix recognition, COGS, vendor non-expense treatment, FEFO/FIFO, installments, returns/refunds, cashier access and reconciliation, not redesign navigation [p1].

| ID | Exact report name | Source action | Detail page |
| --- | --- | --- | --- |
| M01 | Income & Expense | VERIFY | 2 |
| M02 | Operating Profit | VERIFY / FIX | 2 |
| M03 | Detailed Income | VERIFY | 2 |
| M04 | HMS Request / Dispense | VERIFY | 2 |
| M05 | Purchase Inward | VERIFY | 2 |
| M06 | Stock Movement Audit | VERIFY | 2 |
| M07 | Vendor Payables Ledger | VERIFY | 2 |
| M08 | Detailed Expense | VERIFY | 2 |
| M09 | Sales & Purchase Returns | VERIFY | 3 |
| M10 | Balance & Drawer Settlement | VERIFY | 3 |

Sales/Cashier adds five scoped views: My Sales Invoices, Prescriptions Queue / HMS Dispensing, My Balance Sheet, My Settlement and My Shift Reports. Total detailed coverage is **15 report/view entries**, not an instruction to add 15 new screens.

## 3. Ownership and role boundaries

- Pharmacy owns medicine invoices, dispensing, batches/stock, sale payments and medicine clearance [p1].
- HMS reads request/fulfillment/clearance summaries; hospital collections remain with Front Desk [p1].
- Pharmacy management applies to Super Admin and Admin / Manager [p2]. Verify how these labels map to actual roles; do not create a role solely from wording.
- Sales/Cashier sees **own or explicitly assigned** transactions only [p3], not all users' financial reports.
- Sales cannot access management-wide vendor, P&L or settlement APIs [p4]. This still permits the separately scoped My Settlement workflow.
- HMS Front Desk hospital receipts must not auto-enter Pharmacy physical drawer [p3]. The phrase 'HMS pharmacy cash' only counts cash actually held by that Pharmacy cashier, not mirrored invoice totals or hospital receipts.
- Actual inter-entity collection routing needs a documented trace. Ownership of a receivable is not proof of physical possession of cash.

## 4. Core accounting model

The required Pharmacy P&L is **operational full-clearance reporting**, not statutory accrual accounting [p2-4]. It must remain distinct from HMS earned-service revenue.

| Measure | Required meaning |
| --- | --- |
| Operational net billing | Gross - discounts - sales credits, with tax shown separately. A billed invoice is not automatically recognized profit revenue. |
| Collections | Valid receipts - actual refunds. Installments are collection events, not new sales invoices. |
| Customer amount due | Collectible net invoice - cumulative valid applied payments at cutoff; present tax explicitly so revenue and amount due are not confused. |
| Recognized revenue | Eligible tax-exclusive invoice revenue recognized once when qualifying verified full clearance occurs. |
| Matched COGS | Historical acquisition cost of the actual batches sold/dispensed, matched to the recognized revenue. |
| Physical stock out | Occurs at actual dispensing/sale, regardless of when a later installment clears the invoice. |
| Operating expense | Valid period Opex less credits/reversals; supplier principal payments and stock purchases excluded. |
| Stock loss | A deduction in the Operating Profit specification; classification must avoid counting the same loss in Opex/COGS twice. |
| Vendor payment | Changes cash/bank and vendor liability; not a new operating expense. |
| Cash settlement | Changes custody only when accepted; neither new income nor new expense. |

The PDF refers to the existing financial engine, but this context does not certify that implementation. Qualifying clearance after a credit/write-off, partial refund, reopened balance or later installment is a decision point where the PDF gives incomplete detail.

## 5. Management reports - complete catalog

### M01 - Income & Expense [p2]

- **Content:** gross/net POS and HMS billings, collected cash/bank, outstanding, recognized revenue, COGS, expenses and margins.
- **Formula:** net billing = gross - discounts - sales credits, tax separate; collections = valid receipts - refunds; profit = recognized revenue - matched COGS - Opex.
- **Example:** A fully paid 6,000; B billed 3,500 and paid 1,500. Billed **9,500**, collected **7,500**, outstanding **2,000**, recognized revenue **6,000**.
- **Control:** every receipt must not be treated as new sales. Reconcile this report with M02 using the same recognition engine, including stock-loss classification.

### M02 - Operating Profit [p2]

- **Content:** recognized POS/HMS invoice revenue, matched batch COGS, gross profit, operating expenses, margin and drilldown.
- **Formula:** eligible fully cleared tax-exclusive revenue - historical matched batch COGS - valid operating expenses - stock losses.
- **Example:** net fully cleared 1,000 - batch COGS 600 - Opex 150 = **250 operating profit**.
- **Control:** vendor payments never reduce P&L. Operational clearance policy differs from accrual statements. A margin denominator is not specified.

### M03 - Detailed Income [p2]

- **Content:** POS/HMS invoice lines, installment history, receipt/collector, due, recognition date and original source.
- **Formula:** due(t) = net invoice - cumulative valid applied payments(t); recognize once at qualifying full clearance.
- **Example:** bill 1,000; pay 500, then 200, then 300; dues **500 / 300 / 0**; recognize **1,000 once** at clearance.
- **Control:** tax liability is separate from revenue; sales lines preserve historical batch cost.

### M04 - HMS Request / Dispense [p2]

- **Content:** admission/request IDs, medicine, requested/approved/dispensed quantity, batch, approval, invoice, due and clearance.
- **Formula:** fulfillment = dispensed / requested x 100; billed quantity = actual posted dispensed quantity only.
- **Example:** 10 requested, 6 dispensed = **60%**; 6 x 80 = **480 invoice**; paid 200 leaves **280 due**.
- **Control:** requesting/approving medication alone is not stock out or billing. Pending or rejected units must not be invoiced.

### M05 - Purchase Inward [p2]

- **Content:** supplier invoice, medicine, batch, receipt date, expiry, quantity, landed unit cost, paid/credit and entered-by actor.
- **Formula:** sum(received quantity x historical actual unit cost) - returns; supplier credit remains a separate payable.
- **Example:** A 10 x 50 = 500; B 10 x 60 = 600; acquired cost **1,100**.
- **Control:** receipt costs do not become expenses merely because stock was purchased or supplier paid. Avoid subtracting returns twice if received quantities are already net.

### M06 - Stock Movement Audit [p2]

- **Content:** batch/expiry ledger covering purchase in, POS/HMS out, returns, adjustments, quarantine, write-offs and actor.
- **Formula:** closing qty = opening + posted in - posted out +/- adjustments; out cost = issued lot quantity x its historical unit cost.
- **Example:** 20 + 50 - 12 - 6 + 3 = **55 units**.
- **Control:** no direct stock edits; only valid saleable returned medicine rejoins available stock. Quarantined stock and physical stock on hand must not be conflated with saleable quantity.

### M07 - Vendor Payables Ledger [p2]

- **Content:** supplier opening, invoice credit, payments, purchase-return credits, advance and running payable.
- **Formula:** closing payable = opening + credit purchases - payments - purchase-return credits +/- adjustments.
- **Example:** 1,000 + 6,000 - 2,500 - 500 = **4,000 payable**.
- **Control:** vendor payments affect cash/bank/liability, not operating expense. Keep advance balances visible and do not deduct a purchase payment twice through an already-net credit amount.

### M08 - Detailed Expense [p2]

- **Content:** category, voucher, payee, amount, account, date, approval, attached source and actual actor.
- **Formula:** valid period operating expenses - expense credits/reversals; stock purchases and vendor principal excluded.
- **Example:** rent 2,500 + electricity 1,000 = **3,500 period expense**, even if a vendor payment of 5,000 also occurred.
- **Control:** reconcile expense source and period with M01/M02; distinguish actual payment from recognized cost when the application supports unpaid expenses.

### M09 - Sales & Purchase Returns [p3]

- **Content:** original invoice/purchase link, quantity, customer refund/credit, supplier credit, lot status and reversals.
- **Formula:** sales due = revised invoice net - net applied payments; supplier payable is reduced by applied purchase-return credit.
- **Example:** sale 1,000 fully paid; approve credit 200 and refund 200; revised net **800**, net paid **800**, due **0**.
- **Control:** returned medicine is quarantined unless safe for resale. Reverse matched revenue/COGS only if previously recognized. Do not apply a return/refund reversal twice; do not restore unsafe stock to saleable quantity.

### M10 - Balance & Drawer Settlement [p3]

- **Content:** cashier shift opening, POS/HMS cash receipts, refunds, cash expenses, expected/count, accepted/partial/rejected settlements.
- **Formula:** pre = opening + physical cash in - physical cash out; remaining = pre - accepted outgoing + accepted incoming.
- **Example:** 500 + POS cash 3,000 + HMS Pharmacy cash 1,000 - refund 200 = **4,300**; accepted handover 3,000 leaves **1,300**.
- **Control:** count only cash actually held by the cashier. HMS hospital receipts do not automatically become Pharmacy drawer cash. Submitted/rejected amounts are not accepted transfers.

## 6. Sales / Cashier - all five views [p3]

| ID | Required content | Formula and source example | Access/control |
| --- | --- | --- | --- |
| S1 - My Sales Invoices | Own POS sale invoices, refunds, statuses, collections, searchable history | Sum authorized own sale nets; due = invoice net - valid applied receipts. Own invoices 1,000 + 500 = 1,500; payments 1,200; due 300. | Do not interpret 'own' as all invoices merely touched by the cashier; verify sold-by versus collected-by rules. |
| S2 - Prescriptions Queue / HMS Dispensing | Assigned requests, status, medicine/batch, requested/dispensed, approval and responsible user | Unfulfilled = requested - valid dispensed - rejected/cancelled. 8 - 5 = 3 remaining. | Bill only 5 dispensed; assignment visibility must be enforced server-side. |
| S3 - My Balance Sheet | Current cashier opening float, own cash POS/HMS receipts, refunds, expected/physical count | Opening + own cash POS + own cash HMS - own cash refunds - accepted outgoing. 500 + 900 + 600 - 100 = 1,900 pre-settlement. | Physical own custody only; no company-wide totals. |
| S4 - My Settlement | Own submissions, reviewer, accepted/rejected/partial transfer, remaining balance | Pre-settlement expected - accepted outgoing. Expected 1,900; submitted 1,500; accepted 1,300; carry 600. | Accepted amount, not requested amount, moves cash. |
| S5 - My Shift Reports | Own shift billed POS, actual cash/online receipts, refunds, due, settlement, variance | Cash + online - refunds; physical collection = cash - cash refunds. 3,500 + 800 - 200 = 4,100 total; physical 3,300. | No all-users management P&L or vendor payable exposure. |

## 7. FEFO/FIFO and historical cost [p3]

Use FEFO for tracked expiring medicine lots: earliest valid expiry first. Use FIFO by receipt time to break equal-expiry ties or for non-expiring inventory. Expired/quarantined lots cannot dispense. Every issue uses the actual batch's historical acquisition cost; do not recalculate posted COGS from a newly edited master purchase rate.

Source example: A received first, expires June 2028, 10 units at 40; B arrived later, expires December 2027, 8 units at 50. Dispensing 5 chooses **B**, out cost **250**. For a multi-lot issue the derived verification formula is `sum(each allocated quantity x that lot's historical unit cost)`.

## 8. Full installment and recognition timeline [p3-4]

PDF fixture: invoice net 1,000; batch cost 600; tax zero. Operational recognition is deferred until verified qualifying full clearance.

| Event | Event payment | Cumulative paid | Outstanding | Cumulative operational recognized revenue |
| --- | ---: | ---: | ---: | ---: |
| Invoice posted | 0 | 0 | 1,000 | 0 |
| First payment | 500 | 500 | 500 | 0 |
| Second payment | 200 | 700 | 300 | 0 |
| Final payment | 300 | 1,000 | 0 | 1,000 once |

On clearance, recognized revenue 1,000 - matched batch COGS 600 = **400 gross profit**; less Opex 150 = **250 operating profit**.

The table's recognized revenue is cumulative state, not revenue to re-add on every report fetch or callback. At each event, the corresponding period should reflect only its valid event effect. The chosen final-payment fixture is unambiguous; later reopening/re-clearance must be specified separately.

Physical stock out and the receivable occur at dispensing. They do not wait for profit recognition. Maintain a reconciliation between earned/dispensed sales, AR and costs awaiting operational recognition. Label this as the project's **Operational P&L**, not a statutory accrual income statement [p4].

## 9. Required reconciliations, attribution and exports [p4]

The five required equalities are:

1. Invoice due = net invoice - valid applied payments.
2. Lot closing = opening + in - out, with approved adjustments represented consistently in movements.
3. Vendor payable = opening + credit purchases - payments - return credits +/- approved adjustments.
4. Pre/post-settlement custody equals posted physical cash movements and accepted transfers.
5. Management Income & Expense and Operating Profit use the same recognition engine.

Required actor fields are actual **Sold By, Dispensed By, Collected By, Paid By, Approved By, Submitted By and Reviewed By**, with timestamps, shift, source module and original transaction ID. A collector must not be relabeled as the seller, and the report viewer must not replace the actual actor.

Refund/return reconciliation must cover original invoice, customer receipt/refund, historical COGS and return stock status without duplicated reversals. An accepted settlement changes custody only; rejected settlement transfers **zero**. Source/date filters and Excel/PDF/Print totals must agree.

## 10. Date semantics and unresolved policy decisions

Explicit source requirements distinguish receipt history, recognition date, receipt/stock dates, actual actors and matching date filters. The Pharmacy PDF does **not** independently provide the detailed timezone/cutoff table found in the HMS PDF. Use the HMS Pakistan-time requirement as a proposed shared alignment to verify, not as an unquoted Pharmacy-specific statement.

Analysis flags for the next phase:

1. Define qualifying full clearance: actual payments, approved credit, write-off, discounts, returns, advance applications and thresholds/rounding are not interchangeable.
2. Define treatment when a recognized invoice is reopened by refund, re-cleared later, or receives a backdated correction. Preserve source events; do not invent recognition dates.
3. Confirm tax-inclusive collectible total versus the tax-exclusive 'net billing' label. Mixed labels can make due and revenue differ legitimately.
4. Align M01's profit formula with M02's explicit stock-loss deduction; one loss must not be subtracted twice or omitted.
5. Define unsafe-return cost treatment: revenue reversal, COGS reversal, physical quarantine and inventory loss may be different events.
6. Confirm actual HMS-linked collection routes and whether the Pharmacy cashier physically received the cash. A mirrored Front Desk receipt is not a second drawer receipt.
7. Define 'own' and 'assigned': sold-by, collected-by, dispensed-by and shift attribution differ when staff change or installments arrive later.
8. Define FIFO ties for identical timestamps, expiry boundary, quarantine approval and returned-lot linkage. The PDF does not prescribe a database tie-breaker.
9. Define business-day boundaries, historical as-of views, recognition-period and refund-period corrections; the HMS local-time requirement suggests alignment but does not decide every boundary.
10. Define zero/negative revenue margin display, permitted overpayment/advance presentation and negative vendor balances.
11. Map Admin / Manager to actual application roles; ensure own settlement APIs remain available while management settlement APIs remain restricted.
12. Define partial settlement review, accepted incoming amounts, variance resolution and immutable reviewer audit, including duplicate acceptance retries.

These are not authorizations to silently replace financial rules. Record the observed implementation and obtain a decision for genuine policy gaps before implementing a different interpretation.

## 11. Verification handoff

For each M/S entry, capture navigation/API mappings, authorization, row ownership, source tables/IDs, formulas, time basis, actors, filters and export implementation. Run every PDF example plus negative/duplicate/date-boundary cases. Reconcile invoice, payment, stock, payable, recognition and custody ledgers independently, then compare with screen and exports.

All 15 entries and shared controls remain NOT VERIFIED under this PDF. Previous sync/financial tests are useful supporting evidence only after their coverage is mapped. The current task created documentation only and preserved application code.
