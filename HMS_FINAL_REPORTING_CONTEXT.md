# HMS Final Reporting - complete specification context

## 1. Source, purpose and verification status

- Source: [HMS Final Reporting.pdf](<HMS Final Reporting.pdf>), all **6 pages**, dated **18 November 2026**, prepared for iSysware / CH Sharif and Saeed Hospital.
- Context prepared: 19 November 2026. All pages were text-extracted and visually inspected, including report cards, examples and shared controls.
- Purpose: preserve the PDF's reporting requirements as a durable reference for the next code, database, API and UI verification phase.
- **This is a specification analysis, not a software compliance result.** Every implementation requirement remains NOT VERIFIED against this PDF until evidence is recorded.
- Companion: [Pharmacy context](PHARMACY_FINAL_REPORTING_CONTEXT.md). Shared work order: [verification plan](HMS_PHARMACY_REPORTING_VERIFICATION_PLAN.md).
- The PDF's literal `P&L;` typography is normalized to `P&L` in this context without changing meaning.

Source references below are physical PDF page numbers. `M01-M10` are context IDs for the PDF's management entries 01-10; F/A/I identifiers follow the source.

## 2. Required change scope and report count

The page-1 action list requires three management report renames, one addition and review of everything else:

| ID | Required management report name | PDF action | Detailed page |
| --- | --- | --- | --- |
| M01 | Income & Expense | RENAME | 2 |
| M02 | Detailed Income | RENAME | 2 |
| M03 | Detailed Expense | RENAME | 2 |
| M04 | Operating Profit (P&L) | ADD | 2 |
| M05 | Outstanding / Panel | REVIEW | 2 |
| M06 | Admission & Bed Summary | REVIEW | 2 |
| M07 | Balance Sheet & Settlements | REVIEW | 2 |
| M08 | Staff / Payroll / Commission | REVIEW | 3 |
| M09 | Pharmacy Inpatient Medicines | REVIEW | 3 |
| M10 | Inventory / Pharmacy Summary | REVIEW | 3 |

The PDF does not identify the old labels for the three renames. Map existing routes/components before changing names. An ADD directive in a specification is not proof that the current application lacks the report.

Detailed scope is **36 report/view entries**: 10 management + 9 Front Desk + 7 Admission + 10 Inventory. Page 1 groups some cash-control views into one index row; the detailed F8/F9 and I8/I9/I10 definitions must not be lost. Inventory section D describes eight report categories plus two individual cash-control views. These counts do not independently mandate 36 separate navigation items.

## 3. Ownership, permissions and accounting boundaries

PDF pages 1-6 establish the following:

| Area | Required ownership/access |
| --- | --- |
| Management | Super Admin and Admin have identical normal functional access to the management reports. Do not infer unrestricted security-administration parity. |
| Hospital collection | Front Desk collects hospital payments. Admission can read payment/clearance state but must not collect hospital money. |
| Hospital finance | Hospital services, hospital invoices and hospital collections belong to HMS Billing. |
| Medicine finance/stock | Medicine invoices, stock, payments and clearance belong to Pharmacy. HMS mirrors linked source references and status, not a second bill or medicine ledger. |
| General inventory | Non-medicine stock remains separate from Pharmacy medicine stock and its valuation. |
| Individual cash views | My Balance Sheet and My Account Settlement must be scoped to the actual user. |
| Sales access investigation | Sales users must not open management settlement APIs; test the API, not only hidden menus. |

The ownership rule is not permission to rewrite the existing HMS-linked medicine collection workflow without tracing it. Where Front Desk receives money on Pharmacy's behalf, distinguish hospital revenue, Pharmacy receivable, physical custody and inter-entity liability before proposing any change. The PDF does not fully specify that routing; see shared decision points.

## 4. Common financial definitions

| Measure | Required meaning |
| --- | --- |
| Net earned hospital revenue | Gross earned services minus discounts and service credits; exclude tax. Recognize by provided service, not receipt date. |
| Invoice net / collectible bill | Quantity x historical rate minus discounts plus tax minus applicable credits. Keep it distinct from tax-exclusive revenue. |
| Applied net payments | Valid allocations to an invoice, adjusted for applicable reversals/refunds; not every cash movement. |
| Outstanding / AR | Receivable remaining at the requested cutoff after valid allocations, credits/write-offs and approved adjustments. |
| Collections | Posted/confirmed receipts less actual receipt refunds, attributed to actual receipt dates. They are not additional earned revenue. |
| Advances | Liabilities until applied/earned. Receipt of an advance is not a second service sale. |
| Operating costs | Recognized direct service/consumption cost, payroll, doctor commission and other valid period operating costs without duplicate imports. |
| Non-expense movements | Unused stock purchases, supplier principal payments and internal settlements do not automatically become operating expenses. |
| Cash custody | Money actually held by a cashier/user; online/card totals are separate from physical cash. This 'Balance Sheet' is not a formal Statement of Financial Position. |

