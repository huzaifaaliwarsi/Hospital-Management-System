# Balance Sheet & Account Settlement — Implementation Plan

Source of truth: `CHSS_HMS_Balance_Sheet_and_Account_Settlement_Guide.pdf` (v1.0), cross-checked against the actual codebase on 2026-09-24.

**Scope for this work (per instruction):** only the 4 portals that are already built and live —
**Super Admin, Admin, Front Desk / Billing, Admission.**
Inventory Management and Standalone Pharmacy are explicitly **out of scope today** even though the guide mentions them — they are not part of today's task.

No hardcoded numbers, no mock arrays, no fabricated actor names anywhere in this scope. Every figure must trace to a real Prisma row and the actual logged-in `portalUserId`.

---

## 1. What the guide requires (condensed)

| Portal | My Balance Sheet | My Account Settlement | Oversight (all users) |
|---|---|---|---|
| Front Desk / Billing | Mandatory | Yes | No |
| Admission | **Never** (no patient cash) | **Never** | No |
| Admin | Only if personally handling cash | Only if personally handling cash | **Yes — view/verify** |
| Super Admin | Only if personally handling cash | Only if personally handling cash | **Yes — hospital-wide** |

Core rule chain: `Money event → User balance sheet → Unsettled position → Settlement/reconciliation → Locked history`. Cash/Card/Bank/Online stay separately identifiable. No delete on posted settlements — only reversal/adjustment with reason + actor + timestamp. Admission never collects patient cash; it only shows payment status and redirects to Front Desk.

---

## 2. Current state audit (what's real vs missing)

### 2.1 Front Desk / Billing — already real, matches the guide ✅
- `GET /cash/balance-sheet` → `cashService.getCashierBalanceSheet` (`hms-backend/src/modules/cash/cash.service.ts`) — computes `expectedPhysicalCash = physicalCashIn − physicalCashOut` from real `UserCashBalance` rows, keeps non-cash separate. Matches guide §3.2 formula.
- `GET/POST /cash/settlements` → `settlementService` (`hms-backend/src/modules/cash/settlement.service.ts`) — bundles unsettled rows into one `AccountSettlement`, computes variance, requires a reason when variance ≠ 0. Matches guide §4.1.
- Frontend: `MyBalanceSheetView.tsx` and `MyAccountSettlementView.tsx` (`ch-sharif-and-saeed-hospital---hms/src/features/frontDesk/billing/` and `.../settlement/`) — both live, no mock data.
- Nav: `fd_cash_control` group already has `my_balance_sheet` / `my_account_settlement` (`portalNavigations.ts`).

**Gap:** `PaymentReceipt.reference` exists in the schema for Card/Bank/Online reconciliation refs (guide §5), but need to verify the Front Desk payment-collection form actually captures it per channel today — treat as a verify-and-fix-if-missing step, not a rebuild.

### 2.2 Admission — already compliant, matches the guide ✅
- `authorize.ts` policy map: `ADMISSION` role has **no `cash` module grant at all** — backend already makes cash collection structurally impossible from this portal.
- `ADMISSION_NAV_GROUPS` (`portalNavigations.ts`) has **zero** balance-sheet/settlement nav items (comment in the file literally says "NO cash collection, NO balance sheet, NO account settlement").
- `hospital_payment_requests` nav item + `AdmissionPaymentRequest` model (`requestedById` on the Admission side) already implement "Admission requests a payment, Front Desk collects it" — exactly guide §8's redirect flow.

**Gap:** need to confirm the Admission payment-status screen's copy actually tells the user "pay at Front Desk" (UX check), not a functional gap.

### 2.3 Admin / Super Admin — the real gap ❌
- Nav already has the right structure: `hm_financial_control` group → `balance_sheets` ("Balance Sheets") and `account_settlements` ("Account Settlements") — see `portalNavigations.ts` lines ~152–154.
- **But** `SuperAdminModuleView.tsx` has no dedicated branch for `activeModuleId === 'balance_sheets'` or `'account_settlements'`. Both fall through to the generic `getModuleConfig()` + mock-array table renderer used for Departments/Services/etc — i.e. **these two screens are currently non-functional placeholders**, not wired to `GET /cash/balance-sheet/:userId` or to `AccountSettlement` at all.
- Backend has `GET /cash/balance-sheet/:userId` (single user, already built) but **no endpoint to list all cash-handling users' balance sheets**, and **no endpoint to list/filter the central `AccountSettlement` register across users**.
- **No review/accept/reject/partial-accept endpoint** — confirmed by the comment in `settlement.service.ts`: *"Review/approval of a submitted settlement (Admin/Super Admin side) is a separate screen, not yet built."*
- **No reversal/adjustment** capability — `SettlementStatus` enum is `PREPARED | SUBMITTED | ACCEPTED | PARTIALLY_ACCEPTED | RETURNED | REJECTED`. There is no `REVERSED`/`ADJUSTED` state for correcting an already-accepted settlement (guide §4.2, §12 rule 3).
- **No Finance Control KPIs** (guide §6.3: total cash collected today, card/bank/online totals, refunds, expected vs settled, unsettled cash, users pending settlement, differences, settlements completed today) anywhere in the Admin/Super Admin dashboards today.

