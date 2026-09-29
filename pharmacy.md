# Standalone Pharmacy — Final Structure & Working Context

> Source: `Pharmacy_Software_Corrected_Final_Structure_with_HMS_Integration_Recreated.pdf` (repo root)
> — this is the **"Corrected Final Structure"** and **supersedes** the older 3-portal design in
> `07 Standalone Pharmacy Master and HMS Integration.pdf` / `08 Pharmacy Super Admin Portal.pdf` /
> `09 Pharmacy Manager Portal.pdf` / `10 Pharmacy Sales Dispensing Staff Portal.pdf` (`pdfs
> resources/Hospital Managment System/`, referenced as D07–D10 in `PROJECT_MASTER_SPEC.md`).
> Cross-check against `PROJECT_MASTER_SPEC.md` §1/§4.10/roles table (original functional rules,
> HMS↔Pharmacy boundary) and `inventory.md` (the sibling General Inventory doc — same conventions,
> and the two share one real backend bug, see §19.3 below) before building.

**The correction, in one line:** D07–D10 designed **three separate Pharmacy portals** (Super Admin /
Manager / Sales). This PDF collapses Super Admin + Manager into **one shared Management Portal**
with permission-based differences, keeping only **Sales as its own portal**. The backend role name
stays `PHARMACY_MANAGER` — this doc uses **"Admin"** to mean that same role, matching the PDF's own
wording, so don't rename the enum, just treat Manager as this PDF's "Admin".

---

## 1. The One Rule Everything Else Follows

**Do not build three portals. Build two.** Super Admin and Admin (`PHARMACY_MANAGER`) share the
exact same Management Portal screens — render one UI, hide/disable only role-restricted actions
(e.g. Super Admin sees `+ Add Admin`, Admin sees `+ Add Sales User`). Sales/Cashier staff get a
separate, deliberately narrow Sales Portal: POS, HMS fulfillment, allowed returns, own cash control.

**Audit Rule (non-negotiable, every screen):** every POS sale, HMS fulfillment, purchase, vendor
payment, expense, return, stock adjustment, petty cash transaction and settlement must store and
display the **actual user who performed it** — Name + Role + Source Portal/Module + Date/Time. A
transaction must never render as only "Pharmacy" or "Admin".

**Main Daily Flow:** Dashboard → HMS Request Queue (accept/dispense) / POS (walk-in sale) → Purchase
/ Stock In → Vendor Ledger/Payments → Record Expense → My Balance Sheet → Account Settlement.

---

## 2. Final Portal Architecture

| Portal | Who Uses It | Main Difference |
|---|---|---|
| **Management Portal** | Super Admin + Admin (`PHARMACY_MANAGER`) | Same operational screens. Super Admin manages Admin accounts + protected/root oversight. Admin manages Sales users + normal operations. |
| **Sales Portal** | Sales / Cashier (`PHARMACY_SALES_DISPENSING`) | POS, HMS request fulfillment, allowed returns, receipts, own Balance Sheet, own Account Settlement, own reports. |

### 2.1 Role Difference Inside the Same Management Portal

| Capability | Super Admin | Admin |
|---|---|---|
| Dashboard / POS / Stock / Purchase / Vendors | Yes | Yes |
| Vendor Ledger / Payments | Yes | Yes |
| Expenses / Petty Cash / Settlements | Yes | Yes |
| Operational Reports | Yes — full scope | Yes — normal management scope |
| Create Admin Account | Yes | No |
| Create Sales Account | No — Admin does this | Yes |
| Change Protected Super Admin | Protected/root governance only | No |
| Security / Admin Account Audit | Full | Normal operational visibility only |

**Today's backend gap:** `authorize.ts` gives `PHARMACY_SUPER_ADMIN` and `PHARMACY_MANAGER`
**identical** permissions (both `fullAccess` on `pharmacy`/`pharmacy-bridge`, `cash: view+create`) —
none of this table's Super-Admin-only restrictions exist yet. See §19.1.

---

## 3. Management Portal — Final Sidebar

| Group | Screens / Tabs | Purpose |
|---|---|---|
| Dashboard | Pharmacy Dashboard | Sales, profit, purchases, stock, expiry, vendor payable, cash, settlement overview. |
| POS & Sales | Sales Overview; Returns/Voids | Monitor sales, payments, discounts, controlled reversals. |
| HMS Requests | Hospital Request Queue | Receive and fulfill medicine requests from HMS. |
| Medicines & Stock | Medicine Stock Overview; Batch/Expiry; Stock Movement | Medicine master, live batches, expiry, low/out stock, audited movements. |
| Purchases | Purchase / Stock In; Purchase Return | Receive medicines from vendors, return purchase stock. |
| Vendors | Vendor Directory; Vendor Ledger | Vendor master + separate financial running ledger. |
| Cash & Expenses | Petty Cash; Expenses; Balance Sheet; Account Settlement | Cash control and operating expenses. |
| Users | Role-aware Account Management | Super Admin → Admin accounts. Admin → Sales accounts. |
| Reports | Pharmacy Reports | One consolidated reporting center. |
| Settings | Pharmacy Settings | Tax/discount, receipt, stock/expiry, high-value approval, policies. |

## 4. Sales Portal — Final Sidebar

| Group | Screens | Purpose |
|---|---|---|
| Dashboard | Sales Dashboard | My sales, cash/card/online, HMS requests, returns, expected cash. |
| POS | New Sale | Direct pharmacy sale. |
| HMS Requests | Request Queue | Fulfill hospital medicine requests. |
| Returns | Sales Return | Controlled return/refund against original sale. |
| Cash Control | My Balance Sheet; My Account Settlement | Own cash and handover. |
| Reports | My Sales Reports | Own sales, collections, returns, settlement reports. |