Cost-category caution: M03 presents a broad expense total including payroll, doctor costs and consumptions, while M04 lists those categories separately. The implementation must subtract each cost once, not subtract a broad inclusive expense total plus its components again.

## 5. Management reports - complete catalog

### M01 - Income & Expense [p2]

- **Content:** gross/net hospital billing, collections, outstanding, expense categories, department split and period charts.
- **Formula:** net earned = gross earned services - discounts - service credits, tax excluded. Operating profit = net earned - direct costs - payroll/commissions - other Opex.
- **PDF example:** earned 25,000 - discount 2,000 = 23,000; costs 11,000; profit **12,000**.
- **Control:** do not add collections to revenue; advances are not income before being applied/earned.

### M02 - Detailed Income [p2]

- **Content:** invoice/service lines, visit type, patient, doctor, department, receipt allocations, advance and credit histories.
- **Formula:** net bill = quantity x rate - discounts + tax - credits; due = net bill - valid applied net payments.
- **Example:** 1,000 - 100 = 900; receipts 500 + 200 = 700; due **200**.
- **Control:** show earned billing separately from collected receipts. Posted rate snapshots remain historical.

### M03 - Detailed Expense [p2]

- **Content:** voucher, expense/category, department, payee, approval, paid/unpaid balance, payment method and actual user.
- **Formula:** recognized Opex = approved period costs + payroll + doctor cost + consumptions - reversals; duplicated imports excluded.
- **Example:** electricity 3,000 + maintenance 2,000 = **5,000 expense**; paying 3,000 leaves **2,000 payable**.
- **Control:** expense recognition and payment are separate events; unused stock purchase, supplier payment and settlement are not new expenses.

### M04 - Operating Profit (P&L) [p2]

- **Content:** service/department revenue, direct consumable costs, payroll, doctor commission, overheads and profit margin.
- **Formula:** net earned hospital revenue - direct service cost - staff payroll cost - doctor commission cost - other operating costs.
- **Example:** 100,000 - 15,000 - 30,000 - 10,000 - 20,000 = **25,000**.
- **Control:** tax collected for government, purchase principal, cash transfer and advance are not hospital income. Margin denominator is not specified in the PDF.

### M05 - Outstanding / Panel [p2]

- **Content:** patient AR, panel-claim AR, advances, invoice aging buckets `0 / 1-30 / 31-60 / 61-90 / 90+`, receipts and follow-ups.
- **Formula:** closing AR = opening AR + new net receivables - applied receipts - credits/write-offs +/- approved adjustments.
- **Example:** patient 900 - 500 = 400; panel 3,000 - 1,000 = 2,000; combined **2,400**.
- **Control:** panel approval is not cash receipt. Keep patient and panel shares separate. Aging boundary definitions need confirmation because `61-90` and `90+` can overlap at day 90.

### M06 - Admission & Bed Summary [p2]

- **Content:** active/planned/discharged admissions, ward/bed statuses, transfers, occupancy, length of stay and running charges.
- **Formula:** occupancy = active occupied beds / eligible beds x 100. Average LOS = completed stay days / discharges.
- **Example:** 6 / 7 = **85.71%**, or 86% rounded; 9 days / 3 discharges = **3 days**.
- **Control:** occupancy and census must agree using the same eligibility rules; explicitly blocked/reserved beds are excluded as specified.

### M07 - Balance Sheet & Settlements [p2]

- **Content:** cashier/Inventory-user cash custody, cash/digital account movements and submitted/accepted/returned/rejected settlements.
- **Formula:** pre-settlement = opening + physical cash in - physical cash out; post-settlement = pre-settlement - accepted out + accepted in.
- **Example:** 1,000 + 4,000 - 200 = 4,800; accepted handover 3,000 leaves **1,800**.
- **Control:** custody reporting, not statutory balance sheet; online/card is not drawer cash. Count accepted transfers once.

### M08 - Staff / Payroll / Commission [p3]

