# Inventory Management Portal — Final Structure & Working Context

> Source: `HMS_Inventory_Portal_Final_UI_Functional_Structure.pdf` (shortcut on repo root, actual
> file at `C:\Users\pc\Downloads\HMS_Inventory_Portal_Final_UI_Functional_Structure.pdf`) — this
> **supersedes** the older `06 Inventory Management Portal.pdf` nav structure that
> `INVENTORY_NAV_GROUPS` in `portalNavigations.ts` currently implements. Cross-check against
> `PROJECT_MASTER_SPEC.md` §4.8/§4.9 (original functional rules — fund flow, purchase return cash
> rules, negative-stock rejection) and `Balance_sheet&Account_settlement.md` (generic cash/
> settlement system — Inventory was explicitly out of scope there, see §6 below) before building.

---

## 1. The One Rule Everything Else Follows

**Keep the portal simple and operator-friendly — do not give every transaction type its own
sidebar item.** Related stock actions live together in one **Stock Movement Center** (tabs, not
separate screens). **Supplier Ledger stays separate** from Supplier Directory because it's a
dedicated financial ledger, not a list screen.

**Main Daily Flow:** Dashboard → Receive Petty Cash / Stock In → Issue Stock to Department →
Receive Department Return → Manage Supplier Ledger/Payments → Record Expense → Review My Balance
Sheet → Submit Account Settlement.

---

## 2. Final Sidebar / Navigation Structure (replaces `INVENTORY_NAV_GROUPS`)

Only **5 groups, 9 screens total** — down from the current 7 groups / ~20 nav items:

| Group | Screens | Why |
|---|---|---|
| **Dashboard** | Inventory Dashboard | One operational overview + quick actions |
| **Inventory** | Stock Overview; Stock Movement Center | All stock transactions grouped, not one sidebar item each |
| **Suppliers** | Supplier Directory; Supplier Ledger | Ledger is intentionally separate — it's a running financial ledger |
| **Cash & Expenses** | Petty Cash & Expenses; My Balance Sheet; My Account Settlement | All inventory-user money handling stays together |
| **Reports** | Inventory Reports | One reporting center with a report-type selector, not 8 sidebar items |

Masters (Items/Categories/Units/Suppliers/Locations) are **not** separate sidebar items in the
final design. Item CRUD lives inside **Stock Overview** (`+ Add Item`); Supplier CRUD inside
**Supplier Directory**. Category/Unit CRUD should be small `Manage Categories` / `Manage Units`
modal or drawer actions reachable from Stock Overview (e.g. next to `+ Add Item`), not their own
sidebar screens and not extra clutter on the main Stock Overview table itself.
**Stock Locations will not have a separate sidebar screen in the current UI** — the PDF still lists
`Location` as a Stock Overview filter (§4.1), so the concept isn't gone, just not a standalone
master screen. `StockItem` has no `location` field today (verified against
`hms-backend/prisma/schema.prisma`) — when adding it for that filter to work, keep it as a
lightweight field (or a small `StockLocation` lookup table if multi-store is anticipated) rather
than skipping it, so future multi-store/multi-warehouse use isn't blocked later.

---

## 3. Dashboard — What Must Appear

Answers 3 questions: what stock needs attention, what money/supplier dues need attention, what
happened today.

**Top KPI cards (8, each with a click-through):** Total Stock Value → Stock Overview · Low Stock →
Stock Overview filtered · Near Expiry → expiry-filtered stock · Stock In Today → Stock Movement:
Stock In tab · Department Issues Today → Department Issue tab · Supplier Payable → Supplier Ledger
· My Expected Cash → My Balance Sheet · Pending Settlement → My Account Settlement.