**Sales User Restriction:** cannot create users, vendors, medicine masters, purchase stock, or
manually change quantity. Works only through POS, HMS fulfillment, authorized returns, own cash
control — already matches today's `PHARMACY_SALES_DISPENSING` backend permissions (view/create
only, no edit, no user/vendor/purchase routes exist for it to touch anyway).

---

## 5. Management Dashboard — KPI Cards

| KPI Card | Meaning | Click Through |
|---|---|---|
| Sales Today | Net pharmacy sales today. | Sales Overview. |
| Gross Profit Today | Net sales − cost of sold medicines. | Sales/Profit report. |
| Purchases Today | Posted purchase count and value. | Purchases. |
| Current Stock Value | Valuation of available stock. | Stock Overview. |
| Low Stock | Medicines at/below reorder level. | Filtered Stock. |
| Out of Stock | Medicines with zero available qty. | Filtered Stock. |
| Near Expiry | Batches within configured expiry window. | Batch/Expiry. |
| Expired / Quarantine | Blocked/non-saleable batches. | Batch/Expiry. |
| Vendor Payable | Current total payable to vendors. | Vendor Ledger. |
| Pending HMS Requests | Hospital requests waiting for action. | HMS Request Queue. |
| Pending Settlements | Sales/Admin settlements awaiting review. | Account Settlement. |
| Expected Cash | Cash position for current logged-in cash handler. | Balance Sheet. |

**Quick actions:** `+ New Purchase` · `+ Add Medicine` · `+ Add Vendor` · `Pay Vendor` · `HMS
Requests` · `+ Expense` · `Issue Petty Cash` · `My Balance Sheet`.

### 5.1 Sales Dashboard (Sales Portal)

| Card | Shows |
|---|---|
| My Sales Today | Own net sales. |
| Cash Collection | Physical cash collected. |
| Card / Online | Non-cash collection. |
| Returns / Refunds | Own approved returns/refunds. |
| Pending HMS Requests | Medicine requests waiting to be fulfilled. |
| My Expected Cash | System expected physical cash. |
| Low / Out Stock Alerts | Read-only stock alerts. |
| Recent Transactions | Latest sale/request/refund activity. |

---

## 6. POS — Direct Pharmacy Sale

| Area | Working |
|---|---|
| Customer / Patient | Optional direct customer or linked HMS patient/admission reference. |
| Search / Barcode | Search by medicine name/code or scan barcode. |
| Batch | System selects valid FEFO batch; authorized override requires reason. |
| Sale Line | Medicine, batch, expiry, qty, sale rate, discount, tax if enabled, line net. |
| Validation | Cannot sell above available qty. Expired/quarantined stock blocked. |
| Totals | Gross → Discount → Tax → Net Payable. |
| Payment | Cash / Card-POS / Online-Bank; split payment only if enabled. |
| Receipt | Invoice no, cashier, patient/customer, lines, totals, method, date/time. |
| Buttons | `Hold Sale` \| `Complete Sale` \| `Complete & Print` \| `Clear Cart`. |

### 6.1 Direct POS Amount Calculation

| Calculation | Formula |
|---|---|
| Line Gross | Qty × Sale Price. |
| Line Discount | Fixed or percentage if user/policy permits. |
| Line Net Before Tax | Line Gross − Line Discount. |
| Line Tax | Configured tax on taxable amount. |
| Invoice Net | Sum of line net + tax − invoice-level approved discount, if enabled. |
| Paid | Sum of valid Cash/Card/Online payments. |
| Outstanding | Invoice Net − Valid Paid + Valid Refund/Reversal effect. |

**Today's gap (§19.2):** `pharmacy.service.ts dispenseRetail` has no barcode field, no invoice-level
discount, no tax at all, no payment method/split capture — every sale is hardcoded
`paidTotal: total, status: 'PAID'` in cash, so "Outstanding" as a concept doesn't exist yet for
retail POS.

---

## 7. Hospital Management System Integration

**Integration Boundary:** Hospital and Pharmacy remain separate systems/financial streams. HMS
sends medicine requests; Pharmacy fulfills from its own stock and produces a **separate** Pharmacy
invoice/clearance status. Pharmacy never merges its bill into the Hospital Bill.

### 7.1 HMS → Pharmacy Request Flow

| Step | HMS / Hospital Side | Pharmacy Side |
|---|---|---|
| 1 | Admission/authorized clinical workflow creates medicine request. | Request appears as Pending HMS Request. |
| 2 | Sends Admission/Encounter Ref, patient snapshot, medicine, qty, urgency, requester. | Validate medicine, batch, expiry and stock. |
| 3 | If high-value rule applies, request carries/awaits required approval. | Block dispense until configured approval is satisfied. |
| 4 | Waits for response. | **Accept Full / Accept Partial / Reject** with reason. |
| 5 | — | Dispense actual qty; post Stock OUT from exact batch. |
| 6 | Receives status and dispensed qty. | Create/update separate Pharmacy Invoice. |
| 7 | Receives Pharmacy amount/due/clearance summary. | Collect Pharmacy payment or mark approved credit/panel status per policy. |
| 8 | Admission sees Pharmacy clearance separately from Hospital clearance. | Return final request/invoice/payment/clearance status to HMS. |

