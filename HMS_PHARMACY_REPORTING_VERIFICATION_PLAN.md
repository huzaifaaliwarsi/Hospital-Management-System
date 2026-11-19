# HMS + Pharmacy reporting - verification work order

## 1. What has and has not been completed

**Completed in this documentation task:** read all 10 PDF pages, inspect their rendered layouts, extract all 51 detailed report/view definitions, preserve formulas/examples/ownership controls, and identify decisions needed for unambiguous verification.

**Not performed in this task:** implementation audit, new application tests, database writes, financial-rule changes, report renames/additions, deployment, commit or push. This work order prepares the later verification requested by the user. Existing application/background optimization changes must be preserved.

Authoritative source snapshots:

| Source | Date / pages | SHA-256 |
| --- | --- | --- |
| [HMS Final Reporting.pdf](<HMS Final Reporting.pdf>) | 18 Nov 2026 / 6 pages | `CC77B1862FC2CA58B05DAB67B7F56CD5A38C825868ED97A1A0302E7BB66C2D06` |
| [Pharmacy Final Reporting.pdf](<Pharmacy Final Reporting.pdf>) | 18 Nov 2026 / 4 pages | `10EB49DB45637D2B6C7EA9C0C88EA3EFC216B38CFA3049CD1A26A35C66BA8EBE` |

Detailed context: [HMS](HMS_FINAL_REPORTING_CONTEXT.md) and [Pharmacy](PHARMACY_FINAL_REPORTING_CONTEXT.md).

These documents record source requirements, not accounting/legal advice or a new financial policy. Page citations in the context files allow each interpretation to be checked against the original PDF. Items marked as analysis flags or proposed tests are derived verification work, not additional approved requirements.

## 2. Critical differences to retain

| Dimension | HMS specification | Pharmacy specification | Verification consequence |
| --- | --- | --- | --- |
| Revenue | Earned/provided hospital services, excluding tax | Eligible full-clearance operational revenue, excluding tax | Do not unify recognition timing merely to make totals match. |
| Installments | Separate receipt allocations; do not re-earn service income | Separate receipts; recognize qualifying invoice once on clearance | Same 500/200/300 receipt sequence has different revenue timing. |
| Stock | General non-medicine inventory | Medicine/batch stock | Separate source ownership and valuation. |
| Hospital payment collection | Front Desk only | Hospital receipts never auto-enter Pharmacy drawer | Trace actual collector, source revenue and custody independently. |
| Pharmacy request mirror | Read linked fulfillment/invoice/clearance | Own dispensing/invoice/stock/payment source | Never create a second bill or count mirror as HMS hospital revenue. |
| Supplier payment | Cash/liability movement, not new expense | Same | Match payable and cash without inflating Opex. |
| Settlement | Accepted custody transfer only | Same | Submitted/rejected transfers have no accepted-cash effect. |
| Balance sheet label | Cash custody, not formal Statement of Financial Position | Drawer/custody reporting | Display correct pre/post state; keep digital collections separate. |
| Navigation action | Rename 3 reports; add Operating Profit; review others | Keep the 10 management names | Map existing implementation first; avoid duplicate screens. |

## 3. Evidence and status standard

Initial status for all rows is **NOT VERIFIED**. Use these later statuses consistently:

- **PASS:** required scenario and relevant edge cases match independent source calculations, API authorization and UI/export output, with evidence.
- **FAIL:** observed reproducible mismatch; record expected, actual, reproduction and affected source IDs.
- **PARTIAL:** some layers or cases pass, but required coverage is incomplete.
- **BLOCKED - POLICY:** the source does not resolve a material business interpretation; record the decision needed.
- **BLOCKED - ENVIRONMENT:** required test environment, role/session, source fixture or artifact is unavailable.

Record for each test/report:

```text
Requirement ID and PDF page:
Code revision / environment / timestamp:
Role and actor scope:
Menu/component; API route; service/query:
Database sources and synthetic fixture IDs:
Date basis / timezone / as-of / filters:
Expected calculation (independent of the implementation):
Actual API rows and server totals:
Actual UI / drilldown / Excel / PDF / Print totals:
Negative permission and duplicate/retry result:
Status, evidence location and follow-up:
```

