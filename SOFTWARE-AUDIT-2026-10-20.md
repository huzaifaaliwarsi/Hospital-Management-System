# HMS software audit — 20 October 2026

Update after the audit: findings 1 and 2 have now been addressed in source. Access tokens are bound to revocable database sessions, with live account/role/reset checks. Inventory mutations share a transaction-scoped lock and repeated issue/return lines are rejected. New regression tests cover these fixes; findings 3–6 remain separate outstanding work. The counts below describe the original audit run.

Second update: findings 3 and 4 are now addressed for management reporting, department payables and newly posted provider vouchers. Company remittances use their received date and panel coverage allocation; patient receipts use patient coverage allocation. Outstanding balances subtract company realizations, including department-filtered mixed invoices. New cash provider vouchers atomically post a linked Main Fund withdrawal, check funds under the shared fund lock, and accept a stable request key to prevent retry duplicates. Non-cash vouchers do not debit physical cash. No retrospective cash deductions were made for historical vouchers. The 1,000-invoice report limit and remaining regression-suite cleanup are still outstanding. Actual disbursements were not posted as part of verification.

Third update: the two management invoice reports now return the entire selected period instead of silently stopping at 1,000 rows. Regression coverage uses 1,005 invoices, including unpaid records after 1,000 settled ones. Obsolete frontend imports and incomplete transaction/clearance fixtures were repaired; ledger assertions now cover service allocations, receipts and unused credit. The user explicitly confirmed that planned bookings occupy their selected bed: production bed behavior was preserved and tests now assert that rule. Department-free service selection is restricted to default encounter services. Pharmacy billing requires the configured active internal default pharmacy, as provisioned by the existing migration, and no longer reclassifies arbitrary departments or reactivates inactive ones during billing. Latest HMS suite: 469 passed, 0 failed, 5 skipped (database-writing integration tests disabled); backend and frontend TypeScript passed. No live business transactions or server stop/restart commands were performed.

Remaining verification: isolated database/browser acceptance, real printer and integration checks, and performance at large report volumes. Other admission, front-desk and inventory report endpoints still have separate hard row caps (500/1,000/2,000/5,000); this change addresses the two management reports from finding 5, not every report endpoint. Those additional caps need a separate pagination/export pass.

Scope: current working-tree source, existing automated tests, four TypeScript projects, and aggregate-only reads from the configured HMS database. The production/dev servers were not stopped or restarted. No business records were created, paid, modified, or deleted during this audit. This is not a browser acceptance test or a certification of every workflow.

## Original audit result

The software is not ready to be described as fully verified. The earlier LAB receipt-based reporting fix works for the case checked then, but the broader panel-payment and cash-disbursement flows still have gaps.

| Check | Result |
|---|---|
| HMS backend TypeScript | Passed |
| HMS frontend TypeScript | Passed |
| Standalone pharmacy backend TypeScript | Passed |
| Standalone pharmacy frontend TypeScript | Passed |
| Existing HMS test suite | 266 passed, 44 failed, 5 skipped |
| Existing test files | 21 passed, 16 failed, 4 skipped; nine failed suites cannot load obsolete frontend paths |
| New isolated audit reproductions | Three known defects reproduced; tests use `it.fails`, so their green runner output means the desired behavior currently fails |
| Browser and real disbursement acceptance | Not performed |

## Findings, in recommended repair order

### 1. High: suspended accounts retain existing access-token access

`Backend/src/middleware/authenticate.ts:24` validates the JWT but does not recheck account status or role. `blockIfMustResetPassword` only consults the database when the token already contains `mustResetPassword: true`. A forced reset performed after issuance does not invalidate a token containing `false`.

`Backend/src/modules/identity/portalUser.service.ts:122` suspends the account and revokes refresh tokens, but existing access tokens continue until expiry. Default access-token TTL is 15 minutes; actual configured TTL determines the exposure.

Reproduced without live credentials in `Backend/audit/known-issues.test.ts` (AUDIT-01). An existing valid token passes both middleware functions even though the mocked account is suspended.

Repair: enforce current account status/session version at authentication, refresh role/password-reset state, and test suspension, forced password reset, role changes and logout/session invalidation.

### 2. High: inventory issues can exceed available stock

`Backend/src/modules/inventory/inventory.service.ts:655` validates each requested line against the same original stock balance before writing any deduction. The request schema at `Backend/src/modules/inventory/inventory.schemas.ts:111` accepts repeated item IDs.

Reproduced example: ten units available; request contains the same item twice with quantity seven each. Both checks succeed and fourteen units are issued, leaving minus four. No database uniqueness constraint on requisition/item prevents these duplicate lines.