**Today's gap (§19.2):** `pharmacy-bridge.service.ts fulfillAndDispense` skips steps 3–4 entirely —
there is no Accept/Partial/Reject decision point and no high-value approval gate; every request goes
straight from `REQUESTED` to fully dispensed. It also hardcodes `status: 'PAID', paidTotal: subtotal`
— no real payment collection step — so clearance today is driven by "all lines dispensed", not by
"outstanding is zero" as §9 below requires. This is the single biggest behavioural gap vs. the PDF.

### 7.2 HMS Request Queue — UI

| Area | What appears |
|---|---|
| Top Filters | From/To, Status, Admission No, Patient, Medicine, Urgency, Approval Status. |
| Summary Cards | Pending, Approved to Dispense, Partial, Fulfilled, Rejected, High-Value Approval Pending. |
| Table | Request Ref, Admission No, Patient, Medicine, Requested Qty, Dispensed Qty, Urgency, Requested By, Status, Age/Wait Time. |
| Row Actions | View Request \| Accept \| Partial Fulfill \| Reject \| Open Pharmacy Invoice. |
| Fulfillment Buttons | Accept & Dispense \| Partial Fulfill \| Reject \| Print Issue/Invoice. |

### 7.3 High-Value Medicine Approval

| Rule | Behaviour |
|---|---|
| Threshold | Configured by Management/Super Admin settings; not hardcoded. |
| Basis | Per medicine line or request/invoice amount, per policy. |
| Applies To | Normal/Self-Pay and Panel cases as configured. |
| Approval | Attendant/management approval logic configurable. |
| Fulfillment | Dispense blocked while required approval is pending. |
| Audit | Requested By, Approved By, Approval Time, evidence/reference retained. |

**Today: none of this exists** — no threshold setting, no approval gate, no audit trail for it.

---

## 8. Pharmacy Invoice & Payment Calculation for HMS Requests

**Separate Bill:** for an inpatient/HMS request, Pharmacy creates a separate Pharmacy Invoice.
Hospital Bill and Pharmacy Bill stay separate. HMS receives only the linked invoice summary +
clearance status needed for discharge.

| Item | Calculation / Rule |
|---|---|
| Dispensed Line Gross | Actual Dispensed Qty × Pharmacy Sale Price. |
| Line Discount | Only approved/configured pharmacy discount. |
| Tax | Configured pharmacy tax, if applicable. |
| Pharmacy Subtotal | Sum of valid dispensed line amounts. |
| Returns / Credits | Eligible approved medicine returns reduce Pharmacy amount. |
| Net Pharmacy Bill | Subtotal − Approved Discounts + Tax − Valid Credits/Returns. |
| Payments | Cash/Card/Online collected by Pharmacy Sales user. |
| Pharmacy Outstanding | Net Pharmacy Bill − Valid Pharmacy Payments. |
| Clearance | `CLEARED` when outstanding is zero, or `APPROVED CREDIT/PANEL` when authorized policy allows. |

**What HMS receives back:** Request Status + Dispensed Qty + Pharmacy Invoice No + Pharmacy Net
Amount + Paid Amount + Pharmacy Outstanding + Clearance Status + actual Pharmacy `Dispensed By`
user. HMS never receives Pharmacy's cashier ledger internals.

---

## 9. Medicines, Batches, Expiry & Stock

| Area | Fields / Rules |
|---|---|
| Medicine Master | Code/Barcode, Name, Generic/Brand, Category, Unit/Pack, Reorder Level, Default Sale Price, Tax, Active Status. |
| Batch | Batch No, Expiry Date, Purchase Cost, Sale Price snapshot/default, Received Qty, Available Qty. |
| FEFO | Nearest valid expiry issued/sold first. |
| Low Stock | Available Qty ≤ Reorder Level. |
| Out of Stock | Available Qty = 0. |
| Near Expiry | Within configured 30/60/90 or custom window. |
| Expired | Cannot sell/dispense. |
| Quarantine | Not available for sale/dispense. |
| Quantity Rule | Never directly edit current qty — derive from posted stock movements. |

### 9.1 Stock Movement Types

| Movement | Effect |
|---|---|
| PURCHASE IN | Stock increases from posted purchase/GRN. |
| POS SALE OUT | Stock decreases on completed direct sale. |
| HMS DISPENSE OUT | Stock decreases on completed HMS fulfillment. |
| SALES RETURN IN | Eligible usable return increases stock. |
| PURCHASE RETURN OUT | Stock decreases when returned to vendor. |
| POSITIVE / NEGATIVE ADJUSTMENT | Approved count correction, damage, expiry write-off, loss, surplus, quarantine. |
| OPENING STOCK | Authorized migration/setup only. |

**Already matches reasonably well (§19.1):** `MedicineMaster`, `MedicineBatch`,
`MedicineStockLedger` (append-only delta, correct pattern) exist; FEFO allocation
(`allocateFefoBatches`, earliest-expiry-first, skips expired/zero-stock batches) is implemented and
shared by both POS and HMS dispense. **Missing:** Reorder Level field, barcode field, Low
Stock/Near-Expiry/Quarantine status derivation, Purchase Return / Sales Return / Adjustment /
Opening Stock movement types (only `RECEIPT`, `DISPENSE`, `SALE` exist today).

---

## 10. Purchases & Vendor Management