**Panels:** Attention Required (low stock, near expiry, expired/quarantine, unusual adjustment,
overdue supplier due) · Recent Stock Movements (latest In/Issue/Return/Supplier Return/Adjustment)
· Supplier Payable Snapshot (top suppliers by payable + View All) · My Cash Snapshot (petty cash
received, today's outflow, expected cash, last settlement status).

**Quick actions:** + Stock In · Issue Stock · Receive Return · + Expense · Pay Supplier · My
Balance Sheet.

**Every number above must come from real Prisma queries** (`StockLedger`, `PurchaseOrder`,
`DepartmentRequisition`, `SupplierLedger`, `UserCashBalance`/`AccountSettlement` filtered
`moduleScope: 'INVENTORY'`) — see §7, the current dashboard is 100% hardcoded.

---

## 4. Inventory Section

### 4.1 Stock Overview
- Top buttons: `+ Add Item` (opens Item master form — name/category/unit/reorder level, **never**
  quantity), Export Excel/PDF, Print.
- Filters: Search, Category, Stock Status, Location, Expiry Window.
- Summary: Total Items, Total Qty, Stock Value, Low Stock, Near Expiry.
- Table: Item Code, Name, Category, Unit, Available Qty, Reorder Level, Batch/Expiry indicator,
  Stock Status, Value.
- Row actions: View Stock History, Edit Item (master fields only), Activate/Deactivate.
- **Rule: Edit Item must never directly change quantity — quantity only moves through Stock
  Movement transactions** (this is already true of the schema: `StockItem` has no mutable quantity
  field, `StockLedger` is append-only delta — good, keep it that way).

### 4.2 Stock Movement Center — one screen, 5 tabs
| Tab | Primary buttons | Purpose |
|---|---|---|
| Stock In / Purchase | `+ New Stock In`, View Purchase, Print GRN | Receive from supplier — cash/bank/credit |
| Department Issue | `+ Issue Stock`, Print Issue Note | Give stock to a hospital department |
| Department Return | `+ Receive Return`, View Original Issue | Bring unused/returned stock back |
| Supplier Return | `+ Return to Supplier`, Print Return Note | Return stock to supplier, adjust supplier balance |
| Adjustment | `+ New Adjustment` | Damage, expiry, loss, count correction, surplus/quarantine |

Common filters across all tabs: Date range, Movement Type, Item, Category, Department, Supplier,
User, Status (Draft/Posted/Cancelled).

**Forms (§ per PDF page 5):**
- **Stock In:** Header (Supplier, Date, Invoice No, Payment Type, Notes) → Item Grid (Item, Batch,
  Expiry, Qty, Unit Cost, Discount/Tax, Line Total) → Finance (Total, Paid Now, Supplier Due) →
  `Save Draft | Post Stock In | Save & Print GRN | Cancel`.
- **Department Issue:** Header (Department, Requested By, Issued To, Purpose) → Item Grid (Item,
  Available Qty, Batch, Issue Qty) → `Save Draft | Issue Stock | Save & Print Issue Note | Cancel`.
- **Department Return:** Header (Original Issue Ref, Department, Returned By) → Item Grid
  (Item/Batch, Issued Qty, Already Returned, Return Qty, Condition) → Stock Treatment: Usable →
  Available Stock, Damaged/Expired → Quarantine/Adjustment → `Receive Return | Print Return Note |
  Cancel`.
- **Adjustment:** Adjustment Type (Damage/Expiry/Count Correction/Loss/Surplus/Quarantine) + Item/
  Batch + Qty (+/− by type) + mandatory Reason + Approval where configured →
  `Post Adjustment | Save Draft | Cancel`.

---

## 5. Suppliers Section

- **Supplier Directory:** `+ Add Supplier`, Export/Print. Filters: Search, Active/Inactive, Payment
  Terms. Table: Code, Name, Contact, Phone, Terms, Current Due, Status. Row actions: View, Edit,
  Open Ledger, New Purchase, Pay Supplier.
- **Supplier Ledger (separate screen):** Header (name, contact, terms, Current Payable/Advance).
  Buttons: Pay Supplier, Purchase Return, Add Approved Adjustment, Print Statement, Export.
  Filters: date range, Transaction Type. Table: Date, Ref, Type, Description, Purchase, Payment,
  Return/Credit, Adjustment, Running Balance, Actor. Footer totals: Opening, Purchases, Payments,
  Credits/Returns, Adjustments, Closing.
  **Formula:** `Opening Payable + Credit Purchases − Payments − Returns/Credits ± Adjustments =
  Current Payable` (negative = supplier advance/credit).

---

## 6. Cash & Expenses Section

**These three are separate screens/components — never one page with stacked sections.** Mirror
Front Desk's own existing file layout exactly: it already keeps
`features/frontDesk/billing/MyBalanceSheetView.tsx` and
`features/frontDesk/settlement/MyAccountSettlementView.tsx` as two independent view files (not
sections on one page), plus its own `features/frontDesk/reports/FrontDeskBillingReportsView.tsx`
for reporting. Inventory should follow the identical shape: one file for the Petty Cash & Expenses
screen (with its 2 internal tabs, §6.1), a separate file for My Balance Sheet, a separate file for
My Account Settlement, and a separate Reports view — four distinct components/routes under the
Cash & Expenses and Reports nav groups, styled/structured consistently with the Front Desk ones so
the two portals feel like the same product.

### 6.1 Petty Cash & Expenses — one screen, 2 tabs
- **Petty Cash Received** tab: View Receipt/Print. Table: Ref, Date/Time, Issued By, Amount,
  Received By, Status, Purpose.
- **Inventory Expenses** tab: `+ New Expense`, Export, Print. Table: Date, Category, Amount,
  Method, Payee/Supplier, Description, Entered By, Status.
- New Expense form: Category, Date, Amount, Payment Method, Description, Reference, optional
  Payee/Supplier, Attachment → `Save Expense | Save & Add Another | Cancel`.

### 6.2 My Balance Sheet
Filters: Today/Shift/Custom. Cards: Opening/Carry, Petty Cash Received, Cash Outflow, Cash Refund/
In, Expected Cash, Physical Cash, Variance, Settled, Remaining. Table: Date, Ref, Type,
Description, Cash In, Cash Out, Running Expected Cash. Buttons: Refresh, Enter Physical Cash,
Start Settlement, Export, Print.
**Expected Cash formula:** `Opening/Carry + Petty Cash Received + Supplier Cash Refunds/Approved
Cash In − Cash Purchase Payments − Cash Supplier Payments − Cash Expenses − Previous Accepted
Deposits ± approved cash adjustments`.

### 6.3 My Account Settlement
`+ New Settlement`. Filters: From/To, Status. Table: Ref, Period, Expected Cash, Physical Cash,
Variance, Submitted, Accepted, Remaining, Status, Reviewed By. New Settlement form: Expected Cash
read-only, user enters Physical Cash + Settlement Amount, Variance auto-calculated (non-zero →
Reason mandatory) → `Submit Settlement | Save Draft | Cancel`.

**These two screens are not Inventory-specific UI to invent from scratch — they are the same
generic Balance Sheet / Account Settlement system already built for Front Desk/Billing
(`Balance_sheet&Account_settlement.md`, `cash.service.ts`, `settlement.service.ts`,
`UserCashBalance`/`AccountSettlement` models with a `moduleScope` discriminator). See §7.3 for the
exact backend gap that blocks reusing it for Inventory today.**

---

## 7. Backend Reality Check (as of 2026-09-28)

### 7.1 Already exists and matches the spec reasonably well
- `Supplier`, `StockItem`, `PurchaseOrder`/`PurchaseOrderLine`, `StockLedger` (append-only delta —
  exactly the right pattern for Stock Movement), `SupplierLedger`, `DepartmentRequisition`/
  `DepartmentRequisitionLine` (Prisma schema, `hms-backend/prisma/schema.prisma` ~L1768–1903).
- Enums already anticipate the final tab set: `StockMovementType` has `PURCHASE_RECEIPT`,
  `DEPARTMENT_ISSUE`, `DEPARTMENT_RETURN`, `SUPPLIER_RETURN`, `POSITIVE_ADJUSTMENT`,
  `NEGATIVE_ADJUSTMENT` — the data model already has room for all 5 Stock Movement tabs even
  though only Stock In and Department Issue are actually wired up in the service layer today.
  `SupplierLedgerEntryType` has `PURCHASE_CREDIT`, `PAYMENT`, `RETURN`, `CREDIT_NOTE`.
- `inventory.service.ts` (383 lines) implements: create/list suppliers, get supplier ledger,
  create/list stock items, get item ledger, create purchase (posts `StockLedger` +
  `SupplierLedger` + a `UserCashBalance` row with `moduleScope: 'INVENTORY'` when cash-paid),
  issue to department.
- `inventoryApiService.ts` (frontend) exposes exactly those same operations and nothing more.

### 7.2 Missing from the backend for the final spec
- **No Batch/Expiry tracking** — `StockItem`/`PurchaseOrderLine`/`StockLedger` have no `batchNo`/
  `expiryDate` fields at all, but the spec's Stock In form, Stock Overview table, and dashboard
  "Near Expiry" KPI all depend on it. This is the single biggest schema gap.
  (Standalone Pharmacy already has its own parallel batch/expiry model — do **not** reuse it,
  Domain F/G are deliberately non-intersecting per the schema's own comment at line ~1764.)
- **No Department Return endpoint** — `DepartmentRequisitionLine.returnedQuantity` field exists
  but nothing in `inventory.service.ts` writes to it or posts the `DEPARTMENT_RETURN` stock ledger
  entry yet.
- **No Supplier Return endpoint** — `SUPPLIER_RETURN` movement type and `RETURN`/`CREDIT_NOTE`
  ledger entry types exist in the enums but nothing posts them.
- **No Adjustment model/endpoint** — no way to record Damage/Expiry/Loss/Count Correction/Surplus/
  Quarantine with a mandatory reason and optional approval, despite `POSITIVE_ADJUSTMENT`/
  `NEGATIVE_ADJUSTMENT` already existing as ledger movement types.
- **No dedicated Petty Cash Received record** — cash issued *to* an inventory user is implied by
  `UserCashBalance` rows but there's no receipt-style model/endpoint matching the "Petty Cash
  Received" tab (Ref, Issued By, Received By, Purpose, Print).
- **Expense model is generic, not wired to Inventory** — `Expense` model exists
  (`hms-backend/prisma/schema.prisma` ~L2491) with `paymentMethod`/`category`/`departmentId` but
  no route/service currently exposes an Inventory-scoped "New Expense" flow tied to the logged-in
  inventory user's cash balance.
- **No Reports module for Inventory** — none of the 8 reports in §7/8 of the PDF (Inventory
  Summary, Stock Movement, Purchase/Stock In, Department Issue & Return, Supplier Report, Expense
  Report, Stock Status, Cash & Settlement) exist yet; `src/modules/reports/` currently only has
  `frontdeskBilling.service.ts` and `managementReports.service.ts`.

### 7.3 The concrete blocker for §6.2/§6.3 (My Balance Sheet / My Account Settlement)
`cash.service.ts` and `settlement.service.ts` (`hms-backend/src/modules/cash/`) are **hardcoded to
`moduleScope: 'BILLING'`** in every query (`cash.service.ts:44`, `settlement.service.ts:42,83`),
even though the route layer already grants `INVENTORY_MANAGEMENT` the `cash: ['view','create']`
permission (`authorize.ts:93-97`, and `cash.routes.ts`'s own comment names
`FRONT_DESK_BILLING/INVENTORY_MANAGEMENT` as the intended `view`/`create` roles). Today, an
Inventory user hitting `GET /cash/balance-sheet` gets **BILLING-scoped data** (i.e., effectively
nothing, since they have no BILLING cash rows) instead of their real `INVENTORY` cash position.
`inventory.service.ts` **is** already writing correct `moduleScope: 'INVENTORY'` rows on purchase
— the write side is fine, the read side (`cash.service.ts`/`settlement.service.ts`) is what needs
to stop hardcoding `'BILLING'` and instead resolve scope from the requesting user's role (or accept
it as a query/route param and validate it against the caller's role).
This is the same generic-schema-not-yet-generic-service gap `Balance_sheet&Account_settlement.md`
flagged when it explicitly scoped its own build to "Super Admin, Admin, Front Desk, Admission" and
called Inventory "out of scope."

**On Pharmacy specifically:** `PROJECT_MASTER_SPEC.md` (§1, line 71) describes Standalone Pharmacy
as *"a separate project"* — architecturally it's meant to be its own system, not a module of HMS.
In the **current actual code**, however, `pharmacy.service.ts` also writes `UserCashBalance` rows
with `moduleScope: 'PHARMACY'` into the same `hms-backend` Prisma schema, and `authorize.ts`
(L98-114) grants `PHARMACY_SUPER_ADMIN`/`PHARMACY_MANAGER`/`PHARMACY_SALES_DISPENSING` the same
`cash: ['view','create']` permission on the same shared `/api/v1/cash` routes (`cash.routes.ts`,
mounted once in `app.ts`) — Pharmacy has no balance-sheet/settlement routes of its own
(`pharmacy.routes.ts` has none). So *as the code stands today*, a Pharmacy user calling
`GET /cash/balance-sheet` would hit the exact same `moduleScope: 'BILLING'` hardcode and get wrong
data too. Treat this as a secondary, unverified-in-practice observation rather than a claim to
build against — confirm Pharmacy actually depends on this shared endpoint (vs. having its own,
not-yet-found balance sheet path) before doing any Pharmacy-side work off the back of the Inventory
fix in step 4 below.

---

## 8. Frontend Reality Check (as of 2026-09-28)

- **Only one real file exists for the whole portal:** `features/dashboard/InventoryDashboard.tsx`
  (412 lines). Every KPI, every table row (pending requisitions, recent GRNs, low-stock items) is a
  **hardcoded literal array** — no `inventoryApiService` call anywhere in the file. This is the
  "mock data bhara howa hai" the user flagged — it needs to be gutted and rebuilt against real API
  calls (see §7 for what the API can/can't do yet).
- **No `InventoryModuleView.tsx` exists.** Compare to `AdmissionModuleView.tsx`/
  `FrontDeskModuleView.tsx`, which each switch on `moduleId` to render a real per-screen component.
  In `App.tsx` (~L196-203), Inventory has no `currentPortal === 'inventory'` branch at all, so
  **every single non-dashboard nav item currently falls through to the generic
  `ModulePlaceholderView`** — Items/Products, Suppliers, Purchases/GRN, Stock Ledger, Supplier
  Ledger, Department Issue/Return, Expenses, My Balance Sheet, My Account Settlement, Reports — all
  of it, today, is an empty placeholder screen. Nothing beyond the dashboard has been built.
- **`INVENTORY_NAV_GROUPS`** (`constants/portalNavigations.ts:336-399`) still implements the *old*
  7-group/~20-item structure (`06 Inventory Management Portal.pdf`) — Masters, Procurement,
  Ledgers & Stock, Movements, Cash Control, Reports as separate groups with one sidebar item per
  transaction type. This is exactly what the new final-structure PDF says not to do. It needs to
  be replaced with the 5-group structure in §2 above.
- `features/legacyPharmacy` exists as a separate folder from Inventory's own features. Hospital
  general Inventory and standalone Pharmacy operational ledgers remain separate; Pharmacy medicine
  stock/integration follows the dedicated Pharmacy inventory architecture (batch/expiry/FEFO,
  medicine requests from Admission, its own Supplier Ledger — `PROJECT_MASTER_SPEC.md` §4.10) and
  must not be accidentally mixed into general department stock when building Inventory screens —
  it is not a claim that the two never integrate at all (they do, via the Admission↔Pharmacy
  request/fulfillment hand-off), only that Inventory's own stock/ledger UI must not read or write
  Pharmacy's medicine stock tables.

---

## 9. Step-by-Step Build Plan (15 steps, backend-first)

Backend before frontend, in this order, so no screen is ever built against an endpoint that
doesn't exist yet (the "no mock data" rule from §9's closing note). Each step is independently
shippable and testable.

### Step 0 — strip the mock data first, before any backend work starts
Before touching the backend, gut `InventoryDashboard.tsx`'s hardcoded arrays (`inventoryKpis`,
`pendingRequests`, `recentGrns`, `criticalStockItems`) right now — replace every card/table with an
honest empty/zero state (not a rebuild against real data yet, that's step 10, just remove the
fabricated numbers so the portal never shows fake figures while backend work is in progress).

### Backend (1–7)
1. **Prisma: Batch/Expiry fields.** Add `batchNo`/`expiryDate` to `PurchaseOrderLine` and
   `StockLedger` (or a new `StockBatch` model if per-batch quantity tracking is needed for accurate
   FEFO/near-expiry math) + `location` field per §2's note. One migration. Needed before Stock
   Overview's expiry indicator or the dashboard's Near Expiry KPI can be real — do this first since
   everything downstream touches these fields.
2. **Fix the cash/settlement module-scope hardcode (§7.3).** Stop hardcoding
   `moduleScope: 'BILLING'` in `cash.service.ts`/`settlement.service.ts` — resolve it from the
   requesting user's role/portal instead. Smallest, highest-leverage fix; unblocks §6.2/§6.3 for
   Inventory with no schema change.
3. **Department Return endpoint.** New service method + route + schema: writes a `StockLedger`
   `DEPARTMENT_RETURN` entry, increments `DepartmentRequisitionLine.returnedQuantity`, routes
   damaged/expired qty into the Adjustment/quarantine path from step 5. Follow the existing
   `issueToDepartment` pattern in `inventory.service.ts`.
4. **Supplier Return endpoint.** Writes `StockLedger` `SUPPLIER_RETURN` + a `SupplierLedger`
   `RETURN`/`CREDIT_NOTE` entry, decrements stock, adjusts supplier balance per §5's formula.
5. **Adjustment endpoint.** New `Adjustment` model (type: Damage/Expiry/Count Correction/Loss/
   Surplus/Quarantine, item/batch, qty delta, mandatory reason, optional approval) + service/route
   that posts `POSITIVE_ADJUSTMENT`/`NEGATIVE_ADJUSTMENT` to `StockLedger`.
6. **Petty Cash Received + Inventory Expense endpoints.** Wire the existing `Expense` model into
   an inventory-scoped route; add whatever minimal "petty cash issued to this user" record the
   Petty Cash Received tab needs — check whether `UserCashBalance` already models this via
   `category`/`direction` before adding a new table.
7. **Inventory Reports endpoints (8 reports, §7/§8 of the PDF).** Inventory Summary, Stock
   Movement, Purchase/Stock In, Department Issue & Return, Supplier Report, Expense Report, Stock
   Status, Cash & Settlement — these are query/aggregation endpoints over tables that exist by now
   (steps 1–6), not new write paths. One `reports/inventory.service.ts` module, one report-type
   param + shared date/entity filters rather than 8 bespoke endpoints.

### Frontend (8–14)
8. **Nav restructure.** Replace `INVENTORY_NAV_GROUPS` with the 5-group structure from §2
   (Dashboard / Inventory / Suppliers / Cash & Expenses / Reports), including the `Manage
   Categories`/`Manage Units` modal actions instead of standalone sidebar items.
9. **`InventoryModuleView.tsx`.** Mirror `AdmissionModuleView.tsx`'s switch-on-`moduleId` pattern;
   wire it into `App.tsx`'s `currentPortal === 'inventory'` branch (currently missing entirely).
10. **Rebuild `InventoryDashboard.tsx` against real data.** Delete every hardcoded array, call
    `inventoryApiService` (extended in steps 1–7) for every KPI/panel in §3. Nothing fabricated —
    an unimplemented figure is an empty state, never a placeholder number.
11. **Stock Overview + Stock Movement Center.** Stock Overview table/filters/`+ Add Item` +
    Manage Categories/Units drawers (step 1, 8); the 5-tab Stock Movement Center (Stock In,
    Department Issue, Department Return, Supplier Return, Adjustment) with their forms from §4.2,
    each tab wired to its step-3/4/5 endpoint.
12. **Supplier Directory + Supplier Ledger.** Two screens per §5, ledger formula wired to real
    `SupplierLedger` rows.
13. **Cash & Expenses — three separate view files**, mirroring Front Desk's own layout exactly:
    `features/inventory/cashExpenses/PettyCashExpensesView.tsx` (2 internal tabs: Petty Cash
    Received / Inventory Expenses, step 6), `features/inventory/cashExpenses/MyBalanceSheetView.tsx`
    (own file, like `features/frontDesk/billing/MyBalanceSheetView.tsx`), and
    `features/inventory/cashExpenses/MyAccountSettlementView.tsx` (own file, like
    `features/frontDesk/settlement/MyAccountSettlementView.tsx`) — the latter two calling the
    now-fixed (step 2) `/cash/balance-sheet` and `/cash/settlements` endpoints. Not one combined
    page with stacked sections.
14. **Inventory Reports** — its own `features/inventory/reports/InventoryReportsView.tsx`, styled
    like `features/frontDesk/reports/FrontDeskBillingReportsView.tsx`: report-type selector/tabs +
    filters + Excel/PDF/Print, wired to step 7's 8 reports.

### Close-out (15)
15. **Real browser click-through of the whole portal, every screen, every button**, logged in as
    an Inventory Management user end to end — not just `tsc`/tests passing. This is where UI-
    reachability and stale-state bugs actually surface (the same class of gap every other portal's
    status log in this repo has found late) — don't call Inventory "done" without it.

**No mock data, no hardcoded numbers, no fabricated actor names anywhere in new/rebuilt Inventory
code** — same standard already applied to the Balance Sheet & Account Settlement work. Every figure
must trace to a real Prisma row and the actual logged-in `portalUserId`.