The issue path also lacks an explicit item lock or serializable transaction, leaving a separate concurrent-issuance risk. `paySupplier` at line 163 has a similar read-balance/write-payment pattern requiring concurrency review.

Repair: combine quantities by item or reject duplicate items; serialize stock mutations and supplier payments; verify returns and adjustments under the same rules.

### 3. High: company remittances are omitted from management outstanding and department realization

`Backend/src/modules/frontdesk/panelBilling.service.ts:204` correctly records company payments in `PanelRemittance` and `PanelRemittanceAllocation`, deliberately leaving patient `paidTotal` unchanged.

However, `Backend/src/modules/reports/managementReports.service.ts:383` calculates outstanding from `total - paidTotal`, without subtracting realized panel allocations. Reproduced example: invoice 1,000; patient owes and pays 200; company owes and pays 800. Management Outstanding still reports 800 due.

The shared department collection ledger at `Backend/src/shared/departmentCollections.ts:56` reads only `PaymentReceipt`. Management Summary also reads patient receipts without company remittances. Accordingly, company-paid LAB services do not become realized department collections/payables through this path.

Repair: reconcile patient collections and company remittances as distinct sources, allocate each according to its coverage basis, and include realized company amounts once in collection/payable/outstanding reports. Retain their own dates and methods.

### 4. High: provider cash settlement does not post a cash outflow

`Backend/src/modules/setup/setup.service.ts:1573` validates eligibility and creates a `ProviderSettlement` voucher, but does not create a cash-ledger/main-fund debit. There is no subsequent posting in the controller or frontend settlement flow.

`Backend/src/modules/cash/mainFund.service.ts:10` calculates funds exclusively from `MainCashFundEntry`. Thus recording a cash provider payment reduces the provider payable but does not, by itself, reduce the hospital cash balance.

This is a code-confirmed integration gap; no actual cash settlement was posted during the audit.

Repair: define the funding source for each payment method and atomically post the voucher and corresponding financial outflow, with idempotency and reversal handling. Avoid debiting both custody and central fund for the same physical payment.

### 5. Medium: some management report results silently stop at 1,000 invoices

`Backend/src/modules/reports/managementReports.service.ts:348` and `:400` use `take: 1000` without returning pagination or a truncation indicator for these reports.

Outstanding filtering occurs after this limit, so older settled invoices can consume the limit while later unpaid invoices disappear. At larger volumes, reports/exports can omit eligible records.

Repair: paginate explicitly or aggregate/export the full filtered result; filter financial eligibility before applying a page limit.

### 6. Verification gap: the full regression suite is not healthy

The complete existing run returned 44 failed test cases and nine additional test suites that could not load. Many failures are test infrastructure drift rather than established production defects:

- Nine suites import the old `ch-sharif-and-saeed-hospital---hms` frontend folder instead of `Frontend`.
- Multiple admission/payment tests lack transaction mocks such as `$executeRaw`.
- Other mocks omit medicine, pharmacy-charge or purchase-order delegates now required by the services.
- Some expectations differ from current admission/default-service behavior and need requirements review.

Do not equate 44 failed tests with 44 confirmed application bugs. Conversely, do not mark the application release-ready until these checks run and meaningful acceptance assertions pass.

Database-writing integration suites were deliberately disabled for this audit. Their five skipped cases include payroll/commission and pharmacy/service integrations.

## Live database observation

The read-only scan at approximately 14:40 Pakistan time returned:

- Non-void invoices: 0.
- Panel remittances: 0.
- Provider settlements: 0.
- Negative inventory items: 0.
- Duplicate open-admission bed assignments and checked bed-status inconsistencies: 0.

These results do not establish working financial reconciliation: there were no non-void invoices or panel/provider payments to exercise those checks at that time. They also differ from the earlier LAB audit in this conversation, which saw LAB 1,000 and hospital collections 3,500. This audit did not change those records and does not establish why the configured database state differs.

Audit runner: `Backend/scripts/audit-software-readonly.ts`. It prints aggregate counts/amounts only, without patient information or credentials.

## Coverage and limits

Reviewed authentication/authorization, management and department reports, panel realization, inventory issue/payment paths, admission/discharge gates, payroll routes/tests, pharmacy stock locking and bridge routes. Existing salary, panel-remittance and several receipt/refund tests passed. Both pharmacy projects typechecked successfully.

No full browser walkthrough, printer check, concurrent real-money transaction, backup/restore exercise, pharmacy-to-HMS live round trip, or deployment inspection was performed. Existing unrelated working-tree edits were preserved.

Recommended next work: repair findings 1–4, fix report pagination, restore the regression suite, then run representative browser and isolated database acceptance flows for cash, panel, admission/discharge, pharmacy, payroll and reversals.