Keep patient identities, credentials and production secrets out of evidence files. A successful build alone does not prove correct reporting. A previous test remains supporting evidence only if its exact scenario covers the requirement and passes against the revision being verified.

## 4. Complete report coverage register

### HMS: 36 report/view entries

| ID | Report | PDF page | Status |
| --- | --- | --- | --- |
| H-M01 | Income & Expense | 2 | NOT VERIFIED |
| H-M02 | Detailed Income | 2 | NOT VERIFIED |
| H-M03 | Detailed Expense | 2 | NOT VERIFIED |
| H-M04 | Operating Profit (P&L) | 2 | NOT VERIFIED |
| H-M05 | Outstanding / Panel | 2 | NOT VERIFIED |
| H-M06 | Admission & Bed Summary | 2 | NOT VERIFIED |
| H-M07 | Balance Sheet & Settlements | 2 | NOT VERIFIED |
| H-M08 | Staff / Payroll / Commission | 3 | NOT VERIFIED |
| H-M09 | Pharmacy Inpatient Medicines | 3 | NOT VERIFIED |
| H-M10 | Inventory / Pharmacy Summary | 3 | NOT VERIFIED |
| H-F1 | Daily Billing Summary | 3 | NOT VERIFIED |
| H-F2 | Encounter Register | 3 | NOT VERIFIED |
| H-F3 | Invoice Register | 3 | NOT VERIFIED |
| H-F4 | Collection & Receipt Report | 3 | NOT VERIFIED |
| H-F5 | Outstanding / Partial Invoices | 3 | NOT VERIFIED |
| H-F6 | Admission Payment Collections | 4 | NOT VERIFIED |
| H-F7 | Discounts / Refunds / Voids | 4 | NOT VERIFIED |
| H-F8 | My Balance Sheet | 4 | NOT VERIFIED |
| H-F9 | My Account Settlement | 4 | NOT VERIFIED |
| H-A1 | Admission Summary | 4 | NOT VERIFIED |
| H-A2 | Admission Register | 4 | NOT VERIFIED |
| H-A3 | Inpatient Census / Bed Report | 4 | NOT VERIFIED |
| H-A4 | Transfer / Length of Stay | 4 | NOT VERIFIED |
| H-A5 | Running Hospital Bill / Payment | 5 | NOT VERIFIED |
| H-A6 | Pharmacy Request & Fulfillment | 5 | NOT VERIFIED |
| H-A7 | Discharge Clearance Report | 5 | NOT VERIFIED |
| H-I1 | Inventory Summary | 5 | NOT VERIFIED |
| H-I2 | Stock Movement | 5 | NOT VERIFIED |
| H-I3 | Purchase / Stock In | 5 | NOT VERIFIED |
| H-I4 | Department Issue & Return | 5 | NOT VERIFIED |
| H-I5 | Supplier Report / Ledger | 5 | NOT VERIFIED |
| H-I6 | Expense Report | 5 | NOT VERIFIED |
| H-I7 | Stock Status | 6 | NOT VERIFIED |
| H-I8 | Cash & Settlement | 6 | NOT VERIFIED |
| H-I9 | My Balance Sheet | 6 | NOT VERIFIED |
| H-I10 | My Account Settlement | 6 | NOT VERIFIED |

### Pharmacy: 15 report/view entries