### 10.1 Purchase / Stock In
| Form Area | Fields / Buttons |
|---|---|
| Header | Vendor, Purchase Date, Vendor Invoice No, Payment Type: Cash/Bank/Credit, Notes. |
| Medicine Grid | Medicine, Batch, Expiry, Qty, Unit Cost, Discount/Tax, Line Total. |
| Finance | Purchase Total, Paid Now, Vendor Due. |
| Attachment | Vendor invoice/bill. |
| Buttons | `Save Draft` \| `Post Purchase` \| `Post & Print GRN` \| `Cancel`. |

### 10.2 Vendor Directory
`+ Add Vendor` \| Export \| Print. Filters: Search, Active/Inactive, Payment Terms. Table: Code,
Name, Contact, Phone, Terms, Current Due, Status. Actions: View, Edit, Open Ledger, New Purchase,
Pay Vendor.

### 10.3 Vendor Ledger — Separate Financial Screen
Header: Vendor, contact, payment terms, Current Payable/Advance. Buttons: `Pay Vendor` \| `Purchase
Return` \| `Approved Adjustment` \| `Print Statement` \| PDF \| Excel. Filters: From/To, Transaction
Type. Ledger columns: Date, Ref, Type, Description, Purchase, Payment, Return/Credit, Adjustment,
Running Balance, Actor.
**Formula:** `Opening + Purchases − Payments − Returns/Credits ± Adjustments = Closing`.

**Today: none of this exists.** No Vendor/Supplier model scoped to Pharmacy, no Purchase/GRN
endpoint, no Vendor Ledger. `receiveBatchStock` exists but only posts a stock-in ledger row with an
optional free-text `referenceInvoice` string — no vendor relationship, no cost/due tracking at all.
Note: Pharmacy's vendor system must stay independent of Inventory's `Supplier`/`SupplierLedger`
models (`inventory.md` §7.2 / schema comment "Domain F/G are deliberately non-intersecting") — build
a parallel `PharmacyVendor`/`PharmacyVendorLedger`, never reuse Inventory's.

---

## 11. Petty Cash, Balance Sheet & Settlement

### 11.1 Petty Cash Flow
| From | To | Effect |
|---|---|---|
| Super Admin / Management | Admin | Optional opening/petty cash for management operations. |
| Admin | Sales User | Opening/petty cash for Sales shift/POS. |
| Sales User | Admin | Physical cash handover through Account Settlement. |
| Admin | Management / Super Admin | Optional upper-level settlement per policy. |

### 11.2 Sales Balance Sheet
| Item | Meaning |
|---|---|
| Opening / Carry | Approved opening cash. |
| Petty Cash Received | Cash received from Admin. |
| Cash POS Sales | Physical cash from direct sales. |
| Cash HMS Payments | Physical cash collected against Pharmacy invoices for HMS requests. |
| Cash Refunds | Approved physical cash refunds. |
| Expected Cash | System-calculated amount. |
| Physical Cash | User counted amount. |
| Variance | Physical − Expected. |
| Settlement | Cash handed to Admin. |
| Remaining | Approved retained cash. |

**Sales Expected Cash formula:** `Opening/Carry + Petty Cash Received + Cash POS Sales + Cash HMS
Payments + Approved Cash In − Cash Refunds − Previous Accepted Settlements ± approved cash
adjustments.`