- **Content:** attendance and approved corrections, generated/payable/paid salary, eligible doctor service collections and commission payouts.
- **Formula:** salary net = basic + allowances - deductions - recovery. Doctor earned commission = sum(eligible net collected service allocation x rate).
- **Example:** 20,000 + 1,000 - 500 = 20,500; paid 12,000 leaves **8,500**. Eligible 500 x 20% = **100 commission**.
- **Control:** payroll and doctor commission retain independent approvals, payables and settlement streams.

### M09 - Pharmacy Inpatient Medicines [p3]

- **Content:** admission/request IDs, requested/dispensed quantities, high-value approval, Pharmacy invoice, paid/due/clearance and user.
- **Formula:** dispense percentage = actual dispensed / requested x 100; Pharmacy due = Pharmacy net invoice - Pharmacy applied payments.
- **Example:** 6 / 10 = **60%**; Pharmacy bill 600 - paid 300 = **300 due**.
- **Control:** read-only Pharmacy-source mirror; neither hospital income nor HMS-owned medicine stock.

### M10 - Inventory / Pharmacy Summary [p3]

- **Content:** separately identified general-stock and medicine-stock values, low stock, expiry, purchases, issues and supplier payable.
- **Formula:** closing general stock cost = opening + stock in - valid consumed/out cost +/- adjustments; Pharmacy cost separately sourced.
- **Example:** 10,000 + 5,000 - 2,000 = **13,000 general stock**, with medicine stock shown separately.
- **Control:** lot-source historical costs and FIFO/FEFO; no cross-system double counting. Internal transfer versus consumption follows I1, not an unconditional expense rule.

## 6. Front Desk / Billing - all nine views

| ID / source | Report and required content | Formula and source example | Specific control |
| --- | --- | --- | --- |
| F1 / p3 | **Daily Billing Summary:** OPD, OBSV, ER, ADM+ and custom; billed, collection, refunds, net dues by shift/cashier | Net billed = gross - discount + tax - credits; net collections = posted receipts - actual refunds. 4,500 - 500 = 4,000; 3,000 collected leaves 1,000 cohort due. | Billing cohort and receipt-period collections must not be mixed when deriving dues. |
| F2 / p3 | **Encounter Register:** booking/visit number, temporary self-pay or panel identity, doctor, department, status, staff | Count completed valid encounters; 5 OPD + 3 ER = 8. | Status counts must not duplicate records. |
| F3 / p3 | **Invoice Register:** invoice/date, gross, discount, tax, net, paid, partial/outstanding, status, creator | Due = net invoice - applied net receipts; 1,000 - 700 = 300. | Preserve original invoice identity and historical values. |
| F4 / p3 | **Collection & Receipt Report:** receipt, method/account, collection date, allocation, cashier, shift, refund audit | Confirmed cash + confirmed online/card - actual receipt refunds. 1,000 + 500 - 100 = 1,400 total; physical net inflow 900. | Distinguish physical cash from combined collection. |
| F5 / p3 | **Outstanding / Partial Invoices:** patient/invoice, chronological installments, last payment, due, aging | Remaining(t) = net invoice - valid allocated payments through t. Bill 1,000; pay 500/200/300; dues 500/300/0. | Historical cutoffs cannot include future installments. |
| F6 / p4 | **Admission Payment Collections:** admission number, payment request, partial/final hospital receipt, amount, collector, clearance | Running valid hospital bill - applied hospital payments. 5,000 - 1,500 - 2,000 = 1,500. | Hospital receipt/clearance remains distinct from Pharmacy. |
| F7 / p4 | **Discounts / Refunds / Voids:** original invoice/receipt, authorized reason, credit/void, refund, approval, posted reversal | Revised bill = original net - valid credits; due = revised net - net applied receipts. 1,000 - 200 - 600 = 200. | Never silently delete posted history; a credit and a cash refund are distinct effects. |
| F8 / p4 | **My Balance Sheet:** own opening/carry, hospital cash receipts/refunds/outflows, expected/count variance | Opening + physical cash in - physical cash out - accepted handover. 500 + 1,000 - 200 = 1,300 before settlement. | User-specific custody, same cutoff for count and expectation. |
| F9 / p4 | **My Account Settlement:** own submitted, accepted, partial, rejected, transfer/review, remaining custody | Pre-settlement expected - accepted outgoing. Expected 1,300; submitted 1,000; accepted 800; remaining 500. | Submission alone transfers nothing; independently accepted amount controls custody. |

## 7. Admission - all seven reports

Admission is a reader of hospital payment state, not a hospital cash collector [p4-5].