| ID | Report | PDF page | Status |
| --- | --- | --- | --- |
| P-M01 | Income & Expense | 2 | NOT VERIFIED |
| P-M02 | Operating Profit | 2 | NOT VERIFIED |
| P-M03 | Detailed Income | 2 | NOT VERIFIED |
| P-M04 | HMS Request / Dispense | 2 | NOT VERIFIED |
| P-M05 | Purchase Inward | 2 | NOT VERIFIED |
| P-M06 | Stock Movement Audit | 2 | NOT VERIFIED |
| P-M07 | Vendor Payables Ledger | 2 | NOT VERIFIED |
| P-M08 | Detailed Expense | 2 | NOT VERIFIED |
| P-M09 | Sales & Purchase Returns | 3 | NOT VERIFIED |
| P-M10 | Balance & Drawer Settlement | 3 | NOT VERIFIED |
| P-S1 | My Sales Invoices | 3 | NOT VERIFIED |
| P-S2 | Prescriptions Queue / HMS Dispensing | 3 | NOT VERIFIED |
| P-S3 | My Balance Sheet | 3 | NOT VERIFIED |
| P-S4 | My Settlement | 3 | NOT VERIFIED |
| P-S5 | My Shift Reports | 3 | NOT VERIFIED |

Every row inherits the source's actor, filter, ownership and export requirements. Passing a shared backend formula does not automatically pass every role-specific API or screen that displays it.

## 5. Verification sequence

1. **Preserve and map.** Record Git state/revision and source hashes. Map all 51 entries to existing routes, queries and exports. Read existing project instructions. Do not discard user edits or background-sync improvements.
2. **Resolve policy gaps.** First check existing approved configuration/documentation. If still ambiguous, record the exact choice needed without silently choosing a different financial rule.
3. **Verify source arithmetic.** Use isolated synthetic fixtures, independent expected values and explicit cutoffs. Prefer rollback-only local tests; do not use production mutations or destructive reset/seed commands.
4. **Verify APIs and roles.** Test positive and negative permissions, user/assignment scope, forged ownership filters, source linking, idempotency and server-side aggregates.
5. **Verify complete local workflows.** Exercise the actual local HMS and Pharmacy applications together. A simulator proves only its side of the contract. Test request, approval/rejection, partial/full dispense, payments, callbacks, clearance and reconciliation.
6. **Verify UI and export parity.** Apply identical filters and cutoffs to dashboard cards, report rows, pagination, drilldowns and Excel/PDF/Print. Confirm server totals cover the selected dataset rather than just a visible page.
7. **Close findings individually.** Fix only confirmed problems within authorized scope; retain policy blockers separately. Re-run affected tests, then appropriate regression/build checks. Report remaining failures honestly.

This task ends after preparing the context and plan. The numbered sequence is for the next verification task, not a claim these checks have already run.

## 6. Source-derived numerical acceptance cases

All cases below begin NOT VERIFIED. Values are PKR unless units/days are stated. These cover high-risk source examples; also run the report-specific examples in both context files for every register row.