**Today (§19.3, confirmed — this is the exact bug `inventory.md` flagged as "unverified" for
Pharmacy; it is now confirmed):** `pharmacy.service.ts` already writes correct
`UserCashBalance{ moduleScope: 'PHARMACY' }` rows on every POS sale. But `cash.service.ts` /
`settlement.service.ts` are **hardcoded to `moduleScope: 'BILLING'`** in every read query — so a
Pharmacy user hitting `GET /cash/balance-sheet` today gets **Billing-scoped data** (effectively
empty), not their real Pharmacy cash position. This is the exact same bug documented in
`inventory.md` §7.3 — **one fix (make `cash.service.ts`/`settlement.service.ts` resolve
`moduleScope` from the requesting user's role) unblocks both Inventory's and Pharmacy's Balance
Sheet/Settlement at once.** Do this fix once, not twice.

---

## 12. Expenses

| Field | Rule |
|---|---|
| Category | Configurable expense category. |
| Date | Required. |
| Amount | Required. |
| Payment Method | Cash / Bank / Online. |
| Payee / Vendor | Optional. |
| Description / Reference | Required. |
| Attachment | Optional receipt. |
| Entered By | Actual logged-in user. |
| Approved By | If configured approval applies. |
| Buttons | `Save Expense` \| `Save & Add Another` \| `Cancel`. |

**Expense Audit:** reports must always show who entered, who approved (if any), source
portal/module, payment method, date/time, reference. A cash expense affects the entering user's
expected physical cash.

**Today:** the generic `Expense` Prisma model exists (shared with Inventory/Billing, per
`inventory.md` §7.2) but no route/service exposes a Pharmacy-scoped "New Expense" flow tied to the
logged-in Pharmacy user's cash balance.

---

## 13. User Management — Corrected

| Logged-in Role | What account can be created? | Main Buttons |
|---|---|---|
| Super Admin (`PHARMACY_SUPER_ADMIN`) | Admin accounts only | `+ Add Admin` \| Reset Password \| Activate/Deactivate \| View Last Login \| View Security Activity |
| Admin (`PHARMACY_MANAGER`) | Sales accounts only | `+ Add Sales User` \| Reset Password \| Activate/Deactivate \| Restrict/Enable Login \| View Last Login |
| Sales (`PHARMACY_SALES_DISPENSING`) | None | No user management |

**Today: not implemented at all.** No Pharmacy-scoped user-creation endpoint exists (Pharmacy portal
accounts, if any exist today, would go through the generic Portal User system with no
Super-Admin-creates-Admin / Admin-creates-Sales governance layer). This is new work, not a fix.

---

## 14. Reporting — Actor Attribution is Mandatory

**Every Report Row Must Answer: WHO DID IT?** Never render a transaction as only "Pharmacy" or
"Admin" — show the real user. Recommended fields: Created By, Sold By, Collected By, Dispensed By,
Entered By, Paid By, Refunded By, Adjusted By, Approved By, Settled By, as applicable — plus Role +
Source Portal/Module + timestamp.

### 14.1 Consolidated Management Reports
| Report | Main Data | Actor Fields |
|---|---|---|
| Sales & Collection | Invoice, patient/customer, gross, discount, net, method, paid/outstanding. | Sold By, Collected By. |
| HMS Request / Dispense | Request, admission, medicine, requested/dispensed qty, invoice, due/clearance. | Requested By (from HMS), Dispensed By (Pharmacy). |
| Purchase | GRN, vendor, batch, expiry, qty, cost, paid/due. | Received/Entered By, Paid By. |
| Stock Movement | Movement type, medicine, batch, qty in/out, balance. | Performed By, Approved By if adjustment. |
| Vendor Ledger | Purchase, payment, credit/return, running payable. | Created By / Paid By / Adjusted By. |
| Expense | Category, amount, method, description, status. | Entered By, Approved By. |
| Return / Refund | Original sale/purchase ref, qty/value, reason. | Processed/Refunded By, Approved By. |
| Balance / Settlement | Expected, physical, variance, submitted, accepted, remaining. | Submitted By, Reviewed/Accepted By. |

### 14.2 Common Report Filters
Time (From/To, Today/This Month/Custom) · User (Name, Role, Portal/Module) · Sales (Payment Method,
Invoice Status, Return Status) · HMS (Admission No, Request Status, Approval Status, Clearance
Status) · Stock (Medicine, Category, Batch, Stock Status, Expiry Window) · Vendor (Vendor,
Transaction Type, Due Status) · Finance (Payment Method, Settlement Status, Expense Category).

**Today: zero Pharmacy reports exist** — no `src/modules/reports/pharmacy*.ts` module at all.

---

## 15. HMS ↔ Pharmacy Integration Data Contract

| Direction | Data |
|---|---|
| HMS → Pharmacy | Request Ref, Admission/Encounter Ref, patient display snapshot, Panel/Self-Pay indicator if required, medicine identifier, requested qty, urgency, requester, request timestamp, high-value approval reference/status when applicable. |
| Pharmacy → HMS | Request status, accepted/rejected/partial state, actual dispensed qty, Pharmacy Invoice No, Pharmacy Net Amount, Pharmacy Paid Amount, Pharmacy Outstanding, Pharmacy Clearance Status, dispense timestamp, actual Dispensed By user. |

HMS does **not** send Hospital cashier ledger, Hospital Balance Sheet, Hospital settlement internals.
Pharmacy does **not** send detailed vendor ledger, purchase cost ledger, full cashier balance sheet
to clinical screens.

**Source of Truth:** HMS owns Admission/Encounter/request identity. Pharmacy owns medicine stock,
batch/expiry, dispensed quantity, Pharmacy invoice, Pharmacy payments, Pharmacy clearance.

**Today:** `pharmacy-bridge` already implements the shape of this contract one-way (create request,
list, get by id, dispense) via `PharmacyClearance`/`PharmacyClearanceLine`/`PharmacyDispense` —
idempotent via `idempotencyKey` (good, matches `PROJECT_MASTER_SPEC.md` §"must be idempotent"
requirement) and it does correctly auto-clear `DualDischargeClearance{ clearanceType: 'PHARMACY' }`
once every request for an admission is dispensed. What's missing is everything in §7.1 steps 3–4 and
§8's payment-gated clearance (see §19.2).

---

## 16. End-to-End Example (target behaviour once built)

| Step | Example |
|---|---|
| 1 | Admission sends request: Admission A-102, Ceftriaxone 1g × 2, Urgent. |
| 2 | Pharmacy queue shows Pending. Sales user opens request. |
| 3 | System finds valid FEFO batch: Batch CTX-45, Expiry 2027-03, Available 20. |
| 4 | If high-value approval is required, fulfillment waits for approval. |
| 5 | Sales dispenses Qty 2. Stock OUT = 2 from CTX-45. |
| 6 | Sale price PKR 900 each → Gross PKR 1,800. Discount 0. Tax 0 → Pharmacy Net = PKR 1,800. |
| 7 | Patient pays PKR 1,000 Cash → Pharmacy Outstanding = PKR 800. |
| 8 | Sales user's Balance Sheet Cash HMS Payments increases by PKR 1,000. |
| 9 | Pharmacy returns to HMS: Dispensed 2, Invoice PH-0098, Net 1,800, Paid 1,000, Outstanding 800, Clearance = `OUTSTANDING`. |
| 10 | Later PKR 800 is paid → Outstanding 0 → Clearance = `CLEARED` → HMS receives updated status. |

Today's code would instead auto-dispense fully and mark `PAID`/full amount at step 5 with no
patient-payment step at all — steps 6–10 as written above are not yet possible.

---

## 17. Final Non-Negotiable Rules

| Rule | Decision |
|---|---|
| Super Admin/Admin architecture | Same Management Portal, role-based permissions. |
| User creation | Super Admin → Admin only. Admin → Sales only. |
| Actor attribution | Every action/report uses actual user name + role + portal/module + time. |
| HMS integration | Request in, fulfillment/invoice/clearance status out. |
| Financial separation | Hospital Bill and Pharmacy Bill remain separate. |
| Pharmacy payment | Collected/owned by Pharmacy; outstanding/clearance returned to HMS. |
| Batch/expiry | Mandatory where medicine is batch tracked; FEFO. |
| Expired stock | Blocked from sale/dispense. |
| Direct quantity edit | Not allowed. |
| Vendor Ledger | Separate dedicated financial ledger (own model, not Inventory's `Supplier`). |
| Cash control | User-wise Balance Sheet + Account Settlement. |
| Reports | Active filters + PDF/Excel/Print + actual actors. |

---

## 18. Frontend Reality Check (as of 2026-09-29)

- **The standalone `/pharmacy` portal route is explicitly disabled.** `App.tsx` (~L51–57) has a
  "Guard against obsolete removed routes" effect: any attempt to reach `currentPortal === 'pharmacy'`
  or a `/pharmacy` path is **immediately redirected away**. There is no `'pharmacy'` entry in
  `PORTAL_CONFIGS`. This is not a bug to fix — it's a deliberate prior removal that this rebuild must
  consciously reverse (new portal keys, new routes, new `PORTAL_CONFIGS` entries for both
  `pharmacy-management` and `pharmacy-sales`, or however the two portals get keyed).
- **`PHARMACY_NAV_GROUPS`** (`constants/portalNavigations.ts:402-444`) is explicitly commented
  `"Preserved standalone pharmacy navigation (isolated for future standalone pharmacy project)"` —
  a flat single-portal nav (Dashboard/Sales/Patient Medicines/Reports) with no Vendors, Purchases,
  Users, or Cash & Expenses groups at all. It is **not imported anywhere** (confirmed via repo-wide
  grep) — dead code. Needs full replacement with the two-portal structure in §3/§4.
- **`legacyPharmacy/PharmacyDashboard.tsx`** (299 lines) and **`dashboard/PharmacyDashboard.tsx`**
  (8 lines) are both **orphaned — imported nowhere in the app.** Whatever KPI/table content they
  contain was never wired to real data or even reachable; treat as reference-only or delete, don't
  build on top of them.
- **The only live Pharmacy-facing frontend today** is on the *Admission* side:
  `features/admission/PharmacyRequestsView.tsx` (196 lines) — lets Admission staff create/view HMS
  medicine requests via `pharmacyApiService`, plus a Super Admin summary nav item
  (`sa_inventory_pharmacy`, `pharmacy_integration`). No Pharmacy-staff-facing screen (POS, batch
  entry, vendor, cash) exists anywhere in the running app.
- **`pharmacyApiService.ts`** (117 lines) is a thin 1:1 wrapper over the 8 real backend endpoints —
  no more, no less. See §19.1 for the exact list.

---

## 19. Backend Reality Check (as of 2026-09-29)

### 19.1 Already exists and is a reasonable foundation
- **Roles** already correctly split 3 ways in the schema/`authorize.ts`: `PHARMACY_SUPER_ADMIN`,
  `PHARMACY_MANAGER` (= this doc's "Admin"), `PHARMACY_SALES_DISPENSING` — Sales already has the
  right restricted permission set (`pharmacy`/`pharmacy-bridge`: view+create only, no edit, no
  `cash` write beyond what Sales legitimately needs). **Gap:** Super Admin and Admin have
  **identical** permissions today — none of §2.1's Super-Admin-only restrictions (create Admin,
  protected-account governance, full security audit) exist.
- **`hms-backend/src/modules/pharmacy/`** (`pharmacy.service.ts` 386 lines +
  controller/routes/schemas): Medicine Master CRUD, Batch creation + stock receipt, FEFO batch
  allocation engine (`allocateFefoBatches` — earliest-expiry-first, skips expired/zero-stock,
  shared by both POS and HMS dispense — this part is solid), retail POS dispensing
  (`dispenseRetail`).
- **`hms-backend/src/modules/pharmacy-bridge/`** (`pharmacy-bridge.service.ts` 319 lines +
  controller/routes/schemas): idempotent HMS medicine request creation
  (`PharmacyClearance`/`PharmacyClearanceLine`), list/get requests, `fulfillAndDispense` — auto-FEFO,
  posts `MedicineStockLedger` OUT, auto-clears `DualDischargeClearance{PHARMACY}` when every request
  for an admission is dispensed.
- **Prisma models already in place:** `MedicineMaster`, `MedicineBatch`, `MedicineStockLedger`,
  `PharmacyClearance`, `PharmacyClearanceLine`, `PharmacyDispense` (+ lines), `CashModuleScope.PHARMACY`
  already in the shared cash enum.

### 19.2 The core behavioural gap vs. this PDF (biggest single piece of new work)
`fulfillAndDispense` and `dispenseRetail` both **skip the entire payment/approval layer**:
- No Accept / Partial Fulfill / Reject decision — every HMS request is fully auto-dispensed.
- No high-value approval threshold/gate anywhere.
- Every sale/dispense is hardcoded `status: 'PAID', paidTotal: <full amount>` — no actual
  Cash/Card/Online payment capture, no split payment, no partial payment, no real "Outstanding".
- No tax field/calculation anywhere (POS or HMS dispense) — only a flat per-line discount amount.
- HMS clearance today is driven by *"all lines dispensed"*, not by §8's *"outstanding is zero"* —
  these happen to coincide only because payment is currently fake-100%-collected at dispense time.

Fixing this is schema + service work on the existing `PharmacyClearance`/`PharmacyDispense` models
(add payment/outstanding/clearance-status fields and an Accept/Partial/Reject state machine), not a
rewrite of the FEFO/stock engine underneath it, which is already sound.

### 19.3 Missing entirely
- **No Vendor/Purchase module** for Pharmacy at all (§10) — no vendor model, no GRN/Purchase
  endpoint, no Vendor Ledger. `receiveBatchStock` only posts a bare stock-in ledger row with a
  free-text invoice reference, no vendor relationship or cost/due tracking.
- **No Purchase Return, Sales Return, or Adjustment movement types wired up** — `MedicineStockLedger`
  only ever writes `RECEIPT`, `DISPENSE`, `SALE` today; the movement types in §9.1 beyond those
  don't exist as write paths.
- **No Expense flow scoped to Pharmacy** (§12) — generic `Expense` model exists, unwired.
- **Balance Sheet / Account Settlement read-path bug — confirmed, shared with Inventory.**
  `pharmacy.service.ts` already writes correct `UserCashBalance{moduleScope:'PHARMACY'}` rows on
  every sale. But `cash.service.ts`/`settlement.service.ts` (`hms-backend/src/modules/cash/`) are
  **hardcoded to `moduleScope: 'BILLING'`** on every read (`cash.service.ts:44`,
  `settlement.service.ts:42,83`) — a Pharmacy user's `GET /cash/balance-sheet` today silently
  returns Billing's (empty) data instead of their own. `inventory.md` §7.3 flagged this as an
  "unverified observation" for Pharmacy; **this pass confirms it as a real, present bug.** One fix
  resolves it for both Inventory and Pharmacy — don't fix it twice, don't fix it Pharmacy-only.
- **No Pharmacy user-management endpoints** (§13) — no Super-Admin-creates-Admin /
  Admin-creates-Sales governance flow exists for Pharmacy portal accounts.
- **No Pharmacy Reports module** (§14) — no `reports/pharmacy*.ts` at all.
- **No Settings endpoint** for tax/discount/receipt/stock-expiry/high-value-approval policy (§3's
  Settings screen, referenced throughout as "configured, not hardcoded" — currently nothing is
  configurable, because nothing reads a settings table for Pharmacy).

---

## 20. Step-by-Step Build Plan (22 steps, backend-first)

Backend before frontend, so no screen is ever built against an endpoint that doesn't exist — same
discipline as `inventory.md` §9. Each step is independently shippable and testable. **No mock data,
no hardcoded numbers, no fabricated actor names anywhere in new/rebuilt Pharmacy code.**

### Step 0 — decide portal re-enablement shape before writing any code
Confirm with the team how the two portals should be keyed/routed (`pharmacy-management` +
`pharmacy-sales`, or one `pharmacy` portal with an internal role switch like §1's "render one UI,
hide restricted actions"). This determines the `PORTAL_CONFIGS` shape in step 12 — get it right once
rather than re-keying routes later. Delete or explicitly archive the orphaned
`legacyPharmacy/PharmacyDashboard.tsx` / `dashboard/PharmacyDashboard.tsx` once confirmed unused.

### Backend — shared fix first (1)
1. **Fix the `cash.service.ts`/`settlement.service.ts` `moduleScope: 'BILLING'` hardcode (§19.3).**
   Resolve scope from the requesting user's role/portal instead. Smallest, highest-leverage fix —
   unblocks Balance Sheet/Settlement for **both** Inventory and Pharmacy with one change. Do this
   before any Pharmacy cash-screen frontend work, otherwise you're building against known-broken data.

### Backend — payment/approval core (2–5)
2. **Schema: payment + clearance fields on `PharmacyDispense`/`PharmacyClearance`.** Add
   `paymentMethod` (CASH/CARD/ONLINE, nullable/split as needed), real `paidTotal` driven by actual
   payments (not auto-equal to `total`), `outstandingAmount` (computed or stored), and a
   `clearanceStatus` on `PharmacyClearance` distinct from dispense-completion (`OUTSTANDING` /
   `CLEARED` / `APPROVED_CREDIT`). Add a `PharmacyPayment` line-item model if multiple partial
   payments against one invoice must be tracked (mirrors `SalaryPayment` pattern already used
   elsewhere in this schema for `SalarySlip`).
3. **Accept / Partial Fulfill / Reject state machine for HMS requests.** Extend
   `PharmacyClearance.status` beyond today's `REQUESTED → DISPENSED` — add the decision step from
   §7.1 steps 3–4 before `fulfillAndDispense` runs; a Reject needs a mandatory reason, a Partial
   needs to leave the remainder requestable/trackable.
4. **High-value approval gate.** New Pharmacy Settings field for the threshold + basis (§7.3);
   block `fulfillAndDispense`/Accept until satisfied when the request/line crosses it; store
   Requested By / Approved By / Approval Time.
5. **Real payment collection on both dispense paths.** Rework `dispenseRetail` and
   `fulfillAndDispense` to accept actual payment method + amount (not auto-full-cash), compute
   `Pharmacy Outstanding` per §6.1/§8's formulas, and only flip `clearanceStatus` to `CLEARED` when
   outstanding reaches zero (or an authorized credit/panel policy applies) — this is the fix for
   §19.2's core gap. Add tax calculation (currently absent entirely) and invoice-level discount to
   both paths while touching this code.

### Backend — vendor & stock movements (6–9)
6. **`PharmacyVendor` + `PharmacyVendorLedger` models.** New, parallel to Inventory's `Supplier`/
   `SupplierLedger` but independent (§10, §19.3 note — do not reuse Inventory's tables). Directory
   CRUD + ledger read endpoint with the §10.3 running-balance formula.
7. **Purchase / Stock In endpoint.** Vendor + medicine grid + GRN posting → `MedicineStockLedger`
   `PURCHASE IN` (new movement type) + `PharmacyVendorLedger` `PURCHASE` entry + optional immediate
   payment. Follow the existing `receiveBatchStock`/Inventory `createPurchase` pattern for shape.
8. **Purchase Return + Sales Return endpoints.** Post the two missing movement types from §9.1,
   adjust vendor balance (purchase return) or restock usable qty (sales return, with a
   damaged/expired branch into quarantine — mirrors `inventory.md` step 3's Department Return
   pattern).
9. **Adjustment endpoint.** Damage/Expiry/Count Correction/Loss/Surplus/Quarantine, mandatory
   reason, optional approval, posts `POSITIVE_ADJUSTMENT`/`NEGATIVE_ADJUSTMENT`. Add Reorder
   Level to `MedicineMaster` and derive Low Stock/Near-Expiry/Quarantine status here rather than as
   stored booleans, matching the "derive from ledger, never store current qty" rule.

### Backend — cash, users, reports, settings (10–14)
10. **Petty Cash Received + Pharmacy Expense endpoints.** Wire the generic `Expense` model into a
    Pharmacy-scoped route (§12); confirm whether `UserCashBalance` already models "petty cash issued
    to this user" via `category`/`direction` before adding a new table (check the Inventory
    equivalent first — likely reusable as-is once step 1 lands).
11. **Pharmacy user-management endpoints (§13).** Super-Admin-creates-Admin, Admin-creates-Sales,
    with the protected-Super-Admin governance rule from §2.1 — this is genuinely new, not a fix; no
    existing endpoint does this split today for any portal's roles, so check how HMS's own Super
    Admin → Admin creation is implemented (`staffUsers`/Admin Users module) and mirror that pattern.
12. **Pharmacy Settings endpoint.** Tax/discount defaults, receipt config, stock/expiry windows,
    high-value approval threshold+basis — one settings row/table Pharmacy screens read instead of
    hardcoding any of these values (needed by steps 2–5 above; can be stubbed with sane defaults
    first and built out here, but do not let steps 2–5 hardcode values that belong here).
13. **Pharmacy Reports module (8 reports, §14.1).** One `reports/pharmacy.service.ts`, report-type
    param + shared date/entity/actor filters (§14.2) rather than 8 bespoke endpoints — same
    consolidation approach as `inventory.md` step 7.

### Frontend — portal shell (14–16)
14. **Re-enable Pharmacy portal routing (reverses §0/§18's guard).** Add `PORTAL_CONFIGS` entries per
    step 0's decision; remove/scope the `App.tsx` obsolete-route guard so it no longer redirects away
    from Pharmacy. Build `PharmacyManagementNavGroups` + `PharmacySalesNavGroups` replacing the dead
    `PHARMACY_NAV_GROUPS` with the §3/§4 structures.
15. **`PharmacyManagementModuleView.tsx` + `PharmacySalesModuleView.tsx`.** Mirror
    `AdmissionModuleView.tsx`'s switch-on-`moduleId` pattern (same as `inventory.md` step 9); wire
    into `App.tsx`'s portal branching.
16. **Pharmacy Management Dashboard, rebuilt against real data (§5).** Every KPI/panel/quick-action
    calls a real endpoint from steps 1–13. No hardcoded arrays — an unimplemented figure is an
    honest empty state.

### Frontend — Management Portal screens (17–20)
17. **HMS Request Queue UI (§7.2) + Pharmacy Invoice view (§8).** Filters, summary cards, table,
    Accept/Partial/Reject/View actions wired to steps 3–5; invoice view shows the full §8
    calculation including Outstanding/Clearance.
18. **Medicines & Stock: Stock Overview, Batch/Expiry, Stock Movement (5 tabs mirroring
    `inventory.md`'s Stock Movement Center pattern: Purchase In / POS Sale / HMS Dispense / Returns /
    Adjustment).** Wired to steps 6–9.
19. **Purchases + Vendor Directory + Vendor Ledger.** Per §10, wired to steps 6–8.
20. **Cash & Expenses (three separate view files, same discipline as `inventory.md` §6 —
    Petty Cash/Expenses, My Balance Sheet, My Account Settlement are not one page with stacked
    sections) + Users (role-aware, §13) + Reports (§14) + Settings (§12).**

### Frontend — Sales Portal + close-out (21–22)
21. **Sales Portal: Dashboard (§5.1), New Sale/POS (§6, rebuilt with real tax/discount/payment from
    step 5), HMS Request Queue (fulfillment view of step 17, Sales-permission-scoped), Sales Return,
    My Balance Sheet, My Account Settlement, My Sales Reports** — all Sales-user-restricted per §4's
    rule (no user/vendor/medicine-master/purchase-stock/manual-qty access).
22. **Real browser click-through of both portals, every screen, every button**, logged in as each of
    the three Pharmacy roles end to end — not just `tsc`/tests passing. Confirm the end-to-end
    example in §16 actually produces `OUTSTANDING` → `CLEARED` as described, and that HMS's own
    discharge screen correctly shows the separate Pharmacy clearance status. This is where
    UI-reachability and stale-state bugs actually surface — don't call Pharmacy "done" without it.