| ID / source | Report and required content | Formula and source example | Specific control |
| --- | --- | --- | --- |
| A1 / p4 | **Admission Summary:** new/active/planned/discharged, linked ward/department, clearance attention | Closing active = opening active + new activated - final discharges. 4 + 3 - 1 = 6. | Creating a planned admission is not necessarily activation. |
| A2 / p4 | **Admission Register:** ID, referral, patient display, doctor, ward/room/bed, status, actor, discharge date | Unique admissions = active + discharged + other mutually exclusive statuses. 5 + 7 = 12. | Transfers must not create duplicate admission counts. |
| A3 / p4 | **Inpatient Census / Bed Report:** as-of active cases, occupied/available/blocked/reserved beds, ward breakdown | Occupied = active bed allocations at cutoff; occupied / eligible x 100. 6 of 7 means 1 available and 85.71%. | Same timestamp, status and denominator as management occupancy. |
| A4 / p4 | **Transfer / Length of Stay:** from/to bed and start/end, actor, transfer count, completed stays | Sum discharged stay duration / discharges. Stays 2, 4, 3 average 3 days. | Do not count each transfer as a new stay/discharge. |
| A5 / p5 | **Running Hospital Bill / Payment:** room/service charges, approved discounts, Front Desk installments, due | Net valid hospital charges - applied Front Desk hospital receipts. 2 x 1,000 + 1,500 - 1,000 - 500 = 2,000. | Admission must not collect hospital cash. |
| A6 / p5 | **Pharmacy Request & Fulfillment:** requested/fulfilled/rejected quantities, status, high-value approval, invoice, clearance | Open = requested - dispensed - cancelled/rejected. 10 - 6 - 2 = 2 pending. | Invoice only the 6 dispensed; due comes from Pharmacy. |
| A7 / p5 | **Discharge Clearance Report:** clinical ready, hospital outstanding/credit override, separate Pharmacy clearance, discharge actor | Clinical ready AND hospital cleared/authorized AND Pharmacy cleared/authorized. Ready + both dues zero allows discharge. | Authorization/override must remain distinct from a cash receipt or automatic zero due. |

## 8. Inventory Management - all ten views

| ID / source | Report and required content | Formula and source example | Specific control |
| --- | --- | --- | --- |
| I1 / p5 | **Inventory Summary:** non-medicine quantities/cost, purchases, issues/consumption, alerts | Opening + receipts + valid returns - consumption/supplier-return/write-off costs +/- adjustments. 5,000 + 3,000 - 2,000 = 6,000. | Internal department transfer is not consumption unless configured as issue-at-consumption. |
| I2 / p5 | **Stock Movement:** lot-wise posted in/out, supplier/department returns, approved adjustments, user, running quantity | Opening + in - out +/- adjustments. 50 + 30 - 20 + 5 = 65. | Keep quantities separate from movement values. |
| I3 / p5 | **Purchase / Stock In:** purchase ref, supplier, item, lot, expiry, quantity, landed cost, paid/credit, actual purchaser | Receipt cost = qty x unit cost - discount + capitalizable cost; payable = net credit purchase - applied payment. 20 x 100 = 2,000; paid 500 leaves 1,500. | Clarify whether 'net credit purchase' means original payable or residual credit to avoid deducting payment twice. |
| I4 / p5 | **Department Issue & Return:** department/item, issue-return refs, quantities, net quantity/cost | Net issue = issued - returned; value uses historical lot cost. 20 - 5 = 15; x100 = 1,500. | Multi-lot cases require each lot's own cost, not a current average/master price. |
| I5 / p5 | **Supplier Report / Ledger:** opening payable, credit purchases, cash/online payments, credits, closing | Opening + credit purchases - payments - return credits +/- adjustments. 2,000 + 5,000 - 3,000 - 500 = 3,500. | Principal settlement is not expense recognition. |
| I6 / p5 | **Expense Report:** voucher/category, account, cash handler, approval | Valid operating expenses - reversals. Transport 1,000 + utility 500 = 1,500. | Supplier principal repayment excluded. Capitalizable purchase costs must not also be expensed. |
| I7 / p6 | **Stock Status:** available, reorder, low/out, near expiry, expired/quarantined, issue eligibility | Shortage = max(reorder level - saleable qty, 0). 10 - 8 = 2. | Expired/quarantined stock is not eligible issue stock. |
| I8 / p6 | **Cash & Settlement:** user petty cash, cash purchases/expenses/supplier payments/refunds, handover | Opening + petty cash + supplier cash refunds - cash purchases - cash supplier payments - cash Opex. 1,000 + 4,000 - 2,000 - 1,000 - 500 = 1,500. | Same purchase payment must not appear in both cash-purchase and later-pay categories. |
| I9 / p6 | **My Balance Sheet:** user custody, expected/physical, variance | Variance = physical count - expected at identical pre/post cutoff. 1,480 - 1,500 = -20 shortage. | Identify whether displayed expectation is before or after settlement. |
| I10 / p6 | **My Account Settlement:** individual request, accepted amount, reviewer, carry | Available expected - accepted transfer. 1,500 - 1,000 = 500. | Only accepted movement changes carry. |