| Case | Requirement / source | Expected result |
| --- | --- | --- |
| V01 | HMS earned income, HMS p2 | 25,000 earned - 2,000 discount = 23,000; costs 11,000; profit 12,000. Collections do not add more revenue. |
| V02 | HMS detailed income, p2 | 1,000 - 100 discount = 900; paid 500 + 200; due 200. |
| V03 | HMS P&L categories, p2 | 100,000 - 15,000 consumables - 30,000 salary - 10,000 commission - 20,000 Opex = 25,000; subtract each once. |
| V04 | HMS expense payable, p2 | Electricity 3,000 + maintenance 2,000 = 5,000 cost; paid 3,000; unpaid 2,000. |
| V05 | HMS patient/panel split, p2 | Patient 900 - 500 = 400; panel 3,000 - 1,000 = 2,000; combined AR 2,400. Panel approval alone changes no cash receipt. |
| V06 | HMS occupancy / LOS, p2/4 | 6 eligible occupied / 7 eligible beds = 85.71%; 2 + 4 + 3 completed days / 3 discharges = 3. |
| V07 | HMS payroll/commission, p3 | 20,000 + 1,000 - 500 = 20,500 salary; paid 12,000; due 8,500. Eligible service collection 500 x20% = 100 commission. |
| V08 | HMS receipt-method split, p3 | Cash 1,000 + online 500 - cash refund 100 = 1,400 total net receipts, 900 physical cash. |
| V09 | HMS installments, p3/6 | Bill 1,000; receipts 500/200/300 on separate dates; dues 500/300/0. Service income remains on service date. |
| V10 | HMS running hospital bill, p5 | Room 2 x1,000 + procedure 1,500 - hospital receipts 1,000 - 500 = 2,000 due. |
| V11 | HMS pending fulfillment, p5 | Requested 10 - dispensed 6 - rejected 2 = 2 pending; bill only 6. |
| V12 | HMS stock/returns, p5 | Quantity 50 +30 -20 +5 =65; issue 20 and return 5 at100 gives net15 units/value1,500. |
| V13 | FEFO both PDFs, HMS p6 / Pharmacy p3 | Earlier-received A expires later at cost40; B expires earlier at50; issue5 from B => out cost250. |
| V14 | HMS inventory payable, p5 | 2,000 opening +5,000 credit purchases -3,000 payment -500 return credit =3,500. |
| V15 | HMS custody/variance, p6 | 1,000 opening +4,000 petty -2,000 purchase -1,000 supplier pay -500 Opex =1,500; physical1,480 => variance -20; accept1,000 => carry500. |
| V16 | Pharmacy bill/collection/recognition, p2 | A cleared6,000; B bill3,500, paid1,500 => billed9,500, collected7,500, due2,000, recognized6,000. |
| V17 | Pharmacy installments, p3-4 | Bill1,000; payments500/200/300 => revenue0/0/1,000 once; matched COGS600 => gross profit400; Opex150 => operating profit250. |
| V18 | Pharmacy partial fulfillment, p2 | 6 of10 =>60%; 6 x80 =480 invoice; payment200 =>280 due. |
| V19 | Pharmacy purchase/stock, p2 | Lots10 x50 +10 x60 =>1,100 acquisition cost. Stock20 +50 -12 POS -6 HMS +3 valid return =>55. |
| V20 | Pharmacy supplier/Opex separation, p2 | 1,000 +6,000 -2,500 -500 =4,000 vendor payable. Rent2,500 + electricity1,000 =3,500 Opex; vendor payment5,000 excluded. |
| V21 | Pharmacy sale return/refund, p3 | Paid sale1,000; credit200 and refund200 => revised bill800, net paid800, due0. Return stock safety checked separately. |
| V22 | Pharmacy drawer, p3 | Opening500 +POS cash3,000 +held HMS Pharmacy cash1,000 -refund200 =4,300; accepted3,000 =>carry1,300. |
| V23 | Partial settlement, both PDFs | HMS expected1,300/submitted1,000/accepted800 =>carry500. Pharmacy expected1,900/submitted1,500/accepted1,300 =>carry600. |
| V24 | Pharmacy shift receipts, p3 | Cash3,500 +online800 -cash refund200 =>4,100 net receipts; physical net3,300. |

## 7. Derived edge cases and reconciliation checks

These are proposed tests to validate the source controls, not claims that the PDF specifies every resulting policy:

| Case | What to exercise | Evidence required |
| --- | --- | --- |
| E01 | Duplicate receipt, dispense callback, return and settlement acceptance; simultaneous workers | Exactly-once financial/stock effect or a documented rejection; test actual independent transactions, not just one-process promise sharing. |
| E02 | Installment at month boundary; old invoice paid this month | Current collections, historical billing and operational recognition remain correctly dated. |
| E03 | Tax, discount, credits, refund and advance allocation | Tax-exclusive revenue reconciles to collectible invoice; no double subtraction or cash invention. |
| E04 | Refund before clearance, after clearance and after reporting cutoff | Correct period/event ledger and policy-approved recognition reversal; no repeated COGS reversal. |
| E05 | Reopened and later re-cleared Pharmacy invoice | Policy decision documented before expected recognition is asserted. |
| E06 | Changed medicine purchase price, service rate or commission rate after posting | Historical snapshots and earned/eligible source allocations remain explainable. |
| E07 | Equal-expiry FIFO, expired/quarantined lots, multi-lot picking, unsafe returned stock | Actual batch IDs, issue quantities, costs and saleable status are traceable. |
| E08 | Department transfer versus actual consumption | HMS inventory cost/custody and Opex follow configured issue-at-consumption policy once. |
| E09 | Planned/active/discharge-pending/transferred/discharged admissions; blocked/reserved beds | Census, bed status and eligible denominator reconcile at a common timestamp. |
| E10 | Zero revenue, zero discharges, zero eligible beds, negative profit/variance | No divide-by-zero, misleading zero replacements or unapproved rounding/clamping. |
| E11 | Cashier A sells; B collects a later installment; another user approves/refunds | Seller, collector, approver and cash holder are correctly attributed without cross-user leakage. |
| E12 | Sales attempts direct management vendor/P&L/settlement endpoints and another user's records | Authorization rejects forbidden access even if UI filters/route IDs are changed. |
| E13 | Settlement submitted/rejected/returned/partially accepted/fully accepted/incoming | Only accepted cash changes both sides of custody; repeats do not transfer again. |
| E14 | Local day boundary, as-of timestamp, future receipt, backdated correction | Same timezone/filter semantics across API, cards, rows, export and historical views. |
| E15 | Pagination/filter changes, empty results, wide exports | Server total equals all selected rows, not current page; source/date/user filters survive exports. |
| E16 | HMS-to-Pharmacy collection/clearance, failed/retried callbacks | Pharmacy source state reconciles to HMS mirror and inter-entity liability; no second bill, cash receipt or hospital revenue. |
| E17 | Advance, overpayment, supplier advance and purchase-return credit | Credit balances and allocations remain traceable; do not force negative balances into ordinary due without policy. |
| E18 | Screenshot investigations from HMS p6 | Trace 7 beds/6 occupied/0 active and PKR5,080 AR using actual source IDs/date/filters; do not fabricate matching data. |

## 8. Decision register before financial changes

| Decision | Source context | Why it matters |
| --- | --- | --- |
| D01 Qualifying Pharmacy full clearance | Pharmacy p2-4 | Zero due via payment, credit, write-off or return may not have the same recognition meaning. |
| D02 Refund/re-clearance timing | Pharmacy p3-4 | Prevent loss or duplication of revenue/COGS across periods. |
| D03 Expense/stock-loss classification | HMS p2/5; Pharmacy p2 | Avoid duplicated payroll/commission/consumption/stock-loss deductions. |
| D04 Physical collector vs Pharmacy receivable owner | Both p1; Pharmacy p3 | Existing Front Desk collection on behalf of Pharmacy must not create hospital income or fictitious Pharmacy drawer cash. |
| D05 Bed/LOS/aging definitions | HMS p2/4 | Resolve denominator, cutoff and day-90 overlap before declaring mismatches. |
| D06 Inventory consumption configuration | HMS p5 | Internal transfer is not automatically expense consumption. |
| D07 Own/assigned roles and reviewer independence | Both role sections | UI labels alone do not establish object-level API permission or reviewer policy. |
| D08 Historical date and rounding boundaries | HMS p6; Pharmacy p4 | Same inputs and cutoff must produce comparable UI/API/export totals. |

Resolve these first from existing approved rules/configuration where available. If a remaining gap changes operational behavior, present concrete options to the user during the verification phase; do not invent approval from silence.

## 9. Completion criteria for the later verification

- All 51 entries have an implementation mapping and explicit evidence-backed status.
- All source examples and relevant shared controls are covered, including positive/negative role tests and export parity.
- Both actual local applications complete the cross-system financial/clearance workflow; mocked/simulator coverage is labeled separately.
- Numerical expectations come from independent source calculations at the same cutoff.
- Existing failures, new defects, policy blockers and environment limits are listed separately; no unrun test is marked PASS.
- Necessary fixes preserve posted history, stock ownership, financial rules and the earlier background optimizations.
- No unresolved critical authorization, duplicate financial posting, unsafe stock, incorrect recognition or unexplained reconciliation defect is described as release-ready.
- User reviews the final evidence before any separately authorized production action. This work order does not authorize a deployment.
