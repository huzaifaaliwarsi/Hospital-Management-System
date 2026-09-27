# Salary and doctor commission implementation — 27 September 2026

Reviewed `Staff Portal Access Salary Commission.pdf`, including the salary, service commission, payment-account, approval, correction and reporting rules. Scope is the financial workflow requested; unrelated HR, portal and reporting modules were not redesigned.

## Rules applied

| Salary basis | Salary calculation | Service commission |
|---|---|---|
| Monthly | Full configured base; absence deduction = base / 30 × absent equivalent days | None |
| Monthly + Commission | Guide formula: base / scheduled payable days in the selected period × approved attendance equivalent | Separate commission ledger |
| Daily | Existing daily rate × approved attendance equivalent | None |
| Daily + Commission | Existing daily rate × approved attendance equivalent | Separate commission ledger |

Your explicit final instruction overrides the PDF for plain Monthly: calendar days never reduce its configured base. Fixed salary components retain their configured per-run amounts. Salary tax and commission tax remain separate.

For the earlier plain Monthly example, 31/08/2026–27/09/2026, base PKR 28,000, scheduled 24 and present equivalent 2: old erroneous daily rate PKR 1,000 produced PKR 22,000 absence deduction. Correct daily rate is 28,000 / 30; absence deduction is PKR 20,533.33 and earned base PKR 7,466.67 before other components. No calendar-period proration applies.

Guide examples covered by regression tests:

- Monthly + Commission: 60,000 / 30 × 27.5 + 2,000 allowance − 5% salary tax − 1,000 deduction = PKR 53,150 salary.
- Service net PKR 9,000 × 15% = PKR 1,350 commission. At 10% commission tax, payable is PKR 1,215, independent of salary.
- Daily: 3,000 × 8.5 − 500 tax − 300 deduction = PKR 24,700.
- Daily + Commission integration fixture: PKR 2,850 salary and three services × PKR 500 = PKR 1,500 commission, in separate runs.

## Runtime gaps fixed

1. Commission posting existed on manual invoice services but was missing from appointment check-in and admission-service billing. All three entry points now use the same accrual calculation; self-arranged admission services are excluded.
2. Accrual now requires a completed, non-void billed service, an active assigned doctor/service, an effective commission-enabled salary profile and an effective commission rule. Plain Monthly/Daily and missing-profile cases do not accrue commission.
3. Service-specific percentage/fixed rules and their effective dates are preserved in snapshots. Percentage commission follows eligible net after discount; fixed commission follows quantity. Later rule changes do not rewrite posted statements.
4. Configured commission tax now participates in payable and remaining amounts. Partial refunds reverse commission proportionally, capped at its remaining earned amount. Discount changes create signed repricing records instead of overwriting original accruals.
5. Daily/monthly/custom commission Preview → Generate → Approve workflows were added with department, doctor and service filters. Generation claims eligible lines once. Payment before approval and payment above the remaining balance are rejected.
6. Salary and commission have separate payments, preferred-account displays and immutable signed correction records with actor/reason/date. Overpayments after refunds/corrections appear as recoverable balances.
7. Salary generation rejects overlapping slips; approval/payment operations guard against duplicate or concurrent changes.
8. Super Admin Staff / Payroll / Commission reporting now reconciles generated amounts, corrections, tax, reversals, payable, paid, remaining and recoverable balances. “View statements & payments” opens the underlying statements, run references, payments and correction/refund history. Historical inactive staff remain visible.

Report periods describe earnings: an overlapping salary slip is included in full, and its later payments/corrections are included for reconciliation. Existing generated records are preserved; this change does not silently recalculate or pay old slips.

## Files changed for this work

Backend:

- `hms-backend/prisma/schema.prisma` and migrations `20260927140000_commission_runs_and_adjustments`, `20260927143000_commission_repricing_source`.
- `hms-backend/src/modules/commission/commission.calc.ts`, `commissionRun.service.ts`, `commission.service.ts`, `commission.schemas.ts`, `commission.controller.ts`, `commission.routes.ts`.
- `hms-backend/src/modules/payroll/payroll.calc.ts`, `payroll.balance.ts`, `payroll.service.ts`, `payroll.schemas.ts`, `payroll.routes.ts`.
- Narrow commission hooks in `frontdesk/appointments.service.ts`, `frontdesk/invoices.service.ts`, `admission/admission.service.ts`.
- Staff payroll/commission function only in `reports/managementReports.service.ts`.
- Regression files `tests/commissionBlueprint.test.ts`, `commissionPayrollDatabase.test.ts`, `payrollSalary.test.ts`, `payrollPreviewGenerate.test.ts`; updated relevant commission fixtures in `phase4_frontdesk.test.ts`.

Frontend, under `ch-sharif-and-saeed-hospital---hms/src`:

- `features/superAdmin/doctorCommission/DoctorCommissionView.tsx`, `CommissionRunsPanel.tsx`.
- `features/superAdmin/payroll/SuperAdminPayrollView.tsx`, `FinancialAdjustmentModal.tsx`, `PreferredPaymentAccount.tsx`.
- `features/superAdmin/reports/ManagementReports.tsx`, `StaffFinancialSources.tsx`.
- `services/commissionService.ts`, `payrollService.ts`, `managementReportsService.ts`, `types/payroll.ts`.

Pre-existing edits in identity/staff deletion and the reporting PDF were preserved.

## Verification

- `npm run typecheck` in backend: passed.
- `npm test -- payroll commissionBlueprint`: 50 passed; database test intentionally skipped without its opt-in environment variable.
- `$env:HMS_PAYROLL_DB_TEST='1'; npm test -- commissionPayrollDatabase`: passed against real PostgreSQL and HTTP payroll/commission/report routes. Covers Preview/Generate parity, approval, separate partial payments, corrections, refund API, appointment/admission commission hooks and report reconciliation. All test fixtures rolled back; no test payroll or payment was retained.
- Full backend suite: 291 passed, 21 failed, 1 skipped. Remaining failures are existing admission estimate/bed/discharge/advance and front-desk cash/settlement test issues; the suite is not entirely green. These unrelated areas were not changed to make tests pass.
- Frontend production build passed. Frontend typecheck has the existing unrelated `GlobalSearchModal.tsx:247` TS2322 error.
- Browser verified commission preview, empty-state handling, disabled generation with no eligible lines, expanded Super Admin financial columns and the source-statement modal. No browser errors reported in this check.
- Both database migrations applied locally. Project available at `http://localhost:3000`, API at port 4000.

## Current live configuration

The local Doctor Commission screen currently shows **no configured commission rules**. The report shows both live doctors with plain Monthly profiles and zero commission. The implemented workflow is verified, but these doctors will not earn service commission until their intended Monthly + Commission or Daily + Commission profile, assigned services and effective commission rates are configured. No doctor-specific rates were invented, and no real payout was made.

Use Staff Users to configure the intended salary basis/service assignments, Doctor Commission to configure rates and Preview → Generate → Approve, then record commission payments separately. Use Super Admin → Reports → Staff / Payroll / Commission → View statements & payments to reconcile them.