## 9. Shared controls, dates and source examples [p6]

### FIFO / FEFO

For expiry-tracked lots, choose earliest valid expiry first. Equal expiry or absent expiry uses FIFO by receipt order. Exclude expired/quarantined lots. Each issue carries its actual lot's historical cost.

Source example: lot A was received first, expires in 2028, quantity 10 at 40; lot B arrived later, expires in 2027, quantity 8 at 50. Issue 5 from **B**; cost is **250**, not 200. This is independent of whichever stock valuation or supplier payment is displayed elsewhere.

### Installments

For a valid bill of 1,000, receipts of 500, 200 and 300 on different dates leave 500, 300 and 0 outstanding. Each receipt is a separate immutable allocation. Hospital earned income follows the provided service, not the final-payment date. The Pharmacy full-clearance profit rule must not be imported into HMS revenue.

### Required cutoff axes

| Measure | PDF cutoff |
| --- | --- |
| Hospital income | Service date |
| Collections | Actual receipt date |
| Open AR | As-of timestamp |
| Stock | Posted movement |
| Cash | Custody transfer |
| Employee/doctor eligible commission | Valid eligible collection date |

All HMS reports use Pakistan local date/time and server-side totals. Proposed technical mapping for later verification is `Asia/Karachi`; the PDF states the local-time requirement rather than an API parameter. Boundary inclusivity, backdated-event behavior and rounding still need explicit implementation checks.

### Known screenshot investigations, not confirmed current defects

- Reconcile **7 beds / 6 occupied / 0 active inpatients** by tracing definitions, statuses, allocations and common cutoff.
- Trace displayed HMS outstanding **PKR 5,080** to individual invoices and allocations; do not force the total to that number without its source filters/date.
- Test that Sales cannot access management settlement APIs.
- Accepted transfers affect cash; rejected transfers do not.
- Exports must preserve filters, source IDs, actual actors and totals.

The PDFs do not include the underlying screenshot records or transaction IDs. Those amounts are investigation targets, not test fixtures proven to exist in the current database.

## 10. Interpretations and questions to resolve during verification

These are analysis flags, not new approved business rules:

1. Exact old labels/routes for M01-M03 and whether M04 already exists.
2. AR aging basis (invoice date or due date), day-0 treatment and nonoverlapping day-90 boundary.
3. Eligibility denominator for blocked/reserved beds; planned allocations; DISCHARGE_PENDING; historical versus current census; zero eligible beds.
4. LOS as calendar days or elapsed duration, same-day cases, rounding and zero discharges.
5. P&L cost-category mapping so payroll, commission, consumption and expense totals are not subtracted twice; expense approval versus incurred-date policy.
6. Department issue-at-consumption setting and handling of returns/remaining ward custody.
7. Credit authorization versus write-off versus receipt; negative invoice balance/overpayment and advance allocation rules.
8. Pharmacy money collected by an HMS user: actual collector/custody, inter-entity payable and Pharmacy receivable ownership without adding Pharmacy sales to HMS hospital revenue.
9. Posting-date versus effective-date handling of corrections/refunds/credits; snapshot behavior for historical reports.
10. 'Independently accepted' settlement review policy, partial acceptance, returned status, accepted incoming and repeat callbacks.
11. Role mapping for the Sales access investigation, as HMS and Pharmacy may use different role identifiers.
12. Persisted invoice/lot/rate/cost snapshots versus current master-data joins and all export formats.

## 11. Verification handoff

For every M/F/A/I entry, map the current menu and route, API, authorization, database source/joins, date/filter basis, formula, actor/source columns and export path. Execute the source example plus an edge case with synthetic data, then compare UI, API and direct source calculations at the same cutoff. Record evidence and status in the shared verification plan.

No implementation changes, database tests, schema updates, rename operations or fixes were performed as part of producing this context. Earlier background-sync changes must remain preserved during the later reporting work; their test results are not proof of compliance with this PDF.