This is where almost all of today's real work is.

### 2.4 Status vocabulary — decision needed, not a blocker
Guide uses `OPEN/UNSETTLED, PARTIALLY_SETTLED, SETTLED, REVERSED/ADJUSTED`. The DB already ships `PREPARED, SUBMITTED, ACCEPTED, PARTIALLY_ACCEPTED, RETURNED, REJECTED`. Renaming a live enum is a bigger migration than today's scope needs. **Decision: keep the existing enum, add `REVERSED` to it, and map conceptually** (`SUBMITTED` = guide's "submitted for review", `ACCEPTED` = guide's `SETTLED`, `PARTIALLY_ACCEPTED` = guide's `PARTIALLY_SETTLED`). This will be documented as the official mapping so Admin-side UI labels match the guide's language even though the DB enum keeps its current names.

---

## 3. Implementation steps

### Step 1 — Schema: enable reversal/adjustment
`hms-backend/prisma/schema.prisma`
- Add `REVERSED` to `SettlementStatus` enum.
- Add to `AccountSettlement`: `reversalReason String?`, `reversedById String? @map("reversed_by")`, `reversedAt DateTime? @map("reversed_at")`, self-relation `reversalOfId String?` / `reversalOf AccountSettlement?` (a reversal creates a new linked record rather than mutating the original — guide §4.2 "not silently edited").
- New migration: `prisma migrate dev --name finance_control_settlement_reversal`.

### Step 2 — Backend: Finance Control oversight service
`hms-backend/src/modules/cash/`
- `financeControl.service.ts` (new):
  - `listBalanceSheets(filters)` — all cash-handling users (role in `FRONT_DESK_BILLING`, plus `ADMIN`/`SUPER_ADMIN` where they personally hold `UserCashBalance` rows — guide §9, never a blanket "oversight = collector" assumption), filterable by date range, portal/role, user.
  - `listSettlements(filters)` — central register over `AccountSettlement`, filterable by status, date/period, portal, user.
  - `reviewSettlement(id, action: 'ACCEPT'|'PARTIALLY_ACCEPT'|'RETURN'|'REJECT', reviewerPortalUserId, remarks?)` — sets `status`, `reviewedById`, `reviewedAt`; enforces the existing `reviewedByUser` relation. Reviewer identity always comes from `req.user`, never a hardcoded label.
  - `reverseSettlement(id, reason, actorPortalUserId)` — only on `ACCEPTED`/`PARTIALLY_ACCEPTED`; writes the reversal fields from Step 1, does not touch the original row's core amounts.
  - `getFinanceKpis(filters)` — the guide §6.3 list, aggregated from `UserCashBalance` + `AccountSettlement` for the selected period.
- `cash.controller.ts` — add controller methods for the four calls above.
- `cash.routes.ts` — add:
  - `GET /cash/finance-control/balance-sheets` (`authorize('cash','view')`)
  - `GET /cash/finance-control/settlements` (`authorize('cash','view')`)
  - `POST /cash/finance-control/settlements/:id/review` (`authorize('cash','approve')`)
  - `POST /cash/finance-control/settlements/:id/reverse` (`authorize('cash','approve')`)
  - `GET /cash/finance-control/kpis` (`authorize('cash','view')`)
  - No `authorize.ts` policy changes needed — `ADMIN` and `SUPER_ADMIN` already have full `cash` access; `FRONT_DESK_BILLING`/`INVENTORY_MANAGEMENT` only have `view`/`create`, so they're naturally excluded from `approve`-gated routes.

### Step 3 — Frontend: Finance Control services
`ch-sharif-and-saeed-hospital---hms/src/services/`
- `financeControlService.ts` (new) — thin wrappers over the 5 endpoints above, typed responses, no mock fallback.

