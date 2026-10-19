# Management Summary: salary and commission integration

Implemented 2026-10-19. Existing salary slips, commission accruals and actual
payments remain the source of truth. No duplicate payroll/commission runs are
created by reporting.

## Reporting definitions

- Generated: approved net payable recognized at approval, plus subsequent
  signed liability adjustments/reversals posted in the reporting period.
- Paid: signed actual payments posted during the period. Linked payout
  reversals subtract from paid on the reversal date.
- Outstanding: approved net payable less payments through period end,
  clamped to zero for each slip/accrual before summing. Prior-period liabilities
  remain included; overpayments cannot hide another employee's liability.
- Legacy approved records missing approvedAt use createdAt as the documented
  fallback. No historical dates or payment amounts are rewritten.
- Department: payroll run department where assigned, otherwise staff membership;
  commission uses its source invoice department. User: approver for recognized
  costs/liabilities, payer for payments (a reversal is attributed to the original
  payer for reporting, while its actor remains stored separately).
- Commission uses canonical rule snapshots and commissionBalance, including
  discounts/repricing, commission tax, service refunds and adjustments. Accruals
  are unique per service line and are not added to their run totals again.
- Financial Summary assumption (the user's section 5 was truncated): Net Billing
  minus existing Hospital Expenses, existing Drawer Expenses/Purchases, Salary
  Generated and Commission Generated. Labelled approval basis, not cash profit.
  Existing expense metric scope is preserved: drawer expenses have no canonical
  department allocation; they remain user/period scoped even with a department
  filter. This is not a fully allocated departmental profit statement.

The existing report row pipeline feeds the table and Excel/CSV/PDF/Print. Salary
and commission payments are not duplicated as Expense Management records.

## Payments and custody

- Salary and commission pay requests now require a UUID requestKey. The UI
  creates one per payment dialog and retains it for retries. Reusing a key with
  different details is rejected. Parent row locks and unique constraints protect
  partial/full payments and duplicate requests.
- CASH writes a linked OUT entry on the authenticated payer's UserCashBalance,
  using their existing module scope. No client-selected cashier is accepted.
- New categories SALARY_PAYMENT and COMMISSION_PAYMENT keep these costs out of
  the existing operating-expense/purchase aggregate to avoid double counting.
- No main-fund debit or change to custody/settlement ownership rules is made.
- BANK/CARD/ONLINE remains an actual payout record; no canonical hospital bank
  account ledger exists. StaffBankAccount is beneficiary information, not a
  hospital account balance. The payment form explains this limitation.
- Payments history exposes linked reversal actions. Reversal requires the
  existing approve permission and a reason. It appends a negative payment,
  restores liability, and credits the original cash owner if a linked debit
  exists. Repeated reversals are idempotent. Settled originals are not edited:
  the inverse entry is newly unsettled, following existing custody rules.
- Historical unlinked payments remain included in reports, without automatic
  retroactive cash debits or invented credits on reversal. Read-only local audit
  found one historical salary payment totalling PKR 900 and no commission payout.

## Database and verification

Applied only the additive migration 202610190002_staff_payment_cash_links to the
configured local chss_hms database and regenerated Prisma. Existing migration
history contains many pre-existing unapplied entries despite existing tables;
no unrelated migration was applied or reset. Backend health endpoint returns OK.

75 focused tests pass, including real database rollback-only integration for
cash salary/commission payments, partial/full payments, retry conflicts,
overpayment rejection, bank payment without cash debit, inverse cash entries,
historical unlinked reversal, reporting and unchanged test-data persistence.
Backend and frontend typechecks pass. Frontend production build passes (existing
large-bundle advisory only). Fixed the dashboard occupancy field and separated
medicine-report export text from styled screen cells. Corrected the stale
partial-period salary test to the existing prorated salary rule without changing
payroll calculations. The real database + HTTP test also passes, covering service
eligibility, discounts, tax, generation, approval, payments and reporting. All
test fixtures were rolled back. Browser visual verification was not available.