### Step 4 — Frontend: real Finance Control screens
`ch-sharif-and-saeed-hospital---hms/src/features/superAdmin/financeControl/`
- `FinanceControlBalanceSheetsView.tsx` — guide §6.1 table (Date/Shift, Portal, User, Expected Cash, Settled Cash, Unsettled Cash, Card/Bank/Online, Difference) + filters.
- `FinanceControlAccountSettlementsView.tsx` — guide §6.2 central register (Settlement No., Date/Period, Portal, User, Cash/Card/Bank/Online, Total, Difference, Status, Received/Verified By) + View/Print/Export/Reverse actions. **No delete button anywhere** (guide §13.2 explicit instruction).
  - Sub-views via tabs/filters, not new nav items, to keep the existing 2-item nav structure: **Pending Settlements** (status = SUBMITTED), **Settlement History** (status = ACCEPTED/PARTIALLY_ACCEPTED/REJECTED/REVERSED), **Settlement Differences** (variance ≠ 0). This satisfies guide §13's 5-screen list without a nav rewrite.
- Wire both into `SuperAdminModuleView.tsx`: add `if (activeModuleId === 'balance_sheets') return <FinanceControlBalanceSheetsView />;` and the equivalent for `account_settlements`, **before** the generic mock-table fallback so real data replaces the placeholder. Shared automatically by both `super-admin` and `admin` portals (same routing already in place).

### Step 5 — Finance KPIs on the Admin/Super Admin dashboard
- Extend `hms-backend/src/modules/reports/dashboard.service.ts` (or a small addition alongside it) to surface the guide §6.3 KPI set, sourced from the Step 2 aggregation.
- Add a "Finance Control" KPI strip to `AdminDashboard.tsx` / `SuperAdminDashboard.tsx` reusing `dashboardService` the same way the existing `billingSummary` block already does — no new hardcoded numbers.

### Step 6 — Front Desk verification pass (no rebuild expected)
- Confirm the payment-collection form (wherever `PaymentReceipt` is created) captures `reference` for Card/Bank/Online the same way it's already captured for Panel Remittance — fix only if actually missing.
- Confirm `MyAccountSettlementView.tsx`'s per-channel breakdown itemizes Cash vs Card vs Bank vs Online distinctly in the submission (guide §5: "must not imply non-cash was physically handed over as cash") — currently the settlement form is cash-only (`physicalCash`, `handoverAmount`); verify whether channel-level settlement itemization is needed here or whether channel reconciliation is intentionally oversight-only (Admin side) per guide table in §5. **Decision to confirm with you before building:** keep Front Desk settlement cash-only (matches current implementation and guide's cash formula) and let Card/Bank/Online reconciliation live entirely in the new Admin Finance Control screens.

### Step 7 — Admission verification pass (no rebuild expected)
- Confirm `hospital_payment_requests` view's copy/UX clearly states "collected at Front Desk" and never renders a pay/collect action.
- No backend change expected — `authorize.ts` already blocks `cash` for `ADMISSION`.

### Step 8 — QA pass (guide §16, scoped to our 4 portals)
Re-run every row of the guide's checklist against the 4 in-scope portals only:
cash receipt → balance sheet, card/online receipt → non-cash only, refund → correct channel, partial settlement → remaining preserved, full settlement → status correct, difference → reason required, Admin review → original cashier attribution unchanged, delete attempt → blocked (reversal only), Admission payment attempt → blocked/redirected, print/export → real `Generated By` + timestamp, no hardcoded actor names anywhere.

---

## 4. Non-negotiable rules carried into this build (guide §12)
1. Every money transaction uses the actual authenticated `portalUserId` — never a fallback name.
2. Cash / Card / Bank / Online stay separately identifiable end-to-end.
3. No posted settlement is silently edited or deleted — reversal/adjustment only.
4. Partial settlements preserve the remaining unsettled balance.
5. Receipts/refunds stay linked to their original references.
6. Admission never becomes a patient cash counter.
7. Admin/Super Admin oversight never reassigns ownership of a collection.
8. Cashier settlement and (future) department settlement stay separate ledgers — not part of today's scope, but nothing built today should merge them.
9. Every export/print shows the real `Generated By` user and timestamp.
10. Historical settlement records stay immutable except through the controlled reversal path.

---

## 5. Order we'll actually build in
1. Step 1 (schema + migration)
2. Step 2 (backend Finance Control service/routes)
3. Step 3–4 (frontend service + the two real oversight screens, replacing the mock placeholders)
4. Step 5 (dashboard KPIs)
5. Step 6–7 (verification passes, fix only if a real gap is found)
6. Step 8 (QA checklist)

Waiting on your go-ahead to start Step 1.
