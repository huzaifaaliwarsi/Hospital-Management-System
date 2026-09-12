# CH Sharif and Saeed Hospital — Hospital Management System + Standalone Pharmacy
## PROJECT MASTER SPECIFICATION

**Status:** Implementation-ready specification, consolidated from client-approved source documents (Source of Truth v6.3).
**Prepared for:** Project kickoff, Monday start.
**Consolidated by:** Claude Code, from 17 source PDFs supplied by the client/iSysware Software Solutions.
**Mandatory technology stack (imposed for this specification, see §6–§9):** Next.js + TypeScript (frontend) · Node.js + Express.js + TypeScript (backend) · PostgreSQL (database) · REST API · token/session authentication · separated frontend / backend-API / database deployment.

> **How to read this document.** Every requirement is tagged **[CONFIRMED]** (stated directly in a source PDF), **[ASSUMPTION]** (a reasonable default not stated in the source, needed to make the spec implementation-ready), or **[RECOMMENDATION]** (an engineering suggestion, not a client requirement). Source citations use the format `(Doc, p.N)` — see the Document Legend below. Nothing in this file was invented as a business rule; where the source was silent, the gap is listed in **§16 Open Questions** rather than filled with an invented rule.

---

## Document Legend (source PDFs analyzed)

| Code | File | Pages (extracted) | Role in the source pack |
|---|---|---|---|
| D01 | `01 Hospital Management System.pdf` | 5 | "Complete Project Master Blueprint" — top-level system map, v6.3 |
| D02 | `02 Super Admin Portal.pdf` | 3 | Super Admin portal functional blueprint |
| D03 | `03 Admin Portal.pdf` | 2 | Admin portal functional blueprint |
| D04 | `04 Front Desk Billing Portal.pdf` | 3 | Front Desk / Billing portal functional blueprint |
| D05 | `05 Admission Portal.pdf` | 2 | Admission portal functional blueprint |
| D06 | `06 Inventory Management Portal.pdf` | 3 | HMS (non-medicine) Inventory portal functional blueprint |
| D07 | `07 Standalone Pharmacy Master and HMS Integration.pdf` | 2 | Pharmacy system boundary + HMS↔Pharmacy integration |
| D08 | `08 Pharmacy Super Admin Portal.pdf` | 2 | Pharmacy Super Admin portal blueprint |
| D09 | `09 Pharmacy Manager Portal.pdf` | 2 | Pharmacy Manager portal blueprint |
| D10 | `10 Pharmacy Sales Dispensing Staff Portal.pdf` | 2 | Pharmacy Sales/Dispensing Staff portal blueprint |
| D11 | `11 Complete Workflow Architecture.pdf` | 3 | End-to-end cross-portal process list (15 flows) |
| D12 | `12 Worked Business Examples.pdf` | 3 | Worked numeric examples (8 examples) for QA/sign-off |
| D13 | `13 Architecture and Flow Diagrams.pdf` | 4 | Visual diagram captions (diagrams are graphical; captions extracted, imagery not OCR'd — see note below) |
| D14 | `14 Client Functional Walkthrough.pdf` | 3 | Short "meeting-friendly" walkthrough (13 points) |
| D15 | `15 Formulas and Calculation Rules.pdf` | 5 | Authoritative formula book — billing, cash, inventory, attendance, salary, commission |
| D16 | `16 Client.pdf` | 37 | **Primary source** — "Complete Functional, Financial, Workforce, Inventory and Integration Blueprint", full Client Functional Walkthrough & Solution Blueprint, v6.3 |
| D17 | `17 Portal Navigation Sections Buttons Forms.pdf` | ~19 | UI specification — sidebar navigation, sections, buttons, forms per portal |

**Extraction note:** All 17 files were text-based (not scanned images) and were extracted in full with `pdftotext -layout`. D13 ("Architecture and Flow Diagrams") is a visual diagram book; its diagram *captions* were extracted as text and are reflected in §5 workflows and the Mermaid diagrams below, but the diagram artwork itself was not visually inspected/OCR'd. No content in D13 appears to add business rules beyond what D01, D11, D12, D15, D16, D17 state in text — see **Document Coverage Checklist** at the end of this file.

All 17 documents describe **one coherent, non-contradictory architecture** ("Final Source of Truth v6.3", D16 p.1) authored by iSysware Software Solutions for **CH Sharif and Saeed Hospital (CHSS)**. There is a high degree of duplication by design (D01 = summary, D14 = short walkthrough, D16 = full walkthrough, D02–D10 = per-portal detail, D17 = per-portal UI detail, D11 = flows, D12 = worked numbers, D15 = formulas) — this master spec merges all of them into one non-duplicated reference.

---

## Table of Contents

1. Executive Summary
2. Project Scope
3. User Types, Roles, and Permissions
4. Complete Module Breakdown
5. End-to-End Workflows
6. PostgreSQL Database Design
7. Backend Architecture
8. REST API Specification
9. Frontend Architecture
10. Reporting and Analytics
11. Non-Functional Requirements
12. Testing Strategy
13. Deployment Architecture
14. Project Milestones
15. Monday Project-Start Plan
16. Risks, Conflicts, Assumptions, and Open Questions
17. Requirement Traceability Matrix
18. Document Coverage Checklist

---

## 1. Executive Summary

### 1.1 What the system is

CH Sharif and Saeed Hospital is commissioning a **connected hospital operations platform** consisting of two integrated but ownership-separated systems (D16 p.2–3; D14 p.1):

1. **Hospital Management System (HMS)** — five portals: **Super Admin, Admin, Front Desk/Billing, Admission, Inventory Management**.
2. **Standalone Pharmacy System** — a separate project with three portals: **Pharmacy Super Admin, Pharmacy Manager, Pharmacy Sales/Dispensing Staff**.

The two systems are connected through controlled, auditable hand-offs (medicine requests, dispense/clearance callbacks) rather than shared database ownership: HMS never owns medicine stock, and Pharmacy never owns hospital billing (D07 p.1–2; D16 p.14, p.35).

### 1.2 The business problem it solves **[CONFIRMED]**

CHSS currently lacks a system that gives **every cash-handling employee individual financial accountability**, keeps **medicine inventory and general hospital inventory from being conflated**, and cleanly separates **Salary** (attendance-driven) from **Doctor Commission** (service-driven) while keeping **hospital billing** and **pharmacy billing** as two independently clearable bills at discharge. The client's core design principle, stated verbatim: *"Every operational and financial action is attributed to the actual logged-in user: Collected By, Purchased By, Approved By, Dispensed By, Paid By, Settled By, Changed By, and similar accountability fields."* (D16 p.2)

### 1.3 Primary users **[CONFIRMED]**

| User group | Portal(s) | Source |
|---|---|---|
| Hospital governance / ownership | Super Admin | D02, D16 p.4 |
| Hospital-wide managers (non-founder) | Admin | D03, D16 p.5 |
| Front-desk/reception & cashiers | Front Desk / Billing | D04, D16 p.8 |
| Ward/inpatient coordinators | Admission | D05, D16 p.10–13 |
| Store/procurement staff (non-medicine) | Inventory Management | D06, D16 p.17–18 |
| Pharmacy governance | Pharmacy Super Admin | D08, D16 p.14 |
| Pharmacy stock/procurement manager | Pharmacy Manager | D09, D16 p.34–35 |
| Pharmacy counter/dispensing staff | Pharmacy Sales/Dispensing Staff | D10, D16 p.14 |
| All employees (HR record only, may have no login) | Staff Master (no portal) | D16 p.4, p.32 |
| (Future phase, out of current scope) | Staff/Doctor self-service portal | D16 p.32, p.17 |

### 1.4 Main operational workflows **[CONFIRMED]**

- Appointment booking → advance → check-in → OPD/Observation/Emergency encounter → invoice → payment → receipt (D16 p.8–9; D11 flow 3–4).
- Planned admission → advance request → Billing collects → bed assignment → active stay → running hospital bill → partial payments → medication mode (SELF/HOSPITAL MANAGED) → two-bill discharge (D16 p.10–13; D11 flow 5–9).
- Staff → shift → device attendance → review/approval → salary generation → payment (D16 p.19–20; D11 flow 1).
- Completed doctor service → commission accrual (independent of salary) → generation → approval → payment (D16 p.21; D11 flow 2).
- Inventory requirement → purchase request → approval/funding → purchase/receipt → stock ledger → supplier ledger → department issue (D16 p.17–18; D11 flow 10–11).
- HMS medicine request (HOSPITAL MANAGED only) → Pharmacy accept/partial/reject → FEFO batch dispense → Pharmacy invoice → clearance back to HMS (D16 p.14, p.24; D11 flow 8).
- Every cash-handling user: opening float → collections/spend → expected cash → physical count → settlement submission → management review/accept (D16 p.15–16; D11 flow 12–14; D15 §9–11).

### 1.5 Expected business outcomes **[CONFIRMED / RECOMMENDATION]**

- **[CONFIRMED]** Elimination of anonymous/shared cash drawers — every cash-handling user is individually accountable (D16 p.15).
- **[CONFIRMED]** No silent edits to posted financial, payroll, commission, or stock history — corrections are reversals/adjustments with full audit trail (D16 p.27; D15 §15).
- **[CONFIRMED]** Medicine stock is never duplicated between HMS and Pharmacy (D16 p.14, p.35).
- **[CONFIRMED]** Salary and Doctor Commission become fully independent, separately reportable liabilities (D16 p.20–21, p.26).
- **[RECOMMENDATION]** A single authentication/RBAC-governed platform reduces reconciliation effort at month-end close and improves auditability for future statutory/compliance reporting.

---

## 2. Project Scope

### 2.1 In-scope functionality **[CONFIRMED]**

| Domain | In scope | Source |
|---|---|---|
| Identity & Access | Staff Master, Portal Users (8 roles), Staff 360° profile, protected Super Admin governance | D16 p.4–5; D02 |
| Hospital Setup / Masters | Hospital Profile, Departments, Services & Rates, Wards/Rooms/Beds, Corporate Panels, Shifts & Attendance Policies, shared workforce/commission templates | D16 p.6; D17 p.4 |
| Front Desk / Billing | Appointment booking, walk-in/OPD/Observation/Emergency encounters, hospital invoicing, all hospital collections, discounts, refunds, outstanding, admission payment requests, cashier Balance Sheet & Settlement | D04; D16 p.8–9 |
| Admission | Planned admission, active admission, bed/ward/room management & transfers, running hospital bill, medication mode (SELF/HOSPITAL MANAGED) with audit history, hospital payment requests to Billing, medicine requests to Pharmacy, dual clearance & discharge | D05; D16 p.10–13 |
| HMS Inventory (non-medicine) | Item/Supplier masters, purchase requests, fund/petty-cash requests, purchase/receipt, Stock Ledger, Supplier Ledger, department issue/return, transfers, adjustments, reorder alerts, user Balance Sheet & Settlement | D06; D16 p.17–18 |
| Standalone Pharmacy | Medicine/Supplier masters, batch/expiry, purchase/receipt, Medicine Stock Ledger, Supplier Ledger, FEFO dispensing, store/counter transfers, returns, adjustments, HMS request handling, cash Balance Sheet & Settlement | D07–D10; D16 p.34–35 |
| Attendance & Payroll | Device/biometric adapter, raw punch normalization, attendance review/correction with audit trail, staff-specific Salary generation/approval/payment, Salary reporting | D16 p.19–20 |
| Doctor Commission | Staff/service-specific commission rules, accrual from completed services, generation/approval/payment independent of Salary | D16 p.21 |
| Universal Cash Accountability | Individual Balance Sheet + Account Settlement for every cash-handling user (Billing, funded Inventory, Pharmacy Sales/Dispensing) | D16 p.15–16 |
| Reporting | Hospital-wide + individual staff reports across every module, From/To date filters, PDF/Excel/Print export | D16 p.22; D02 p.2 |
| Patient identity model | Panel Patient (permanent, reusable) vs. Normal/Self-Pay (temporary case/booking identity) | D16 p.7 |

### 2.2 Out-of-scope functionality **[CONFIRMED]**

| Item | Evidence |
|---|---|
| A dedicated Staff/Doctor self-service portal | "No separate Staff Portal is active in the current scope." (D17 p.18) — Staff 360° profile is designed so a future portal can attach via `staffId` without duplicating records (D16 p.32). |
| Standalone Roles & Permissions, Login Activity, or Audit Log **pages** in HMS navigation | "No standalone Roles & Permissions, Login Activity or Audit Logs pages in HMS navigation." (D17 p.2) — see §16 Conflicts: this is a UI decision, not license to omit the underlying audit *data*. |
| Insurer claim submission workflow beyond panel discount + billing reports | "If insurer receivables/claim submission are required beyond panel discounts and billing reports, detailed workflow can be added." (D16 p.28) |
| Statutory payroll items (tax, loans, benefits) unless explicitly required | "Payroll statutory items — Tax, loans, statutory deductions or benefits if required in scope." (D16 p.28) — configuration decision pending client confirmation. |

### 2.3 Future-phase functionality **[CONFIRMED]**

| Item | Evidence |
|---|---|
| Staff/Doctor self-service portal reusing the same `staffId` (own profile, attendance, salary slips, commission statements) | D16 p.17, p.32; D17 p.18 |
| Expanded panel/insurer claim workflow | D16 p.28 |
| Additional statutory payroll items if the client's compliance scope grows | D16 p.28 |

### 2.4 External systems / hardware integrations **[CONFIRMED]**

| Integration | Detail | Source |
|---|---|---|
| Biometric/attendance device adapter | "Vendor-neutral and can later use API, SDK, LAN sync or file import." Final connection method is an open client decision. | D16 p.19, p.28 |
| Standalone Pharmacy ↔ HMS integration | Internal API-style hand-off: HMS creates a medicine request only in HOSPITAL MANAGED mode; Pharmacy Accepts/Partially Fulfills/Rejects, dispenses, bills, and returns clearance. Must be idempotent with stable Admission ID + Medicine Request ID + patient/case reference; failed states must stay visible and retryable, never silently marked complete. | D16 p.14; D07 p.1–2 |

### 2.5 Dependencies and constraints **[CONFIRMED / ASSUMPTION]**

- **[CONFIRMED]** Shared setup stores only reusable salary/commission *templates*; actual salary rate, deduction rules, and doctor commission rules are configured per Staff profile — this is a hard architectural constraint repeated in nearly every source document (D16 p.6, p.33; D01 p.1).
- **[CONFIRMED]** Currency precision/rounding is a system setting that must be applied identically across UI, PDF, Excel, and stored snapshots (D15 §15).
- **[CONFIRMED]** Every invoice/payroll/commission statement must snapshot the calculation inputs at generation time; later master-data changes must never rewrite historical documents (D15 §15).
- **[ASSUMPTION]** Single-hospital, single-currency (PKR, per D12 worked examples), single-timezone deployment for v1 — no source document mentions multi-branch or multi-currency requirements. Flagged in §16.
- **[ASSUMPTION]** English-only UI for v1 — no localization requirement is stated anywhere in the source pack.

---

## 3. User Types, Roles, and Permissions

### 3.1 Role model **[CONFIRMED]**

Two identity concepts are explicitly and repeatedly distinguished — this is one of the most load-bearing rules in the entire source pack and **must** be reflected as two separate database entities (§6.3 `staff` vs `portal_users`):

> *"Staff and system users are separate identities. Staff Master is the permanent employee/HR identity. Portal User is only login/access. A staff record may exist without a login; a portal account that belongs to an employee links to the same staffId."* (D01 p.2, verbatim; restated D16 p.4)

Eight portal roles exist across the two systems (D01 p.1; D16 p.1; D17 p.1):

| # | Role (system) | Portal | Protected? | Cash-handling? |
|---|---|---|---|---|
| 1 | `SUPER_ADMIN` (HMS) | Super Admin | Yes — highest protected account | Only if optionally assigned management cash |
| 2 | `ADMIN` (HMS) | Admin | No — but cannot alter Super Admin accounts | Only if optionally assigned management cash |
| 3 | `FRONT_DESK_BILLING` (HMS) | Front Desk / Billing | No | **Yes — always** |
| 4 | `ADMISSION` (HMS) | Admission | No | **No — never** (D16 p.15, "Admission is excluded because Admission never receives Hospital cash") |
| 5 | `INVENTORY_MANAGEMENT` (HMS) | Inventory Management | No | Yes, when funded with petty cash/advance |
| 6 | `PHARMACY_SUPER_ADMIN` (Pharmacy) | Pharmacy Super Admin | Yes — highest protected Pharmacy account | Only if optionally assigned |
| 7 | `PHARMACY_MANAGER` (Pharmacy) | Pharmacy Manager | No | Not directly (oversight only, per D09 "does not merge users into one cash drawer") |
| 8 | `PHARMACY_SALES_DISPENSING` (Pharmacy) | Pharmacy Sales/Dispensing Staff | No | **Yes — always** |

**[ASSUMPTION]** A ninth future role `STAFF_SELF_SERVICE` is reserved in the enum for the future Staff/Doctor portal (§2.3) but is **not implemented** in v1 — no screens, no endpoints. Adding it later must not require restructuring `staff`/`portal_users`.

### 3.2 Protected-account governance **[CONFIRMED]**

| Rule | Detail | Source |
|---|---|---|
| Super Admin self-protection | Cannot disable/delete the currently logged-in Super Admin; cannot remove the last active Super Admin account | D02 p.3 |
| Admin cannot touch Super Admin | Admin cannot create, modify, deactivate, delete, reset credentials of, demote, or otherwise alter a protected Super Admin account, and cannot use Admin credentials to enter the Super Admin portal | D03 p.1; D16 p.5 |
| Pharmacy Super Admin protection | "Highest protected management portal inside the standalone Pharmacy project" — same class of protection as HMS Super Admin, by direct structural analogy | D08 p.1 |
| Attribution | Every action stores the real logged-in actor identity — never a generic "Admin" label | D16 p.22 (repeated in nearly every portal doc) |

These are **backend-enforced authorization rules**, not just UI hiding (see §3.4).

### 3.3 Access-Control Matrix

Legend: **V**=View, **C**=Create, **E**=Edit, **D**=Delete/Deactivate, **A**=Approve, **X**=Export, **R**=Refund, **Vo**=Void/Reverse, **Cfg**=Configuration. "—" = no access. "Own" = restricted to records the user owns/created (data-scope restriction). All roles are additionally scoped to their own portal's modules unless marked "Oversight" (read-only cross-portal visibility).

| Module | Super Admin | Admin | Front Desk/Billing | Admission | Inventory Mgmt | Pharmacy Super Admin | Pharmacy Manager | Pharmacy Sales/Dispensing |
|---|---|---|---|---|---|---|---|---|
| Hospital Setup (Dept/Services/Wards/Panels) | V,C,E,D,Cfg | V,C,E,D,Cfg | — | V (read-only) | — | — | — | — |
| Admin Users (create Super Admin) | C,E,D | — (no create) | — | — | — | — | — | — |
| Admin Users (manage Admin) | C,E,D | V (self only) | — | — | — | — | — | — |
| Staff Master / Staff 360° | V,C,E,D | V,C,E,D | — | — | — | — | — | — |
| Shift & Attendance | V,C,E,A | V,C,E,A | — | — | — | — | — | — |
| Salary Payroll | V,C,A,Vo | V,C,A,Vo | — | — | — | — | — | — |
| Doctor Commission | V,C,A,Vo | V,C,A,Vo | — | — | — | — | — | — |
| Panel / Panel Patient Registry | V,C,E,Cfg | V,C,E,Cfg | V,C (register at intake) | V | — | — | — | — |
| Appointments | V (Oversight) | V (Oversight) | V,C,E,D | — | — | — | — | — |
| OPD/Observation/Emergency billing | V (Oversight) | V (Oversight) | V,C,E,R,Vo | — | — | — | — | — |
| Planned/Active Admission | V (Oversight) | V (Oversight) | — (payment only) | V,C,E | — | — | — | — |
| Bed/Ward/Room transfers | V (Oversight) | V (Oversight) | — | V,C,E | — | — | — | — |
| Medication Mode change | V (Oversight) | V (Oversight) | — | V,C,E | — | — | — | — |
| Admission → Billing payment request | V (Oversight) | V (Oversight) | V (fulfill) | V,C | — | — | — | — |
| Discharge & Clearances | V (Oversight) | V (Oversight) | V,A (Hospital Clearance) | V,C,A (Clinical/final) | — | V,A (Pharmacy Clearance) | V,A (Pharmacy Clearance) | — |
| Discounts (Hospital) | V,A | V,A | V,C,A\* | — | — | — | — | — |
| Refunds (Hospital) | V,A | V,A | V,C,A\* | — | — | — | — | — |
| Own Balance Sheet / Settlement | V (Oversight, review) | V (Oversight, review) | V,C (own) | — (excluded) | V,C (own) | V (Oversight, review) | V (Oversight, review if granted) | V,C (own) |
| Petty Cash / Fund issuance | V,C,A | V,C,A | — (recipient view) | — | — (recipient, requests) | V,C,A | — | — |
| Settlement review/accept | V,A | V,A | — | — | — | V,A | V,A (if granted) | — |
| HMS Inventory Masters/Ledgers | V (Oversight) | V (Oversight) | — | — | V,C,E,Cfg | — | — | — |
| Purchase/Fund requests (Inventory) | V,A | V,A | — | — | V,C | — | — | — |
| Pharmacy Masters/Ledgers | V (Oversight, integration status only) | V (Oversight) | — | — | — | V,C,E,Cfg | V,C,E | — |
| Pharmacy Purchases/Batches | — | — | — | — | — | V,A | V,C,E | — |
| HMS↔Pharmacy request handling | V (status only) | V (status only) | — | V,C (raise request) | — | V (Oversight) | V,A (accept/partial/reject) | V (fulfil, dispense) |
| Pharmacy Retail/HMS dispensing & invoice | — | — | — | — | — | V (Oversight) | V (Oversight) | V,C,R |
| Pharmacy returns/refunds | — | — | — | — | — | V,A | V,A | V,C (within permission) |
| Pharmacy Users management | — | — | — | — | — | V,C,E,D | — | — |
| System Settings | V,Cfg | V,Cfg (except protected items) | — | — | — | V,Cfg (Pharmacy scope) | — | — |
| Reports (module-scoped) | V,X (all) | V,X (all) | V,X (own module) | V,X (own module) | V,X (own module) | V,X (all Pharmacy) | V,X (Pharmacy inventory/ops) | V,X (own transactions) |

\* Discount/refund approval thresholds above a configured amount require Admin/Super Admin approval — see §16 Open Questions (approval thresholds not yet specified by client).

### 3.4 Frontend vs. backend enforcement **[CONFIRMED requirement, RECOMMENDATION for mechanism]**

**[CONFIRMED]** The source is explicit that permissions are not cosmetic: cash cannot be settled twice, Admission cannot touch cash, protected accounts cannot be alered by non-owners, and every action must be attributable to a real actor (D16 p.27, "Controls, Safeguards & Financial Integrity").

**[RECOMMENDATION — mandatory stack requirement]** Enforcement must exist at **both** layers with the backend as the source of truth:

- **Frontend (Next.js):** role- and permission-derived navigation/route guards hide inaccessible modules and disable/hide buttons the user cannot legally use (§9.7). This is a UX optimization only.
- **Backend (Express):** every route is protected by authentication middleware + an authorization middleware that checks the caller's role (and, where applicable, record ownership — e.g., "a cashier may only submit *their own* settlement", D16 p.16) against a declarative permission table, **independent of what the frontend sent**. A request that a UI would never allow to be built (e.g., Admin deleting a Super Admin) must still be rejected server-side with `403 Forbidden`.
- **[RECOMMENDATION]** Implement authorization as a declarative policy map (`role → module → action`) loaded once at boot, checked in a single reusable `authorize(module, action)` middleware, rather than ad hoc `if (role === ...)` checks scattered through controllers — this keeps the matrix in §3.3 as the single source of truth and testable in isolation (§12.4).

### 3.5 Data-scope restrictions **[CONFIRMED]**

| Restriction | Detail | Source |
|---|---|---|
| Settlement ownership | "Exact logged-in user submits their own settlement. One user cannot submit another user's money as their own." | D16 p.16 |
| Already-settled transactions | Cannot be included in another settlement | D16 p.16; D15 |
| Commission single-inclusion | "A service line can be included in only one generated commission statement, preventing duplicate payout." | D16 p.21 |
| Branch/department scope | **[ASSUMPTION]** No multi-branch requirement exists in the source (single-hospital deployment); department-level scoping exists only through module ownership (e.g., Inventory issues are scoped by receiving department), not through a user-to-branch restriction. Flagged in §16. |

---

## 4. Complete Module Breakdown

Each module below documents purpose, roles, screens, fields, validations, statuses, actions, business rules, calculations, approvals, notifications, reports, dependencies, edge cases, and acceptance criteria — derived from D02–D10 (portal blueprints), D16 (full walkthrough), D17 (UI spec), and D15 (formulas). Field lists are the client-specified minimum; **[ASSUMPTION]** marks fields added for implementation completeness that were not explicitly named but are structurally required (e.g., surrogate keys, timestamps).

### 4.1 Module: Identity, Staff Master & Portal Users

**Purpose [CONFIRMED]:** Maintain the permanent HR identity for every employee (Staff Master) separately from login/access (Portal User), linkable via `staffId`, with a unified "Staff 360°" profile view (D01 p.2; D16 p.4, p.32).

**Users/roles:** Super Admin, Admin (full CRUD on Staff & Admin Users); Pharmacy Super Admin (Pharmacy Users only). All other roles: no access to this module.

**Screens/pages [CONFIRMED, D17 p.2–4]:**
- Admin Users (list, Add Admin, Edit Admin, Reset Password, Suspend/Reactivate)
- Staff Users / Staff Master (list, Add Staff, Edit Staff, Import Excel, Export)
- Staff 360° Profile (tabs: Overview, Employment/Shift, Attendance, Salary, Commission, Portal Access, Notes/Documents)
- Pharmacy Users (Pharmacy Super Admin only — Add User, Edit, Reset Password, Suspend/Reactivate)

**Fields — Staff Master [CONFIRMED, D17 p.3; D16 p.4]:**

| Field | Type | Required | Notes |
|---|---|---|---|
| Employee ID | string (system-generated, unique) | Required | Displayed on Overview tab |
| Category | enum/lookup | Required | e.g., Doctor, Nurse, Technician, Reception, Billing, Admission, Inventory, Peon, Support |
| Department | FK → departments | Required | |
| Designation | string/lookup | Required | |
| Contact (phone/email) | string | Required (phone) / Optional (email) | |
| Joining Date | date | Required | |
| Employment status | enum (Active/Inactive/Terminated) | Required | |
| Shift assignment | FK → shifts, effective-dated | Required | Historical assignments retained |
| Salary basis/rate, deduction rules | staff-specific config | Optional (required if paid) | See §4.4 |
| Commission rules | staff-specific config | Optional (doctors/eligible staff) | See §4.5 |
| Portal access link | FK → portal_users, nullable | Optional | "No Portal Access" is a valid state |
| Notes/documents | free text / file attachments | Optional | **[ASSUMPTION]** file storage per §7.13 |

**Fields — Portal User [CONFIRMED, D17 p.3]:** Name, username/email, password (hashed — see §6.9), role, status (Active/Suspended), linked `staffId` (nullable), cash-handling flag **[ASSUMPTION]**, forced-password-reset flag **[ASSUMPTION]**.

**Validations [CONFIRMED + ASSUMPTION]:**
- Employee ID unique, system-generated (not user-entered) **[ASSUMPTION — format TBD, see §16]**.
- Username/email unique per portal user.
- A staff record is **not required** to have a portal account ("No Portal Access" valid state) — but a portal account (other than a future self-service login) **[ASSUMPTION]** is expected to link to a staff record for attribution consistency; this is not stated explicitly for operational roles (Front Desk, Admission, Inventory, Pharmacy staff) and is listed as an open question in §16.
- Password: never stored/transmitted in plaintext (mandatory stack requirement, §6.9).

**Statuses:** Staff: Active / Inactive / Terminated. Portal User: Active / Suspended.

**Actions [CONFIRMED, D17 p.3]:** Add, View, Edit, Activate/Deactivate, Reset Password, Suspend/Reactivate, Import Excel, Export, "View Portal Account" (from Staff record), Attendance Report, Salary Report, Commission Report (drill-down from Staff 360°).

**Business rules [CONFIRMED]:**
- Staff and Portal User are separate database records linked by `staffId`; **no duplicate staff record** is ever created for a linked login (D01 p.2; D17 p.3, "No duplicate staff form; uses Staff Add/Edit").
- Salary/commission rule *values* live on the Staff profile, never in global Setup (Setup stores only template types) (D16 p.6, p.33 — repeated 4×, the single most emphasized rule in the source pack).
- Any change to salary/deduction/commission terms preserves who changed it, when it became effective, and the previous value; already-paid periods are adjusted, never silently rewritten (D16 p.33).
- Admin cannot create/edit/deactivate/reset-password/demote a protected Super Admin account (§3.2).

**Notifications [ASSUMPTION — not explicitly specified, standard practice]:** New portal account created (credentials delivery out-of-band, not email-in-plaintext), password reset performed, account suspended.

**Reports [CONFIRMED, D16 p.22]:** Individual Staff Attendance, Salary, Commission, and employment/shift history reports; hospital-wide staff roster.

**Dependencies:** Departments, Shifts (§4.2 setup), Salary/Commission modules (§4.4, §4.5).

**Edge cases [CONFIRMED/ASSUMPTION]:**
- Staff exists with no portal login (peon with attendance/salary but no access) — must be fully supported, not a degraded state (D16 p.4, explicit example).
- Portal account suspended while staff remains Active (access revoked without terminating employment) — **[ASSUMPTION]**, structurally implied by separate status fields.
- Attempt to deactivate the last active Super Admin → blocked (§3.2).

**Acceptance criteria:**
- [ ] A staff record can be created with zero linked portal accounts and later linked without data loss.
- [ ] Salary/commission configuration entered on one Staff profile does not affect any other staff member.
- [ ] Admin's UI and API both reject any mutation targeting a Super Admin account with `403`.
- [ ] Staff 360° profile renders all six tabs from a single `staffId` with no duplicate queries against a "second" staff table.

---

### 4.2 Module: Hospital Setup & Master Data

**Purpose [CONFIRMED]:** Configuration foundation used by Front Desk, Admission, Inventory, Payroll and reporting (D16 p.6).

**Users/roles:** Super Admin, Admin (full CRUD, Cfg). All operational roles: read-only where relevant (e.g., Front Desk reads Services & Rates).

**Screens/pages [CONFIRMED, D17 p.4]:** Hospital Profile, Departments, Services & Rates, Wards/Rooms/Beds, Corporate Panels, Shift Management, (Shared Workforce Defaults/Templates — part of Staff module tooling, not a separate page).

**Sub-module: Hospital Profile [CONFIRMED, D17 p.4]**
- Fields: identity/name, contact, address, working hours, billing/legal metadata, logo.
- Business rule: *"Unconfigured details remain 'Not configured' rather than fabricated"* — exports must never invent hospital legal/contact data (D16 p.6, p.27). This is a strict, explicitly stated rule.
- Actions: Edit, Save, Cancel.

**Sub-module: Departments [CONFIRMED, D17 p.5]**
- Fields: code, name, head, type (clinical/administrative), capabilities (OPD/OBS/ER/Admission/Pharmacy-relevant flags), status.
- Business rule: *"Wards are not treated as departments"* — distinct hierarchy (D16 p.6).
- Actions: Add, View, Edit, Activate/Deactivate, Import Excel, Export.

**Sub-module: Services & Rates [CONFIRMED, D17 p.5]**
- Fields: code, name, department, category, billing unit, standard rate, panel eligibility flag, discount-allowed flag, manual-rate-override flag, status.
- Business rule: rate changes must not rewrite historical invoices — invoices snapshot the rate at time of billing (D15 §15).
- Actions: Add Service, View, Edit, Activate/Deactivate, Import Excel, Export.

**Sub-module: Wards / Rooms / Beds [CONFIRMED, D17 p.5]**
- Hierarchy: **Department → Ward → Room → Bed** (D16 p.6; D17 p.5).
- Fields: Ward (department, name, type); Room (ward, name, type); Bed (room, bed number, daily rate, status).
- Bed statuses: occupancy state is *separate* from operational state (e.g., a bed can be "Available" operationally but conceptually reserved by a tentative booking — see §4.7 Admission) (D16 p.10–11).
- Actions: Add Ward/Room/Bed, Edit, Mark Out of Service, Export.

**Sub-module: Corporate Panels [CONFIRMED, D16 p.6; D17 p.6]**
- Fields: organization name, contact, address, notes, status, service-wise discount rules.
- Business rule: exact patient/panel payable split after discount is client-configurable (D15 §3).
- Actions: Add Panel, Edit, Activate/Deactivate, Configure Discounts, Export.

**Sub-module: Shifts & Attendance Policies [CONFIRMED, D16 p.6; D17 p.6]**
- Fields: department, shift name, start/end time, break, grace minutes, late rule, early-exit rule, weekly off, overnight flag.
- Business rule: shifts support 24/7 and overnight duty; a night shift crossing midnight is normalized as **one shift instance** (D16 p.19).
- Actions: Add Shift, Edit, Activate/Deactivate, Duplicate Shift.

**Sub-module: Shared Workforce Defaults / Templates [CONFIRMED, D16 p.6]**
- Content: reusable salary basis types, deduction methods, allowance/deduction component types, commission calculation methods, shift templates — **templates only**, never per-employee values.

**Reports:** N/A (this is a master-data module; changes are audited, not "reported" per se) — **[ASSUMPTION]** a Setup Change Log view may be useful (see §16 re: no Audit Log *page* in HMS nav — this may need to live under System Settings if included at all).

**Dependencies:** Feeds Staff (§4.1), Front Desk (§4.6), Admission (§4.7), Inventory masters are separate (§4.8).

**Edge cases:** Deactivating a Service that has historical invoices must not affect those invoices (rate/description snapshot preserved). Deactivating a Department with active staff/beds should be blocked or require reassignment **[ASSUMPTION — confirm with client, §16]**.

**Acceptance criteria:**
- [ ] Hospital Profile fields left blank render as "Not configured" on every export (PDF/Excel/Print), never as fabricated placeholder text.
- [ ] Changing a Service's standard rate does not alter the rate shown on any invoice generated before the change.
- [ ] Ward→Room→Bed hierarchy enforces referential integrity (a Bed cannot exist without a Room; a Room cannot exist without a Ward).

---

### 4.3 Module: Attendance

**Purpose [CONFIRMED]:** Normalize and approve device attendance before it can drive Salary generation (D16 p.19).

**Users/roles:** Super Admin, Admin (review, correct, approve). All staff are subjects of attendance records (no direct login access to raw data in v1 — future Staff Portal, §2.3).

**Screens/pages [CONFIRMED, D17 p.6]:** Attendance (raw/processed list), Correct Attendance (drawer/modal), View Day (detail).

**Pipeline [CONFIRMED, D16 p.19; D11 flow 1]:**

```
Biometric/Device → Raw Punch Logs → Employee Code Mapping → Shift Matching →
Normalize Exceptions → Admin/Super Admin Review → Approved Attendance → Salary Engine
```

**Fields [CONFIRMED, D17 p.6]:** staff, date, shift, raw in/out timestamps, normalized in/out, status (Present/Absent/Late/Early-Exit/Missing Punch/Leave), correction: original value, corrected value, reason, changed-by, changed-on.

**Statuses:** Present, Absent, Late, Early Exit, Missing Punch, Leave, Corrected.

**Actions [CONFIRMED]:** Import/Sync Device, View Day, Correct Attendance, Approve, Export.

**Business rules [CONFIRMED]:**
- Adapter is vendor-neutral (API, SDK, LAN sync, or file import — final method TBD, §16) (D16 p.19, p.28).
- Overnight shifts crossing midnight remain **one shift instance**, not split across two calendar days (D16 p.19).
- Duplicate punches and missing checkouts are normalized before payroll (D16 p.19).
- Corrections **must** preserve Original Value, Corrected Value, Reason, Changed By, Changed On — never overwrite silently (D16 p.19, p.33; this exact 5-tuple is repeated across D01, D02, D16).
- If attendance changes *after* salary generation/payment, the system flags recalculation or creates an adjustment — paid payroll is never silently rewritten (D16 p.19).

**Calculations [CONFIRMED, D15 §7]:**

| Metric | Formula |
|---|---|
| Late Minutes | `max(0, Actual In − (Shift Start + Grace Minutes))` |
| Early Exit Minutes | `max(0, (Shift End − Allowed Early Tolerance) − Actual Out)` |
| Worked Minutes | `Actual Out − Actual In − Approved Break Minutes` (overnight-normalized across date boundary) |
| Present/Absent | Determined by configured minimum work/punch policy, approved leave, and shift schedule |

**Notifications [ASSUMPTION]:** Missing-punch alert to Admin/Super Admin; correction-applied notice.

**Reports [CONFIRMED, D16 p.22]:** Individual staff attendance report (daily/period), attendance exceptions/corrections report, department-wide attendance summary.

**Dependencies:** Staff Master (§4.1), Shifts (§4.2), feeds Salary Payroll (§4.4).

**Edge cases [CONFIRMED]:** Overnight shift attendance spanning a date boundary must resolve to one record; a correction made after the pay period has already been paid must produce an adjustment rather than mutate the paid record.

**Acceptance criteria:**
- [ ] Every attendance correction is stored as an immutable audit row (never an UPDATE that loses the prior value) — see §6 `attendance_corrections`.
- [ ] Salary generation reads only `status = 'APPROVED'` attendance records.
- [ ] A correction applied after payroll has been paid for that period creates a visible adjustment flag, not a silent recalculation.

---

### 4.4 Module: Salary Payroll

**Purpose [CONFIRMED]:** Generate, approve, and pay staff-specific salary, fully independent from Doctor Commission (D16 p.20).

**Users/roles:** Super Admin, Admin (generate, review, approve, pay, report). No other role has access.

**Screens/pages [CONFIRMED, D17 p.6]:** Salary Payroll (batch list), Generate Salary, Review, Approve, Pay Salary (Full/Partial), Print Slip, Salary Reports.

**Pipeline [CONFIRMED, D16 p.20]:**

```
Approved Attendance + Salary Profile → Generate Salary (Per Day / Monthly / Custom Range) →
Review → Approve → Pay (Full / Partial / Later) → Salary Outstanding → Salary Reports
```

**Fields [CONFIRMED, D17 p.6]:** staff/department filter, period type (Day/Monthly/Custom), date range, generated components (base, deductions, allowances, adjustments), payment amount/method/reference, status (Draft/Generated/Approved/Paid/Partially Paid/Outstanding).

**Business rules [CONFIRMED]:**
- Salary Payroll calculates **only salary-related items**; Commission is never included in the salary formula or salary outstanding balance (D16 p.20 — stated as an explicit constraint, not merely a design choice).
- Generation ≠ payment: a statement can be generated today and paid on any later date, in full, in part, or not yet (D16 p.20).
- Component treatment: Base Salary (per profile/basis), Absence deduction (per attendance policy), Late/Early-Exit deduction (per rule/grace policy), Allowances/Additions (when configured/approved), Adjustments (explicit +/− with mandatory reason) (D16 p.20).

**Calculations [CONFIRMED, D15 §8]:**

| Metric | Formula |
|---|---|
| Monthly Per-Day Rate | `Monthly Base Salary / Configured Payroll Divisor` |
| Period Base (monthly staff) | `Monthly Base × Eligible Period Fraction` (per configured policy) |
| Period Base (per-day staff) | `Approved Payable Days × Per-Day Salary Rate` |
| Absent Deduction | `Absent Pay Units × Configured Per-Unit Deduction` (often per-day rate) |
| Late Deduction | Configured staff rule: `Fixed Per Event` **or** `Late Minutes × Per-Minute Rate` **or** Threshold/Slab result |
| Early Exit Deduction | Configured staff rule: `Fixed Per Event` **or** `Early Minutes × Per-Minute Rate` **or** Threshold/Slab result |
| **Generated Salary** | `Period Base + Salary Allowances + Approved Additions − Attendance Deductions − Other Approved Deductions ± Adjustments` |
| Salary Outstanding | `Approved Generated Salary − Salary Payments Applied` |

**Worked example [CONFIRMED, D12 Example 5]:** Monthly base PKR 60,000, divisor 30 days → per-day PKR 2,000; 1 absent day −2,000; late deduction −500; early-exit −300; allowance +1,000 → **Generated Salary = PKR 58,200**.

**Notifications [ASSUMPTION]:** Salary generated (notify Admin/Super Admin for review), salary approved (notify payer), salary paid (notify staff — **out of scope for v1** if no staff portal exists; internal notice only).

**Reports [CONFIRMED, D16 p.22]:** Generated/paid/partially-paid/outstanding by staff/department/period, individual salary history and slips.

**Dependencies:** Staff Master (§4.1), Attendance (§4.3, approved only), independent of Commission (§4.5) by design.

**Edge cases [CONFIRMED]:** Salary generated for a period, then attendance corrected retroactively → must not silently rewrite the generated/paid statement (adjustment flow only, D16 p.19). Partial payment leaves outstanding balance open for future payment on any date.

**Acceptance criteria:**
- [ ] Generated Salary calculation snapshots all inputs (attendance, rates, rules) at generation time; later Staff profile changes do not alter historical statements.
- [ ] Salary Outstanding is computed purely from Salary payments — never nets against Commission.
- [ ] A Salary batch can be partially paid, leaving a correctly computed outstanding balance, and paid again later.

---

### 4.5 Module: Doctor Commission

**Purpose [CONFIRMED]:** Accrue and pay doctor (and other eligible staff) commission from actual completed services, independent from Salary (D16 p.21).

**Users/roles:** Super Admin, Admin (generate, approve, pay, report).

**Screens/pages [CONFIRMED, D17 p.6]:** Doctor Commission (list), Generate Commission, Review, Approve, Pay (Full/Partial), Print Slip, Commission Reports.

**Pipeline [CONFIRMED, D16 p.21]:**

```
Completed Eligible Service → Doctor Attached → Discount Applied → Commission Accrual →
Generate Commission (Day/Month/Custom) → Approve → Pay (Full/Partial/Later) → Commission Outstanding
```

**Fields [CONFIRMED, D17 p.6]:** doctor, period type, date range, eligible services list, rule type (Fixed/%), commission base (Gross/Net), payment amount/method/reference.

**Commission rule types [CONFIRMED, D16 p.21]:**

| Type | Example |
|---|---|
| Fixed per service | PKR 900 per completed consultation |
| Percentage | 15% of an eligible procedure amount |
| Service-specific | Different rule per service (consultation, ECG, procedure, …) |
| Doctor-specific | A doctor-specific rule can override a department default |
| Commission base | Default = Net After Discount; optional contract override = Gross Service Amount |

**Business rules [CONFIRMED]:**
- A service line can be included in **only one** generated commission statement — prevents duplicate payout (D16 p.21).
- Refund/cancellation after commission generation creates a **linked reversal/adjustment**, never a silent delete (D16 p.21).
- Salary Outstanding and Commission Outstanding are **never automatically merged** (D16 p.21, p.26).

**Calculations [CONFIRMED, D15 §4]:**

| Metric | Formula |
|---|---|
| Commission (% on Net — default) | `Net Eligible Service Amount × Commission %` |
| Commission (% on Gross) | `Service Gross × Commission %` |
| Commission (Fixed per service) | `Fixed Amount × Eligible Completed Qty` |
| Generated Commission | `Sum(eligible service commissions) + Approved Adjustments − Commission Reversals` |
| Commission Outstanding | `Approved Generated Commission − Commission Payments Applied` |
| Hospital Share (after discount & commission) | `Net Service Amount − Doctor Commission` |

**Worked example [CONFIRMED, D12 Example 1 & 6]:** Service Gross PKR 5,000, 10% discount → Net PKR 4,500; Commission @20% of net = PKR 900; **Hospital Share = PKR 3,600**. Separately, D12 Example 6: Salary generated 58,200 / paid 40,000 / outstanding 18,200, while Commission generated 22,500 / paid 22,500 / outstanding 0 — **two fully independent ledgers**.

**Reports [CONFIRMED, D16 p.22]:** Service-wise accrual, generated statements, paid/partially-paid/outstanding, reversals/adjustments — by doctor/period.

**Dependencies:** Front Desk/OPD billing (service completion event, §4.6), Staff Master (commission rule configuration, §4.1).

**Edge cases [CONFIRMED]:** A completed service is refunded after its commission was already generated and paid → reversal/adjustment entry required, original statement untouched. A doctor has both a department-default rule and a doctor-specific override → doctor-specific wins (D16 p.21).

**Acceptance criteria:**
- [ ] A given service line's `id` cannot appear in two `commission_statement_lines` rows across different statements (DB constraint, §6).
- [ ] Commission Outstanding calculation never references the `salary_*` tables.
- [ ] Refunding an already-commissioned service produces a reversal row referencing the original commission line, not a deletion.

---

### 4.6 Module: Front Desk / Billing (Appointments, Encounters, Hospital Invoicing)

**Purpose [CONFIRMED]:** The only HMS portal that collects hospital patient money — appointments, OPD/Observation/Emergency billing, all hospital collections including admission advances/partials/finals, discounts, refunds, and cashier settlement (D04 p.1; D16 p.8–9).

**Users/roles:** Front Desk/Billing (full operational CRUD); Super Admin/Admin (oversight/monitoring only, no direct cash collection per D17 p.7 unless also holding the Billing role).

**Screens/pages [CONFIRMED, D17 p.7–8]:** Dashboard, Appointments, Walk-In/Encounter Intake, OPD, Observation, Emergency, Hospital Invoices, Admission Payment Requests, Payments/Receipts, Discounts, Refunds, Outstanding, Panel Billing, My Balance Sheet, My Account Settlement, Reports.

**Sub-flow A — Appointment Booking [CONFIRMED, D16 p.8; D11 flow 3]:**

```
Patient (Panel or temporary) → Department + Doctor + Slot → Estimated Service Amount →
Advance/Payment → Booked → [Check-In] → OPD Encounter → Additional Services → Invoice →
Advance Adjusted → Collect Balance → Receipt
```

- Fields: patient type (Panel search / temporary self-pay identity: name, guardian, phone, address), department, doctor, service, date, time slot, estimated amount, advance/payment, notes.
- Statuses [CONFIRMED, D16 p.8]: **Draft/Booked → Confirmed → Checked-In → Completed**, with lifecycle exceptions **Rescheduled / Cancelled / No Show** retained for reporting.
- Actions: Book Appointment, View, Edit/Reschedule, Check-In, Cancel, Collect Advance, Print.
- Business rule: cancellation/no-show/refund behavior is policy-configurable (approval thresholds TBD — §16).

**Sub-flow B — Walk-in / OPD / Observation / Emergency [CONFIRMED, D16 p.9; D11 flow 4]:**

```
Temporary/Panel Identity → Encounter Type (OPD/OBS/ER) → Services → Discount if authorized →
Hospital Invoice → Full/Partial Payment → Receipt
```

- Business rule: *"Observation and Emergency are encounter/workflow types, not separate login portals. Front Desk creates the case and performs hospital billing."* (D16 p.9) — this is an important architectural clarification: **there is no separate OBS/ER module**, only an `encounter_type` value.
- Discount/commission calculation chain: `Gross Service Amount → Discount → Net Eligible Service Amount → Doctor Commission → Hospital Remaining Share` (D16 p.9; formulas §4.5).

**Sub-flow C — Admission payment request fulfillment [CONFIRMED, D04 p.2; D16 p.11]:**

```
Admission sends Payment Request → Billing opens linked Admission → Collect Cash/Card/Bank/Online →
Receipt → Payment status syncs back to Admission
```

- Business rule (repeated 6+ times across the source pack — the single most critical rule in the whole system): *"Admission never receives Hospital cash, even for partial payments during the stay."* (D04 p.2)

**Fields — Hospital Invoice [CONFIRMED, D17 p.8]:** invoice source, service lines (service, qty, rate snapshot, discount), notes, total, paid/outstanding, status.

**Fields — Discount [CONFIRMED, D17 p.8]:** service/invoice reference, discount %/amount, reason, approver (if above threshold).

**Fields — Refund [CONFIRMED, D17 p.8]:** original receipt reference, amount, reason, method, remarks; workflow Create Refund → Submit/Approve (if required) → Pay Refund → Print.

**Statuses [CONFIRMED]:** Invoice: Unpaid / Partially Paid / Paid. Payment method: Cash / Card / Bank / Online.

**Actions [CONFIRMED, D17 p.7–8]:** New Appointment, New Walk-In, Book Appointment, Check-In, Cancel, Open Case, Add Service, Generate/Update Bill, Collect Payment, Complete, Apply Discount, Request Approval, Create Refund, Pay Refund, Print, Receive Payment, View Receipt, Reprint, Export.

**Business rules [CONFIRMED]:**
- Normal/Self-Pay patients are **temporary encounter identities**; only Panel Patients are permanent reusable masters (D04 p.2; D16 p.7).
- Card/Bank/Online payments are reported separately and **do not increase physical cash** (D04 p.2; D15 §9).
- Refunds/approved cash expenses **reduce** expected physical cash (D04 p.2).
- Each Billing cashier has an **individual** Balance Sheet and submits their **own** settlement (D04 p.2–3).

**Calculations [CONFIRMED, D15 §2, §6]:**

| Metric | Formula |
|---|---|
| Line Gross | `Quantity × Unit Rate` |
| Discount Amount (%) | `Line Gross × Discount %` |
| Discount Amount (Fixed) | Configured fixed amount, capped by policy |
| Line Net | `Line Gross − Discount Amount` |
| Invoice Subtotal | `Sum(Line Net) + configured non-discountable charges` |
| Amount Paid | `Sum(successful payments) − reversed/refunded amounts` |
| Outstanding | `Final Invoice Amount − Net Payments Applied` |
| Appointment Remaining | `Final Encounter Invoice − Appointment Advance Applied` |
| Admission Hospital Due | `Final Hospital Bill − all Hospital payments applied by Billing` |
| Excess Advance | `max(0, Hospital Payments Applied − Final Hospital Bill)` |
| Panel Discount | `Eligible Service Gross × Panel Service Discount %` |
| Panel Service Net | `Eligible Service Gross − Panel Discount` |

**Worked examples [CONFIRMED, D12 Examples 1–3, D16 Worked Example — OPD]:**
- Appointment: estimate PKR 5,500, advance PKR 1,500 → final invoice PKR 4,000 → advance adjusted → remaining PKR 2,500 (reconciled example, D12 Ex.2).
- OPD with additional service: consultation PKR 5,000 booked, PKR 2,000 advance, +PKR 1,500 additional service during encounter → total PKR 6,500, advance applied PKR 2,000, remaining PKR 4,500 (D16 p.23).
- Admission partial payments: running charges PKR 80,000, two partials (30,000 + 20,000) = 50,000 collected, final bill PKR 95,000 → **balance due PKR 45,000**; Pharmacy-managed medicine remains on a separate invoice (D12 Ex.3).

**Notifications [ASSUMPTION]:** New admission payment request received (Front Desk), discount above threshold pending approval (Admin/Super Admin), refund pending approval.

**Reports [CONFIRMED, D16 p.22; D04 p.3]:** Appointments by doctor/department/date/status; billing/collection by user/method/encounter/date; admission partial/final payments; refunds, outstanding, discounts, receipts, cashier settlements.

**Dependencies:** Hospital Setup (services/rates, §4.2), Admission (payment requests, §4.7), Doctor Commission (service completion event, §4.5), Universal Cash Accountability (§4.9).

**Edge cases [CONFIRMED]:** An appointment converts to encounter at check-in — the advance must carry forward and be atomically adjustable against the final invoice. A discount request above the configured threshold must block invoice completion until approved.

**Acceptance criteria:**
- [ ] Card/Bank/Online collections never appear in the cashier's physical-cash Balance Sheet total.
- [ ] Every hospital payment against an Admission is recorded in Billing and reflected back to Admission as a read-only synced status (Admission cannot write to it).
- [ ] An invoice's line rate is the rate captured at billing time even if the Service master rate later changes.

---

### 4.7 Module: Admission (Planned, Active, Medication Mode, Discharge)

**Purpose [CONFIRMED]:** Non-cash operational management of the inpatient lifecycle: planned admission, bed assignment, active stay, medication fulfillment coordination, and dual-clearance discharge (D05 p.1; D16 p.10–13).

**Users/roles:** Admission (full operational CRUD, no cash); Super Admin/Admin (oversight); Front Desk/Billing (fulfills payment requests raised here); Pharmacy (fulfills medicine requests raised here).

**Screens/pages [CONFIRMED, D17 p.9–10]:** Dashboard, Planned Admissions, Admission Check-In, Bed Board/Transfers, Active Admissions, Hospital Services/Procedures, Medication Fulfillment Mode, Pharmacy Requests, Hospital Payment Requests, Clearances, Discharge, Reports.

**Sub-flow A — Planned Admission / Booking [CONFIRMED, D16 p.10; D11 flow 5]:**

```
Doctor recommends admission → Planned Admission created → Patient identified (Panel/temporary) →
Expected date/time, department, doctor, ward/room/bed preference, estimated amount recorded →
[If advance required] Payment Request → Billing collects → Arrival → Bed assigned → Active Admission
```

- Business rule: *"A booking may tentatively reserve a bed if hospital policy allows, but the bed becomes Occupied only when the Active Admission starts."* (D16 p.10) — tentative reservation ≠ occupied state.
- Fields: patient type, doctor, department, expected date/time, ward/room preference, estimated hospital amount, notes.

**Sub-flow B — Active Admission Lifecycle [CONFIRMED, D16 p.11; D11 flow 6]:**

```
Admit → Department → Ward → Room → Bed → Running Stay → Add Services/Procedures/Tests →
Running Hospital Bill → [repeatable] Payment Request → Billing collects partial → status synced →
Clearance/Discharge
```

- Bed/transfer fields: from bed, to bed, timestamp, actual user (D16 p.11).
- Business rule: cash collection remains with Billing throughout; Admission only **reads** payment status (D16 p.11).

**Sub-flow C — Medication Fulfillment Mode [CONFIRMED, D16 p.12; D11 flow 7–8]:**

| Mode | Behavior | Pharmacy/Billing effect |
|---|---|---|
| **SELF** | Patient/attendant arranges medicines externally | No Pharmacy request, no Pharmacy invoice for those medicines |
| **HOSPITAL MANAGED** | Admission creates medicine requests, tracks fulfillment | Standalone Pharmacy Accepts/Partially Fulfills/Rejects, dispenses, bills, sends clearance |

- Business rule: mode **can change during the stay** (SELF ↔ HOSPITAL MANAGED); every change stores **Reason, Changed By, Timestamp** — the same audit 5-tuple pattern as attendance corrections (D16 p.12).
- Business rule: switching to SELF may only cancel **pending, unfulfilled** request lines; already-dispensed medicine remains billed unless reversed through a proper Pharmacy return/refund — *"a mode change does not erase previously dispensed Pharmacy transactions"* (D16 p.12).

**Sub-flow D — Two-Bill Discharge [CONFIRMED, D16 p.13; D11 flow 9]:**

| Financial stream | Owner | Clearance |
|---|---|---|
| Hospital services, bed, tests, procedures | HMS / Front Desk Billing | Front Desk collects all advances/partials/final balance → grants **Hospital Billing Clearance** |
| Medicines dispensed under HOSPITAL MANAGED mode | Standalone Pharmacy | Pharmacy generates its own invoice/payment → grants **Pharmacy Clearance** |

- **Final Discharge Gate [CONFIRMED — exact formula, D16 p.13]:** `Clinical Ready + Hospital Billing Clearance + Pharmacy Clearance (when Pharmacy-managed medicines were used) = Final Discharge.`
- A consolidated discharge summary may show both totals but *"is not a third accounting invoice"* (D16 p.13) — no reconciling ledger entry is created at discharge; the two bills remain permanently separate financial records.

**Fields [CONFIRMED, D17 p.9–10]:** Admission (patient, doctor, department, disease/diagnosis, weight if needed, ward, room, bed, admission date/time, medication mode); Service line (service, qty, rate snapshot, performed-by/doctor, date/time, notes); Transfer (from bed, to bed, date/time, reason); Mode change (current mode, new mode, effective date/time, reason); Pharmacy request (medicine/item, qty, instructions/notes, requested by, priority); Payment request (requested amount, reason/type Advance/Partial/Final, notes); Discharge (date/time, doctor, summary/notes, clearance checks).

**Statuses:** Planned → Confirmed/Arrived → Active → Discharge-in-progress → Discharged. Clearance sub-statuses: Clinical Ready (Y/N), Hospital Billing Clearance (Pending/Cleared), Pharmacy Clearance (Pending/Cleared/N/A).

**Actions [CONFIRMED, D17 p.9–10]:** New Planned Admission, Admit Patient, Create Booking, Request Advance, Confirm Arrival, Assign Bed, Transfer, Mark Bed Out of Service, Add Service, Post Charge, Change Mode, New Request (Pharmacy), Create Request (payment), Mark Clinical Ready, Refresh Hospital/Pharmacy Clearance, Prepare/Confirm Discharge, Print Discharge Summary.

**Notifications [ASSUMPTION]:** Payment request created (Billing), medicine request status changed (Admission), discharge blocked by pending clearance.

**Reports [CONFIRMED, D05 p.2; D16 p.22]:** Planned admissions, active admissions, bed occupancy/transfers; running hospital charges and Billing payment-request status; medication mode changes and Pharmacy request status; discharge readiness and clearance delays.

**Dependencies:** Front Desk/Billing (§4.6, hospital payments), Standalone Pharmacy (§4.9, medicine requests/clearance), Hospital Setup (§4.2, wards/rooms/beds).

**Edge cases [CONFIRMED]:** Patient discharged with HOSPITAL MANAGED medicines still pending Pharmacy dispense → blocked (Pharmacy Clearance not yet granted). Mode changed mid-stay after partial dispensing → prior dispensed items remain on the Pharmacy bill; only future requests follow the new mode (D16 p.24, Worked Example — Admission).

**Acceptance criteria:**
- [ ] A bed's `status` transitions to `OCCUPIED` only on Active Admission start, never on a tentative planned-admission reservation.
- [ ] Discharge is blocked by the API (not just the UI) unless all three clearance conditions are true.
- [ ] Admission has zero database write access to any payment/cash table — enforced at the authorization layer, not just hidden in the UI.
- [ ] A medication-mode change writes an immutable `medication_mode_changes` row; it never updates a prior mode value in place.

---

### 4.8 Module: HMS Inventory Management (Non-Medicine)

**Purpose [CONFIRMED]:** Full controlled stock module for non-medicine hospital supplies — *"a full controlled stock module, not just an expense-entry screen"* (D06 p.1).

**Users/roles:** Inventory Management (full operational CRUD); Super Admin/Admin (fund approval, oversight, settlement review).

**Screens/pages [CONFIRMED, D17 p.10–11]:** Dashboard, Item/Product Master, Categories/Units, Suppliers, Stock Locations, Purchase Requirements, Fund/Petty Cash Request, Purchases/Goods Receipt, Stock Ledger, Supplier Ledger, Stock Balance, Department Issue/Return, Stock Transfers, Supplier Returns, Adjustments/Damage, Low Stock/Reorder, Expenses, My Balance Sheet, My Account Settlement, Reports.

**Masters [CONFIRMED, D06 p.1]:** Item/Product Master (code, name, category, unit, reorder level, active status, optional location); Supplier Master (name, contact, phone, address, terms/status); Stock locations/stores and receiving/issuing departments.

**Sub-flow A — Procurement & Receipt [CONFIRMED, D06 p.1; D11 flow 10]:**

```
Requirement / Low Stock → Purchase Request → Approval / Funding → Supplier Purchase →
Goods Receipt → Stock Ledger IN → Supplier Ledger Update
```

- Fund flow: if an Inventory user lacks sufficient assigned cash, they submit a **Fund Request**; Admin/Super Admin approves/rejects; approved petty cash/advance is credited to that exact user (D16 p.17).
- Payment methods: Petty Cash (reduces user's physical cash), Management Direct/Bank (does **not** touch user's physical cash), Credit (creates/increases Supplier Outstanding if enabled) (D06 p.1–2; D16 p.17).

**Stock Ledger movement types [CONFIRMED — exact table, D06 p.1]:**

| Movement | Stock effect |
|---|---|
| Purchase/Receipt | IN |
| Department Return | IN |
| Transfer In | IN |
| Positive Adjustment | IN |
| Department Issue | OUT |
| Supplier Return | OUT |
| Transfer Out | OUT |
| Damage/Loss/Negative Adjustment | OUT |

- Business rule: every ledger row keeps date/time, item, quantity, source/destination, reference, user, and running balance. **Negative stock is blocked unless the client explicitly enables a controlled exception** (D06 p.1 — strict rule).

**Sub-flow B — Department Issue/Return [CONFIRMED, D06 p.2; D11 flow 11]:**

```
Store Stock → Issue Request/Direct Authorized Issue → Department/Ward → Consumption/Use →
Unused Return if any
```

- Business rule: *"Stock issue is a stock movement, not a supplier transaction. Every issue/return identifies department and actual issuing/receiving user."* (D06 p.2)

**Sub-flow C — Purchase Return [CONFIRMED, D16 p.18]:** links to original purchase/item, records returned qty and supplier/refund method, decreases stock, updates cash correctly — *if cash is physically returned to the Inventory user, that user's cash increases; if refund is received by management/bank, the user's physical cash does not change.*

**Supplier Ledger [CONFIRMED, D06 p.2]:** Opening outstanding (migration only), credit purchases increase outstanding, supplier payments/returns/approved credits decrease outstanding; a cash purchase paid in full may post purchase and payment together with **zero new outstanding**.

**Calculations [CONFIRMED, D15 §12]:**

| Metric | Formula |
|---|---|
| Closing Quantity | `Opening Qty + Purchases/Receipts + Department Returns + Transfer In + Positive Adjustments − Department Issues − Supplier Returns − Transfer Out − Negative Adjustments` |
| Supplier Outstanding | `Opening Supplier Outstanding + Credit Purchases − Supplier Payments − Purchase Returns − Approved Supplier Credits` |
| Reorder Need (simple) | If `Available Qty ≤ Reorder Level`: `Suggested Qty = Target/Max Level − Available Qty` (when configured) |

**Worked example [CONFIRMED, D12 Example 4]:** Admin issues user PKR 50,000 petty cash (user cash +50,000); cash purchase supplies PKR 18,000 (user cash −18,000, stock IN); credit purchase PKR 25,000 (no cash effect, stock IN, Supplier Outstanding +25,000); pay supplier PKR 10,000 later from approved cash (user cash −10,000, Supplier Outstanding −10,000).

**Notifications [ASSUMPTION]:** Low-stock/reorder alert, fund request submitted/approved, settlement variance flagged.

**Reports [CONFIRMED, D06 p.3; D16 p.18]:** User cash balance and settlement history; fund requests/issues; purchases by supplier/product/user; Stock Ledger (in/out/transfer/return/adjustment/running qty); department issues/acknowledgements; Supplier Ledger (purchases, returns, payments, credits, outstanding); low-stock/out-of-stock alerts.

**Dependencies:** Universal Cash Accountability (§4.9), Hospital Setup (departments, §4.2). Explicitly **not** dependent on / connected to Pharmacy stock (§4.9) — separate ownership by design.

**Edge cases [CONFIRMED]:** A negative-stock attempt must be rejected by default; an explicit, auditable override flag is the only path around it, and only if the client enables that policy. Management pays a supplier directly by bank → supplier/payment records update but the Inventory user's physical cash is untouched (D16 p.34).

**Acceptance criteria:**
- [ ] A `stock_ledger` INSERT that would drive `closing_quantity` below 0 is rejected by a database CHECK/trigger unless a controlled-exception flag is explicitly set.
- [ ] Cash purchases reduce only the exact purchasing user's Balance Sheet, never a shared/pooled balance.
- [ ] Supplier Outstanding recomputation always reconciles to the sum of its component ledger entries (testable invariant, §12).

---

### 4.9 Module: Universal Cash Accountability (Balance Sheet & Account Settlement)

**Purpose [CONFIRMED]:** Give every authorized cash-handling user an individual cash position and a personal settlement workflow, applied identically across Front Desk/Billing, Inventory, and Pharmacy Sales/Dispensing (D16 p.15–16; D14 p.2). This is a **cross-cutting module**, not owned by one portal.

**Users/roles:** Front Desk/Billing, Inventory Management, Pharmacy Sales/Dispensing (submit their own); Super Admin/Admin (review HMS-side); Pharmacy Super Admin/Pharmacy Manager (review Pharmacy-side, if Manager is granted permission).

**Cash-holding users table [CONFIRMED — verbatim structure, D16 p.15]:**

| Cash-holding user | Typical money in | Typical money out |
|---|---|---|
| Front Desk/Billing user | Opening float/petty cash, cash patient collections, admission advances/payments | Cash refunds, authorized cash expenses |
| Inventory user | Opening petty cash, purchase advance/top-up, cash return/refund received | Cash purchases, approved operating expenses |
| Pharmacy Sales/Dispensing user | Opening float/petty cash, cash retail/HMS Pharmacy collections | Cash refunds, authorized cash expenses |
| Management cash-holder (optional) | Settlements received, assigned management cash | Petty-cash issues, approved disbursements |

**Explicit exclusion [CONFIRMED]:** *"Admission is excluded because Admission never receives Hospital cash."* (D16 p.15) — Admission has **zero** rows in the cash-accountability system.

**Settlement workflow [CONFIRMED — exact stages, D16 p.16]:**

| Stage | What happens |
|---|---|
| Prepare | User selects the unsettled day/shift/custom period, reviews inflows/outflows |
| Count | User records physical cash; system calculates variance against expected cash |
| Submit | Exact logged-in user submits their own settlement — no one else's money can be submitted as their own |
| Review | Authorized reviewer verifies expected cash, physical cash, included transactions, remarks |
| Decision | Accept / Partial Accept / Return / Reject |
| Transfer | Accepted amount transfers custody to the receiver; unaccepted balance remains with the original user |

**Business rules [CONFIRMED — critical accounting semantics]:**
- *"A settlement is not revenue or expense; it is a transfer of custody of existing cash."* (D16 p.16)
- Already-settled transactions cannot be included in another settlement (D16 p.16).
- Partial settlement keeps the remaining balance open **for the same user** (D16 p.16).
- Each settlement retains **Submitted By, Received By, Reviewed By**, timestamps, and remarks (D16 p.16).

**Calculations [CONFIRMED, D15 §9–11, §14]:**

| Metric | Formula |
|---|---|
| Billing: Expected Physical Cash Before Settlement | `Opening Float + Cash Collections + Cash Received From Management − Cash Refunds − Authorized Cash Expenses` |
| Billing: Online/Card/Bank Total | `Sum(successful non-cash collections)` — reported separately, never added to physical cash |
| Billing: Cash Variance | `Physical Cash Count − Expected Physical Cash Before Settlement` |
| Billing: Closing Cash After Handover | `Physical Cash Count − Cash Handed Over/Settled` |
| Settlement Outstanding | `Expected Handover Amount − Accepted Handover Amount` (if partial settlement allowed) |
| Inventory: Available User Cash | `Opening/Carry-forward Cash + Petty Cash/Advances Issued` |
| Inventory: Expected Remaining Cash | `Available User Cash − Cash Purchases − Approved Cash Expenses + Cash Purchase Returns/Recoveries` |
| Inventory: Cash Variance | `Physical Cash Count − Expected Remaining Cash` |
| Pharmacy: Expected Pharmacy Cash | `Opening Float + Cash Pharmacy Sales + Cash Received − Cash Refunds − Authorized Cash Expenses` |
| Pharmacy: Cash Variance | `Physical Cash − Expected Pharmacy Cash` |
| Management consolidation: Total Cash Held By Users | `Sum(each active cash-holder's Closing/Current Physical Cash)` |
| Management consolidation: Total Pending Settlements | `Sum(submitted but not fully accepted settlement amounts)` |
| Management consolidation: User Accountability Delta | `User Expected Cash − Accepted/Recorded Cash position` (drill-down via settlement variance) |

**Worked example [CONFIRMED, D12 Example 8]:** Opening float 5,000 + collections 40,000 − refund 2,000 − expense 1,000 = **Expected 42,000**; physical counted 41,800 → **Variance −200**.

**Notifications [ASSUMPTION]:** Settlement submitted (reviewer), settlement accepted/partially accepted/returned (submitter), variance beyond a configured threshold flagged (management).

**Reports [CONFIRMED]:** User-wise cash position/settlement history (all three modules), consolidated management cash-position report (Super Admin/Admin), Pharmacy-side equivalent (Pharmacy Super Admin/Manager).

**Dependencies:** Front Desk/Billing (§4.6), HMS Inventory (§4.8), Pharmacy Sales/Dispensing (§4.10). This module's data model is **shared/generic** across all three (see §6.6 `cash_balance_sheets`, `account_settlements` — one schema serves all cash-handling roles via a `user_id` + `module_scope` discriminator).

**Edge cases [CONFIRMED]:** A user submits a settlement, reviewer partially accepts it → remaining unaccepted balance stays open under the *same* user for the *next* settlement cycle, not lost or auto-carried by the reviewer (D16 p.16).

**Acceptance criteria:**
- [ ] A settlement transaction never posts to any revenue/expense account — it only moves a `custody_owner_id` pointer (§6.6).
- [ ] A transaction already referenced by an accepted settlement cannot be selected into a second settlement (unique constraint / status guard).
- [ ] Partial acceptance correctly splits accepted vs. remaining amounts and leaves the remainder attributed to the original submitting user.

---

### 4.10 Module: Standalone Pharmacy — Medicine Inventory (Pharmacy Manager / Pharmacy Super Admin)

**Purpose [CONFIRMED]:** Own medicine catalogue, batches, expiry, medicine stock, dispensing, and Pharmacy billing as a system boundary separate from HMS Inventory (D07 p.1; D09 p.1).

**Users/roles:** Pharmacy Manager (full operational CRUD); Pharmacy Super Admin (governance, oversight, users, settings); Pharmacy Sales/Dispensing (dispense only, §4.11).

**Screens/pages [CONFIRMED, D17 p.11–13]:** Dashboard, Pharmacy Profile/Settings, Pharmacy Users (Pharmacy Super Admin), Medicine Categories/Units, Medicine Master, Suppliers, Purchases/Receipts, Medicine Stock Ledger, Supplier Ledger, Batch/Expiry, Locations/Transfers, Returns, Adjustments, Alerts, HMS Admission Requests, Dispensing Oversight, Cashier Balance Sheets, Settlement Review, Reports.

**Masters [CONFIRMED, D09 p.1; D08 p.1]:** Medicine Master (code, name, generic/brand as configured, category, unit, batch/expiry-required flag, sale/purchase rates, status); Supplier Master (name, contact, phone, address, terms, status).

**Sub-flow — Purchase/Receipt & Stock [CONFIRMED, D09 p.1; D07 p.1]:**

```
Supplier → Medicine → Batch → Expiry → Qty → Cost → Receipt → Medicine Stock Ledger IN → Supplier Ledger
```

- Business rule: *"No manual silent stock editing. Corrections post Adjustment entries."* (D09 p.1)
- Business rule: *"Batch-managed medicine requires batch on receipt/dispense/return."* (D09 p.1)
- Store/counter transfers (store → counter / counter → store / location-to-location) are internal stock movements (D09 p.1).
- Returns: Patient return and Supplier return, each with distinct stock/financial effect (D09 p.1).
- Adjustments: Expiry, damage, breakage, count variance — each requires reason and actor (D09 p.1).
- Alerts: Low stock, out of stock, near-expiry, expired (D09 p.1).

**FEFO rule [CONFIRMED, D15 §13]:** *"FEFO Allocation = choose valid non-expired available batch with earliest expiry first, subject to clinical/operational constraints."* Worked example (D12 Example 7): Medicine X has Batch A (expires 20 Sep, 30 units) and Batch B (expires 15 Dec, 100 units); a 10-unit request should normally allocate Batch A first because it expires earlier.

**Calculations [CONFIRMED, D15 §13]:**

| Metric | Formula |
|---|---|
| Batch Closing Qty | `Opening Batch Qty + Batch Receipts + Returns In + Transfers In − Dispensed/Sold − Supplier Returns − Transfers Out − Expiry/Damage/Negative Adjustments` |
| Near Expiry | `Expiry Date − Current Date ≤ Configured Near-Expiry Days AND Batch Qty > 0` |
| Pharmacy Supplier Outstanding | `Opening + Credit Purchases − Supplier Payments − Supplier Returns − Approved Credits` |

**Notifications [ASSUMPTION]:** Low-stock/near-expiry/expired alert, new HMS request received, HMS request status changed.

**Reports [CONFIRMED, D08 p.2; D09 p.2]:** Medicine Stock Ledger, batch-wise stock, low stock, near expiry, expired, adjustments; purchases, receipts, supplier ledger, payments/outstanding, returns; requests accepted/partial/rejected/dispensed, Pharmacy invoice/clearance status.

**Dependencies:** Independent of HMS Inventory (§4.8) by design; receives requests from Admission (§4.7); feeds Pharmacy Sales/Dispensing (§4.11).

**Edge cases [CONFIRMED]:** A batch nearing expiry with remaining quantity must surface on the Alerts screen even with zero pending requests. A dispense attempt against an expired batch must be blocked.

**Acceptance criteria:**
- [ ] A `pharmacy_stock_ledger` row always references a specific batch when the medicine's `batch_managed = true`.
- [ ] FEFO allocation is the default batch-selection algorithm and is overridable only through an explicit, logged manual override.
- [ ] Every adjustment (expiry/damage/breakage/variance) requires a non-null reason and a non-null actor at the database constraint level.

---

### 4.11 Module: Pharmacy Sales / Dispensing Staff

**Purpose [CONFIRMED]:** Operational counter portal for HMS-linked dispensing, retail sales, Pharmacy invoicing, permitted returns/refunds, and the dispensing staff's own cash accountability (D10 p.1).

**Users/roles:** Pharmacy Sales/Dispensing Staff only (operational); Pharmacy Manager/Super Admin (oversight, §4.10).

**Screens/pages [CONFIRMED, D17 p.13–14]:** Dashboard, HMS Requests, Retail Sale/Dispense, Pharmacy Invoices, Payments/Receipts, Returns/Refunds, Medicine/Counter Stock Lookup, My Balance Sheet, My Account Settlement, My Reports.

**Dispensing flows [CONFIRMED — exact table, D10 p.1]:**

| Flow | Steps |
|---|---|
| HMS Admission request | Open request → verify → select eligible batch → dispense full/partial → invoice/status → send result/clearance to HMS |
| Retail/direct sale | Search medicine → quantity → batch allocation → Pharmacy invoice → collect payment → receipt |
| Return | Open original transaction → validate return → return quantity/value → stock movement IN where allowed → refund/credit per policy |

**Fields [CONFIRMED, D17 p.13]:** request reference, medicine, approved qty, batch selection, dispensed qty, notes; sale: medicine, qty, batch, rate, discount if permitted, payment; return: original invoice, medicine/batch, qty, reason, refund/credit method.

**Business rules [CONFIRMED, D10 p.1]:**
- Each Sales/Dispensing user has an **individual** Balance Sheet; opening float/petty cash if assigned; cash sales add to expected physical cash; cash refunds/authorized cash expenses reduce it; online/card/bank payments are reported separately.
- *"Dispensing cannot bypass medicine stock ledger."* Batch/expiry recorded where applicable. User identity stored as **Dispensed By / Sold By / Refunded By**.

**Statuses:** Request: Assigned → Verified → Dispensed (Full/Partial) → Clearance Sent. Sale: Draft/Hold → Confirmed → Invoiced → Paid. Return: Requested → Validated → Processed.

**Actions [CONFIRMED, D17 p.13–14]:** Open HMS Request, Dispense Full, Dispense Partial, Reject/Return to Manager if permitted, New Sale, Add Item, Hold, Confirm Sale, Print Invoice, Receive Payment, Reprint, Create Return, Submit/Process, Prepare Settlement, Submit.

**Reports [CONFIRMED, D10 p.1 implied; D17 p.14]:** Own sales, HMS dispensing, returns/refunds, payments, and settlements.

**Dependencies:** Standalone Pharmacy inventory (§4.10, stock must exist to dispense), HMS Admission (§4.7, request source), Universal Cash Accountability (§4.9, same generic settlement model applied to this role).

**Edge cases [CONFIRMED]:** A dispense request for more than the available/eligible batch quantity → must offer Partial Dispense, not silently fail or over-allocate.

**Acceptance criteria:**
- [ ] Every dispense decrements `pharmacy_stock_ledger` in the same transaction as the invoice line — no dispense can exist without a corresponding stock movement.
- [ ] `dispensed_by` / `sold_by` / `refunded_by` are always the authenticated actor's `portal_user_id`, never a display label.

---

### 4.12 Module: HMS ↔ Pharmacy Integration Bridge

**Purpose [CONFIRMED]:** The controlled, auditable hand-off connecting Admission's medicine requests to Pharmacy's fulfillment, without either system owning the other's data (D07 p.1–2; D16 p.14).

**Users/roles:** Admission (raises requests, §4.7); Pharmacy Manager/Sales-Dispensing (accept/partial/reject/dispense, §4.10–4.11); Super Admin/Admin/Pharmacy Super Admin (status oversight only).

**Flow [CONFIRMED — exact diagram caption, D16 p.14]:**

```
Admission Request → Pharmacy Queue → Check Stock → Accept/Partial/Reject → FEFO Batch →
Dispense → Pharmacy Invoice → Payment/Clearance → Status Back to HMS
```

**Business rules [CONFIRMED — this is the strictest integration contract in the source pack, D16 p.14]:**
- HMS sends a request **only** for HOSPITAL MANAGED mode (D16 p.14).
- Pharmacy can **Accept / Partially Fulfill / Reject** (D16 p.14).
- Pharmacy returns actual dispensed quantity, rate, amount, invoice/payment status, and clearance to HMS (D16 p.14).
- Pharmacy bill is **always** separate from the Hospital bill — no merge, ever (D16 p.14).
- Every request carries a **stable Admission ID, Medicine Request ID, and case/patient reference** (D16 p.14).
- *"Duplicate callbacks must be idempotent; one dispense must not create two charges."* (D16 p.14)
- *"Failed integration states remain visible and retryable rather than being silently marked complete."* (D16 p.14)

**Statuses [CONFIRMED]:** Requested → Accepted/Partially Fulfilled/Rejected → Dispensing → Dispensed → Invoiced → Clearance Sent. Failure state: Integration Error (visible, retryable).

**Dependencies:** Admission (§4.7), Pharmacy Manager (§4.10), Pharmacy Sales/Dispensing (§4.11).

**Acceptance criteria:**
- [ ] Every callback from Pharmacy → HMS carries the originating `admission_id` + `medicine_request_id` and is processed idempotently (a retried callback with the same request ID does not create a second stock/invoice effect) — see §6.10, §7.9.
- [ ] A failed callback delivery is retried with backoff and remains in a visibly "Failed/Retryable" state in both portals until resolved — never silently marked "Complete".
- [ ] No HMS table stores medicine stock quantities; HMS only stores the latest known status/snapshot of a Pharmacy-owned request.

---

### 4.13 Module: Reporting, System Settings & Dashboards (cross-cutting)

**Purpose [CONFIRMED]:** Hospital-wide and per-user reporting with consistent filtering/export, plus system configuration (D16 p.22; D17 p.8).

**Users/roles:** All roles see reports scoped to their own module (§3.3); Super Admin/Admin see hospital-wide reports; Pharmacy Super Admin sees Pharmacy-wide reports.

**Screens/pages [CONFIRMED, D17 p.2, p.8]:** Dashboard (per portal), Reports (per portal), System Settings (Super Admin/Admin; Pharmacy Super Admin has a Pharmacy-scoped equivalent).

**Shared UI conventions [CONFIRMED — verbatim, D17 p.2]:**
- Report pages: **From Date + To Date**, quick date presets, report-specific filters, **PDF, Excel, Print** export — every export respects active filters.
- Transactional pages: search + filters + status badges + pagination/result count.
- **No standalone Roles & Permissions, Login Activity, or Audit Logs pages** in HMS navigation (D17 p.2) — see §16 Conflict C1 for the implication on the underlying audit *data model*, which must still exist.

**System Settings content [CONFIRMED, D17 p.8]:** General settings, invoice/receipt settings, import/export configuration, backup placeholder, currency/rounding method (D15 §15), configurable system defaults — *"no hard-coded fake hospital identity."*

**Dashboard content by portal [CONFIRMED, D17 p.4, p.7, p.9, p.11]:** Hospital KPIs, patient/operations summary, billing/collections, occupancy, inventory/pharmacy summaries, alerts, recent activity (Super Admin/Admin); today's appointments/collections/outstanding/cash position (Front Desk); planned/active admissions, bed occupancy, payment/Pharmacy alerts, discharge readiness (Admission); stock value/low-stock/pending requests/supplier outstanding/cash position (Inventory); Pharmacy sales KPIs, stock/batch alerts, supplier outstanding, cash settlements, HMS integration alerts (Pharmacy Super Admin); medicine stock KPIs, low/out stock, near-expiry, HMS requests, supplier outstanding (Pharmacy Manager); assigned HMS requests, today's sales, cash/online totals, returns, expected cash (Sales/Dispensing).

**Acceptance criteria:**
- [ ] Every report's PDF/Excel/Print output reflects only the currently-applied filters, byte-for-byte consistent with the on-screen result set.
- [ ] Hospital Profile fields left unset render literally as "Not configured" in every export, never blank/omitted/fabricated.

---

## 5. End-to-End Workflows

Fifteen cross-portal flows are enumerated in D11 ("Complete Workflow Architecture"). They are consolidated below into 8 documented end-to-end workflows (merging tightly-coupled steps, e.g. D11 flows 7+8 into one Medication Fulfillment workflow) with full trigger/actor/precondition/processing/status/notification/error/outcome structure. Mermaid diagrams are included only for the three flows where the branching genuinely benefits from a diagram.

### 5.1 Workflow: Staff → Attendance → Salary (D11 flow 1; D16 p.19–20)

| Field | Detail |
|---|---|
| Trigger | Scheduled payroll run or manual "Generate Salary" action by Admin/Super Admin |
| Actor | Device adapter (automatic), Admin/Super Admin (review/correction/generation) |
| Preconditions | Staff has an active Salary Profile; shift assigned; attendance period closed |
| User actions | Import/sync device punches → review Day view → correct exceptions with reason → approve attendance → select period (Day/Monthly/Custom) → Generate Salary → Review → Approve → Pay (Full/Partial/Later) |
| Backend processing | Normalize raw punches against shift schedule (grace, overnight handling) → compute Late/Early/Worked minutes (§4.3) → on approval, freeze attendance for the period → compute Generated Salary (§4.4 formula) snapshotting all inputs |
| DB changes | INSERT `attendance_raw_punches` → INSERT/UPDATE `attendance_records` (status transitions) → INSERT `attendance_corrections` (immutable, if corrected) → INSERT `salary_batches` + `salary_batch_lines` (snapshot) → INSERT `salary_payments` on pay |
| Status transitions | Attendance: `RAW → NORMALIZED → REVIEWED → APPROVED`. Salary: `DRAFT → GENERATED → APPROVED → PARTIALLY_PAID/PAID`. |
| Notifications | Missing-punch alert; salary generated (pending approval); salary paid |
| Error cases | Device sync failure → raw punches remain in staging, retry queue; attempt to generate salary against un-approved attendance → rejected with `422` |
| Final outcome | Approved, auditable Salary statement with independent Full/Partial/Later payment history; Doctor Commission untouched |

### 5.2 Workflow: Doctor Service → Commission (D11 flow 2; D16 p.21)

| Field | Detail |
|---|---|
| Trigger | A billed service line reaches "Completed" status with an attached doctor and an active commission rule |
| Actor | System (accrual), Admin/Super Admin (generate/approve/pay) |
| Preconditions | Doctor has a commission rule (doctor-specific or department-default) effective at service date |
| User actions | Select doctor + period (Day/Month/Custom) → Generate Commission → Review → Approve → Pay (Full/Partial/Later) |
| Backend processing | Resolve applicable rule (doctor-specific overrides department default) → compute commission per line (Fixed or % of Net/Gross per §4.5) → lock each included line against re-inclusion |
| DB changes | INSERT `commission_statements` + `commission_statement_lines` (each line FK's exactly one `invoice_line_id`, UNIQUE constraint prevents duplicate inclusion) → INSERT `commission_payments` |
| Status transitions | `ACCRUED → GENERATED → APPROVED → PARTIALLY_PAID/PAID` |
| Notifications | Commission generated (pending approval); commission paid |
| Error cases | Attempt to include an already-committed service line → rejected by unique constraint; refund after payment → creates reversal, does not delete |
| Final outcome | Independently payable Commission Outstanding balance, never merged with Salary Outstanding |

### 5.3 Workflow: OPD Appointment → Encounter → Billing (D11 flow 3–4; D16 p.8–9, p.23)

```mermaid
flowchart TD
    A[Front Desk: Book Appointment] --> B{Advance collected?}
    B -- Yes --> C[Receipt issued, Advance recorded]
    B -- No --> D[Status: Booked / Unpaid]
    C --> E[Patient Check-In]
    D --> E
    E --> F[Convert to OPD/OBS/ER Encounter]
    F --> G[Add Services]
    G --> H{Discount requested?}
    H -- Yes, within threshold --> I[Apply Discount]
    H -- Yes, above threshold --> J[Route for Admin/Super Admin Approval]
    J --> I
    H -- No --> K[Generate Hospital Invoice]
    I --> K
    K --> L[Adjust Advance Against Invoice]
    L --> M[Collect Remaining Balance]
    M --> N[Issue Receipt]
    N --> O{Service completed with doctor?}
    O -- Yes --> P[Trigger Commission Accrual - Workflow 5.2]
    O -- No --> Q[Close Encounter]
    P --> Q
```

| Field | Detail |
|---|---|
| Trigger | Front Desk creates a new appointment or walk-in |
| Actor | Front Desk/Billing user |
| Preconditions | Department/doctor/service configured and active; patient identified (Panel search or temporary identity capture) |
| Backend processing | Slot availability check → advance/payment recording → check-in conversion (appointment → encounter, same underlying case record) → service line addition with rate snapshot → discount policy check → invoice totals per §4.6 formulas → payment application (advance offset first, then new payment) |
| DB changes | INSERT `appointments` → UPDATE status on check-in → INSERT `encounters` (linked `appointment_id` nullable for walk-ins) → INSERT `invoice_lines` → INSERT `invoices` → INSERT `payments`/`receipts` |
| Status transitions | Appointment: `DRAFT → CONFIRMED → CHECKED_IN → COMPLETED` (exceptions: `RESCHEDULED`/`CANCELLED`/`NO_SHOW`). Invoice: `UNPAID → PARTIALLY_PAID → PAID`. |
| Notifications | Discount pending approval (Admin/Super Admin) |
| Error cases | Attempt to check in an already-completed/cancelled appointment → `409 Conflict`; discount above threshold submitted without approval → invoice completion blocked |
| Final outcome | Closed encounter with a fully reconciled invoice, advance correctly adjusted, commission accrual triggered if applicable |

### 5.4 Workflow: Planned Admission → Active Admission → Two-Bill Discharge (D11 flow 5–9; D16 p.10–13, p.24)

```mermaid
flowchart TD
    A[Doctor recommends admission] --> B[Admission: Create Planned Admission]
    B --> C{Advance required?}
    C -- Yes --> D[Admission: Request Advance]
    D --> E[Billing: Collect Advance, Issue Receipt]
    E --> F[Payment status synced back to Admission]
    C -- No --> F
    F --> G[Patient Arrives: Confirm Arrival]
    G --> H[Assign Bed - status becomes Occupied]
    H --> I[Active Admission: add Services/Procedures/Tests]
    I --> J[Running Hospital Bill grows]
    J --> K{Payment needed?}
    K -- Yes --> L[Admission: Request Payment]
    L --> M[Billing: Collect Partial Payment]
    M --> N[Status synced back to Admission]
    N --> J
    K -- No --> O[Medication Mode?]
    J --> O
    O -- SELF --> P[No Pharmacy request]
    O -- HOSPITAL MANAGED --> Q[Admission: Create Medicine Request]
    Q --> R[Pharmacy: Accept/Partial/Reject, FEFO Dispense]
    R --> S[Pharmacy Invoice generated]
    S --> T[Pharmacy Clearance status returned]
    P --> U[Clinical Ready?]
    T --> U
    U -- No --> U
    U -- Yes --> V{Hospital Billing Clearance granted?}
    V -- No --> W[Front Desk collects final balance]
    W --> V
    V -- Yes --> X{Pharmacy Clearance granted or N/A?}
    X -- No --> R
    X -- Yes --> Y[Final Discharge]
```

| Field | Detail |
|---|---|
| Trigger | Doctor recommends admission |
| Actor | Admission, Front Desk/Billing, Pharmacy (Manager/Sales-Dispensing) |
| Preconditions | Ward/Room/Bed hierarchy configured; patient identified |
| Backend processing | Estimate creation → optional advance request/collection (never by Admission) → bed reservation vs. occupancy state separation → running-bill accumulation from service postings → medication-mode gated medicine request creation → FEFO dispense in Pharmacy → dual clearance evaluation gate |
| DB changes | INSERT `admissions` (status Planned) → INSERT `payment_requests` (fulfilled by Billing via `payments`) → UPDATE `admissions.status = ACTIVE`, UPDATE `beds.status = OCCUPIED` → INSERT `admission_service_lines` → INSERT `medication_mode_changes` on any mode switch → INSERT `pharmacy_requests` → INSERT `discharge_clearances` (3 rows: clinical, hospital_billing, pharmacy) |
| Status transitions | Admission: `PLANNED → CONFIRMED → ACTIVE → DISCHARGE_PENDING → DISCHARGED`. Clearance: `PENDING → CLEARED` per clearance type. |
| Notifications | Payment request raised (Billing), medicine request status changed (Admission), discharge blocked (Admission dashboard alert) |
| Error cases | Discharge attempted with any clearance `PENDING` → API returns `422` with the specific blocking clearance(s) named; medication mode switched to SELF while a Pharmacy request is `DISPENSED` → only pending lines cancel, dispensed lines remain billed |
| Final outcome | Two independent, permanently separate bills (Hospital, Pharmacy) both cleared; bed released; admission closed |

### 5.5 Workflow: Universal Cash Settlement (D11 flow 12–14; D16 p.15–16)

```mermaid
flowchart LR
    A[Opening Float / Petty Cash] --> B[Cash Collections/Purchases/Sales]
    B --> C[Cash Refunds / Approved Expenses]
    C --> D[Expected Cash computed]
    D --> E[User: Physical Cash Count]
    E --> F{Variance?}
    F -- Yes --> G[Variance recorded with reason]
    F -- No --> H[Prepare Settlement]
    G --> H
    H --> I[User Submits Settlement]
    I --> J[Reviewer: Review expected vs physical vs included transactions]
    J --> K{Decision}
    K -- Accept --> L[Custody transfers to receiver; balance = 0]
    K -- Partial Accept --> M[Accepted portion transfers; remainder stays with user]
    K -- Return/Reject --> N[Full balance stays with user; resubmission required]
```

| Field | Detail |
|---|---|
| Trigger | User (Front Desk/Billing, Inventory, or Pharmacy Sales/Dispensing) selects an unsettled period to close |
| Actor | The cash-handling user (submitter), Admin/Super Admin or Pharmacy Super Admin/Manager (reviewer) |
| Preconditions | User holds at least one cash-handling transaction not already included in an accepted settlement |
| Backend processing | Compute Expected Cash per module-specific formula (§4.9) → user enters physical count → compute variance → on submit, lock the selected transaction set against re-inclusion → on review decision, execute custody transfer or leave open |
| DB changes | INSERT `account_settlements` (status `SUBMITTED`) → link `settlement_transactions` (each references a source transaction, marked `settled = true` only on **Accept**) → UPDATE `account_settlements.status` on decision → INSERT `settlement_reviews` (reviewer, decision, remarks, timestamp) |
| Status transitions | `PREPARED → SUBMITTED → ACCEPTED / PARTIALLY_ACCEPTED / RETURNED / REJECTED` |
| Notifications | Settlement submitted (reviewer); decision made (submitter); variance above threshold (management) |
| Error cases | Attempt to submit a settlement including an already-settled transaction → rejected at the DB level (unique partial index, §6.6); attempt to submit another user's transactions → rejected by ownership check |
| Final outcome | Cash custody accurately transferred with a permanent variance/audit record; never posted as revenue or expense |

### 5.6 Workflow: HMS Inventory Procurement & Issue (D11 flow 10–11; D16 p.17–18)

| Field | Detail |
|---|---|
| Trigger | Low-stock alert or manual Purchase Request by Inventory user |
| Actor | Inventory Management user, Admin/Super Admin (fund approval) |
| Preconditions | Item Master exists; Supplier Master exists (for purchase) |
| User actions | Create Purchase Request → (if underfunded) submit Fund Request → Admin/Super Admin approves → record Purchase/Goods Receipt (supplier, items, qty, rate, payment method) → post to Stock Ledger |
| Backend processing | Validate stock non-negativity on any OUT movement → post Stock Ledger IN with running balance → post/update Supplier Ledger per payment method (§4.8 table) → on Department Issue, decrement stock and record department/issuing user |
| DB changes | INSERT `purchase_requests`, `fund_requests` → INSERT `inventory_purchases` + `inventory_stock_ledger` (IN) + `inventory_supplier_ledger` → INSERT `department_issues` + `inventory_stock_ledger` (OUT) |
| Status transitions | Purchase Request: `DRAFT → SUBMITTED → APPROVED → PURCHASED → RECEIVED`. Fund Request: `SUBMITTED → APPROVED/REJECTED`. |
| Notifications | Fund request submitted/approved; low-stock/reorder alert |
| Error cases | Department Issue exceeding available stock → rejected unless controlled-exception flag set |
| Final outcome | Reconciled Stock Ledger and Supplier Ledger, correctly reflecting cash effect only for the paying user |

### 5.7 Workflow: HMS Admission ↔ Pharmacy Medicine Request Integration (D11 flow 8; D16 p.14, p.24)

| Field | Detail |
|---|---|
| Trigger | Admission sets Medication Mode = HOSPITAL MANAGED and creates a medicine request |
| Actor | Admission (requester), Pharmacy Manager/Sales-Dispensing (fulfillers) |
| Preconditions | Admission is `ACTIVE`; medicine exists in Pharmacy's Medicine Master |
| Backend processing | Create request with stable `admission_id` + `medicine_request_id` + patient/case reference → Pharmacy checks stock → Accept/Partially Fulfill/Reject → FEFO batch allocation → dispense posts `pharmacy_stock_ledger` OUT → generate Pharmacy invoice → send idempotent status callback to HMS |
| DB changes | INSERT `pharmacy_requests` (HMS-visible) → INSERT `pharmacy_request_lines` → INSERT `pharmacy_stock_ledger` (OUT, batch-referenced) → INSERT `pharmacy_invoices` → UPDATE `pharmacy_requests.hms_status` via idempotent callback (keyed by `medicine_request_id`, deduplicated) |
| Status transitions | `REQUESTED → ACCEPTED/PARTIALLY_FULFILLED/REJECTED → DISPENSING → DISPENSED → INVOICED → CLEARANCE_SENT`; failure path → `INTEGRATION_ERROR` (retryable) |
| Notifications | Request received (Pharmacy), status change (Admission) |
| Error cases | Duplicate callback for the same `medicine_request_id` → detected via idempotency key, no double stock/charge effect; callback delivery failure → retried with backoff, visible as `INTEGRATION_ERROR` until resolved |
| Final outcome | Admission's Pharmacy Clearance state reflects the true, final Pharmacy-side outcome; no medicine stock or Pharmacy invoice data is duplicated into HMS tables |

### 5.8 Workflow: Staff Profile Reporting (D11 flow 15; D16 p.32)

| Field | Detail |
|---|---|
| Trigger | Super Admin/Admin opens a Staff 360° profile or runs an individual report |
| Actor | Super Admin, Admin |
| Preconditions | Staff record exists |
| Backend processing | Aggregate queries across `attendance_records`, `salary_batches`, `commission_statements`, `employment_history` scoped by `staff_id`, respecting the active date filter |
| DB changes | Read-only |
| Final outcome | Consolidated 360° view with drill-down into Attendance Report, Salary Report, Commission Report, and Employment/Shift history, ready for the same reuse pattern a future Staff Portal would use |

---

## 6. PostgreSQL Database Design

**[RECOMMENDATION — mandatory stack]** Everything in this section is a proposed implementation design; no source PDF specifies column-level schema. It is derived directly from the fields, statuses, formulas, and business rules documented in §4–§5, using the mandated PostgreSQL database.

### 6.1 Conventions

| Aspect | Convention | Rationale |
|---|---|---|
| Table names | `snake_case`, plural (`invoices`, `stock_ledger_entries`) | PostgreSQL/Node ecosystem norm |
| Column names | `snake_case` | Consistency with table names |
| Primary keys | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` on every table | Non-sequential IDs are safe to expose in REST URLs and merge cleanly across environments/migrations; requires `pgcrypto` extension (`CREATE EXTENSION IF NOT EXISTS pgcrypto;`) |
| Foreign keys | `<singular_referenced_table>_id`, e.g. `department_id`, `staff_id` | Predictable joins |
| Money | `NUMERIC(14,2)` | Exact decimal arithmetic; matches D15 §15 "currency precision and rounding method are system settings" — precision configurable via `system_settings`, default 2dp |
| Quantity | `NUMERIC(14,3)` | Supports fractional units (e.g. ml, mg) without floating-point error |
| Timestamps | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Timezone-safe; app stores UTC, renders in hospital's configured timezone (§11.13) |
| Audit columns | `created_at`, `created_by UUID REFERENCES portal_users(id)`, `updated_at`, `updated_by UUID REFERENCES portal_users(id)` on every mutable table | D16 p.22: every action attributed to the real actor |
| Soft delete | Master/config tables: `is_active BOOLEAN NOT NULL DEFAULT true` (Activate/Deactivate, never a hard DELETE). **Transactional/ledger tables: no delete of any kind** — correction is a new adjustment/reversal row (D16 p.27; D15 §15) |
| Status fields | Native PostgreSQL `ENUM` types (`CREATE TYPE x_status AS ENUM (...)`) for closed, client-approved status sets; see §6.2 Enum Strategy for the migration trade-off |
| Enum extension | New enum values via `ALTER TYPE ... ADD VALUE` (see migration strategy, §6.11) |
| Ledger pattern | Ledger tables (`*_stock_ledger`, cash transactions) store a **signed quantity/amount delta only**; running balance is computed via `SUM(...) OVER (PARTITION BY ... ORDER BY created_at)` at query/report time, never stored as a mutable running total — avoids write-time race conditions on concurrent postings (§12.3 tests this invariant) |
| Idempotency | Any table fed by an external/cross-system callback (Pharmacy↔HMS) carries a `UNIQUE` idempotency key (§6.10) |

### 6.2 Enum Strategy

**[RECOMMENDATION]** Native Postgres ENUMs are used for stable, client-confirmed status sets (few, well-understood values, e.g. `appointment_status`). For status sets still subject to configuration (e.g., custom attendance exception types, discount reason categories) a **lookup table** (`<domain>_types`) is used instead, so Admin/Super Admin can add values through System Settings without a migration. Rule of thumb applied throughout §6.3–§6.10: *if the source document enumerates a fixed, small set of values with explicit business meaning attached to each → ENUM; if the source says "reason", "category", or "configurable" → lookup table.*

Core enums:

```sql
CREATE TYPE portal_role AS ENUM (
  'SUPER_ADMIN','ADMIN','FRONT_DESK_BILLING','ADMISSION','INVENTORY_MANAGEMENT',
  'PHARMACY_SUPER_ADMIN','PHARMACY_MANAGER','PHARMACY_SALES_DISPENSING'
);
CREATE TYPE portal_user_status AS ENUM ('ACTIVE','SUSPENDED');
CREATE TYPE staff_employment_status AS ENUM ('ACTIVE','INACTIVE','TERMINATED');
CREATE TYPE attendance_status AS ENUM ('PRESENT','ABSENT','LATE','EARLY_EXIT','MISSING_PUNCH','LEAVE');
CREATE TYPE salary_status AS ENUM ('DRAFT','GENERATED','APPROVED','PARTIALLY_PAID','PAID');
CREATE TYPE commission_basis AS ENUM ('GROSS','NET');
CREATE TYPE commission_rule_type AS ENUM ('FIXED_PER_SERVICE','PERCENTAGE');
CREATE TYPE commission_status AS ENUM ('ACCRUED','GENERATED','APPROVED','PARTIALLY_PAID','PAID');
CREATE TYPE patient_type AS ENUM ('PANEL','SELF_PAY');
CREATE TYPE appointment_status AS ENUM ('DRAFT','CONFIRMED','CHECKED_IN','COMPLETED','RESCHEDULED','CANCELLED','NO_SHOW');
CREATE TYPE encounter_type AS ENUM ('OPD','OBSERVATION','EMERGENCY');
CREATE TYPE invoice_status AS ENUM ('UNPAID','PARTIALLY_PAID','PAID','VOID');
CREATE TYPE payment_method AS ENUM ('CASH','CARD','BANK','ONLINE');
CREATE TYPE admission_status AS ENUM ('PLANNED','CONFIRMED','ACTIVE','DISCHARGE_PENDING','DISCHARGED','CANCELLED');
CREATE TYPE bed_status AS ENUM ('AVAILABLE','RESERVED','OCCUPIED','OUT_OF_SERVICE');
CREATE TYPE medication_mode AS ENUM ('SELF','HOSPITAL_MANAGED');
CREATE TYPE clearance_type AS ENUM ('CLINICAL','HOSPITAL_BILLING','PHARMACY');
CREATE TYPE clearance_status AS ENUM ('PENDING','CLEARED','NOT_APPLICABLE');
CREATE TYPE stock_movement_type AS ENUM (
  'PURCHASE_RECEIPT','DEPARTMENT_RETURN','TRANSFER_IN','POSITIVE_ADJUSTMENT',
  'DEPARTMENT_ISSUE','SUPPLIER_RETURN','TRANSFER_OUT','NEGATIVE_ADJUSTMENT'
);
CREATE TYPE purchase_payment_method AS ENUM ('PETTY_CASH','MANAGEMENT_DIRECT','ONLINE','CREDIT');
CREATE TYPE request_status AS ENUM ('DRAFT','SUBMITTED','APPROVED','REJECTED');
CREATE TYPE settlement_status AS ENUM ('PREPARED','SUBMITTED','ACCEPTED','PARTIALLY_ACCEPTED','RETURNED','REJECTED');
CREATE TYPE pharmacy_request_status AS ENUM (
  'REQUESTED','ACCEPTED','PARTIALLY_FULFILLED','REJECTED','DISPENSING','DISPENSED',
  'INVOICED','CLEARANCE_SENT','INTEGRATION_ERROR'
);
CREATE TYPE pharmacy_sale_channel AS ENUM ('RETAIL','HMS_LINKED');
```

### 6.3 Entity-Relationship Overview

The schema is organized into eight bounded domains. Foreign keys cross domain boundaries only where the source explicitly requires a hand-off (e.g., `admissions.patient_id → patients.id`, `pharmacy_requests.admission_id → admissions.id`); HMS Inventory and Pharmacy Inventory share **no** foreign keys, by design (§4.8, §4.10).

```mermaid
erDiagram
    STAFF ||--o| PORTAL_USERS : "linked via staff_id (optional)"
    STAFF ||--o{ ATTENDANCE_RECORDS : "has"
    STAFF ||--o{ SALARY_BATCH_LINES : "paid via"
    STAFF ||--o{ COMMISSION_STATEMENT_LINES : "earns (doctors)"
    DEPARTMENTS ||--o{ STAFF : "employs"
    DEPARTMENTS ||--o{ WARDS : "contains"
    WARDS ||--o{ ROOMS : "contains"
    ROOMS ||--o{ BEDS : "contains"
    PATIENTS ||--o{ APPOINTMENTS : "books"
    PATIENTS ||--o{ ADMISSIONS : "admitted as"
    APPOINTMENTS ||--o| ENCOUNTERS : "converts to"
    ENCOUNTERS ||--o{ INVOICE_LINES : "bills"
    ADMISSIONS ||--o{ ADMISSION_SERVICE_LINES : "accrues"
    ADMISSIONS ||--o{ PAYMENT_REQUESTS : "raises"
    ADMISSIONS ||--o{ PHARMACY_REQUESTS : "raises (bridge)"
    ADMISSIONS ||--o{ DISCHARGE_CLEARANCES : "requires"
    INVOICES ||--o{ INVOICE_LINES : "contains"
    INVOICES ||--o{ PAYMENTS : "settled by"
    PORTAL_USERS ||--o{ CASH_TRANSACTIONS : "handles"
    PORTAL_USERS ||--o{ ACCOUNT_SETTLEMENTS : "submits"
    PHARMACY_MEDICINES ||--o{ PHARMACY_BATCHES : "tracked in"
    PHARMACY_BATCHES ||--o{ PHARMACY_STOCK_LEDGER : "moves in"
    PHARMACY_REQUESTS ||--o{ PHARMACY_REQUEST_LINES : "contains"
    PHARMACY_REQUEST_LINES ||--o| PHARMACY_STOCK_LEDGER : "dispensed via"
    INVENTORY_ITEMS ||--o{ INVENTORY_STOCK_LEDGER : "moves in"
    INVENTORY_SUPPLIERS ||--o{ INVENTORY_PURCHASES : "supplies"
```

Domain groupings used in §6.4–§6.10:

| Domain | Tables |
|---|---|
| A. Identity & Access | `portal_users`, `staff`, `staff_employment_history`, `refresh_tokens` |
| B. Hospital Setup | `hospital_profile`, `departments`, `services`, `wards`, `rooms`, `beds`, `panels`, `panel_discount_rules`, `shifts`, `system_settings` |
| C. Attendance & Payroll | `attendance_raw_punches`, `attendance_records`, `attendance_corrections`, `staff_salary_profiles`, `salary_batches`, `salary_batch_lines`, `salary_payments` |
| D. Doctor Commission | `staff_commission_rules`, `commission_statements`, `commission_statement_lines`, `commission_payments`, `commission_reversals` |
| E. Patients, Appointments & Billing | `patients`, `appointments`, `encounters`, `invoices`, `invoice_lines`, `payments`, `receipts`, `discounts`, `refunds` |
| F. Admission | `admissions`, `admission_service_lines`, `bed_transfers`, `medication_mode_changes`, `payment_requests`, `discharge_clearances`, `discharge_summaries` |
| G. HMS Inventory | `inventory_items`, `inventory_categories`, `inventory_units`, `inventory_suppliers`, `inventory_stock_locations`, `inventory_purchase_requests`, `inventory_fund_requests`, `inventory_purchases`, `inventory_purchase_lines`, `inventory_stock_ledger`, `inventory_supplier_ledger`, `department_issues`, `department_issue_lines`, `inventory_stock_transfers`, `inventory_supplier_returns`, `inventory_adjustments`, `inventory_expenses` |
| H. Standalone Pharmacy | `pharmacy_medicines`, `pharmacy_medicine_categories`, `pharmacy_suppliers`, `pharmacy_locations`, `pharmacy_purchases`, `pharmacy_purchase_lines`, `pharmacy_batches`, `pharmacy_stock_ledger`, `pharmacy_supplier_ledger`, `pharmacy_transfers`, `pharmacy_returns`, `pharmacy_adjustments`, `pharmacy_sales`, `pharmacy_sale_lines`, `pharmacy_payments`, `pharmacy_requests`, `pharmacy_request_lines` |
| I. Universal Cash Accountability | `cash_transactions`, `petty_cash_issues`, `account_settlements`, `settlement_transactions`, `settlement_reviews` |
| J. Cross-cutting / System | `audit_logs`, `notifications`, `file_attachments`, `integration_events` |

### 6.4 Domain A — Identity & Access

```sql
CREATE TABLE staff (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code       VARCHAR(30) NOT NULL UNIQUE,          -- system-generated, see §16 Q-01
  full_name           VARCHAR(150) NOT NULL,
  category            VARCHAR(50) NOT NULL,                  -- Doctor/Nurse/Technician/... (lookup table `staff_categories`, ASSUMPTION)
  department_id       UUID NOT NULL REFERENCES departments(id),
  designation         VARCHAR(100) NOT NULL,
  phone               VARCHAR(30) NOT NULL,
  email               VARCHAR(150),
  joining_date        DATE NOT NULL,
  employment_status   staff_employment_status NOT NULL DEFAULT 'ACTIVE',
  current_shift_id    UUID REFERENCES shifts(id),
  notes               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID REFERENCES portal_users(id)
);

CREATE TABLE staff_employment_history (   -- effective-dated department/designation/shift changes (D16 p.4)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  department_id UUID NOT NULL REFERENCES departments(id),
  designation VARCHAR(100) NOT NULL,
  shift_id UUID REFERENCES shifts(id),
  effective_from DATE NOT NULL,
  effective_to DATE,                       -- NULL = current
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id)
);

CREATE TABLE portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id),        -- nullable: "No Portal Access" is valid on the staff side;
                                              -- every portal_users row SHOULD reference staff for operational roles (§16 Q-02)
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(150) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,       -- Argon2id, never plaintext (§6.9)
  role portal_role NOT NULL,
  status portal_user_status NOT NULL DEFAULT 'ACTIVE',
  is_protected BOOLEAN NOT NULL DEFAULT false, -- true for SUPER_ADMIN / PHARMACY_SUPER_ADMIN rows (§3.2)
  is_cash_handling BOOLEAN NOT NULL DEFAULT false,
  must_reset_password BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID REFERENCES portal_users(id),
  CONSTRAINT chk_protected_role CHECK (
    (role IN ('SUPER_ADMIN','PHARMACY_SUPER_ADMIN') AND is_protected = true) OR
    (role NOT IN ('SUPER_ADMIN','PHARMACY_SUPER_ADMIN'))
  )
);

CREATE TABLE refresh_tokens (              -- session-based auth, §6.9 / §7.8
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id UUID NOT NULL REFERENCES portal_users(id),
  token_hash VARCHAR(255) NOT NULL UNIQUE,   -- store only the hash, never the raw token
  user_agent TEXT, ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Business-rule enforcement beyond DDL [RECOMMENDATION]:** "cannot remove the last active Super Admin" (§3.2) cannot be expressed as a single-table CHECK constraint (it is an aggregate condition); enforce it in the service layer inside the same transaction as the deactivation, with `SELECT COUNT(*) ... FOR UPDATE` locking to prevent a race between two concurrent deactivations.

### 6.5 Domain B — Hospital Setup

```sql
CREATE TABLE hospital_profile (            -- singleton row
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200), contact_phone VARCHAR(30), contact_email VARCHAR(150),
  address TEXT, working_hours TEXT, logo_url TEXT,
  billing_legal_metadata JSONB,             -- tax ID, license no., etc. — schema-flexible, may be "Not configured"
  currency_code VARCHAR(3) NOT NULL DEFAULT 'PKR',
  rounding_mode VARCHAR(20) NOT NULL DEFAULT 'ROUND_HALF_UP',
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Karachi',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID REFERENCES portal_users(id)
);

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
  head_staff_id UUID REFERENCES staff(id),
  department_type VARCHAR(30) NOT NULL,      -- CLINICAL / ADMINISTRATIVE
  supports_opd BOOLEAN DEFAULT false, supports_admission BOOLEAN DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID REFERENCES portal_users(id)
);

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id),
  category VARCHAR(50), billing_unit VARCHAR(30) NOT NULL,
  standard_rate NUMERIC(14,2) NOT NULL CHECK (standard_rate >= 0),
  panel_eligible BOOLEAN NOT NULL DEFAULT false,
  discount_allowed BOOLEAN NOT NULL DEFAULT true,
  manual_rate_override_allowed BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID REFERENCES portal_users(id)
);

CREATE TABLE wards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id),
  name VARCHAR(100) NOT NULL, ward_type VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id)
);
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id UUID NOT NULL REFERENCES wards(id),
  name VARCHAR(100) NOT NULL, room_type VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id)
);
CREATE TABLE beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id),
  bed_number VARCHAR(20) NOT NULL, daily_rate NUMERIC(14,2) NOT NULL DEFAULT 0,
  status bed_status NOT NULL DEFAULT 'AVAILABLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID REFERENCES portal_users(id),
  UNIQUE(room_id, bed_number)
);

CREATE TABLE panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name VARCHAR(200) NOT NULL, contact TEXT, address TEXT, notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id)
);
CREATE TABLE panel_discount_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id UUID NOT NULL REFERENCES panels(id),
  service_id UUID NOT NULL REFERENCES services(id),
  discount_percent NUMERIC(5,2) CHECK (discount_percent BETWEEN 0 AND 100),
  effective_from DATE NOT NULL, effective_to DATE,
  UNIQUE(panel_id, service_id, effective_from)
);

CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id),
  name VARCHAR(100) NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL,
  break_minutes INT NOT NULL DEFAULT 0, grace_minutes INT NOT NULL DEFAULT 0,
  late_rule JSONB, early_exit_rule JSONB,       -- fixed-per-event vs. per-minute vs. slab, per §4.4
  weekly_off VARCHAR(20)[],                      -- e.g. {'FRIDAY'}
  is_overnight BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id)
);

CREATE TABLE system_settings (              -- key/value config store, §7.4
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID REFERENCES portal_users(id)
);
```

### 6.6 Domain C — Attendance & Payroll

```sql
CREATE TABLE attendance_raw_punches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  device_source VARCHAR(50) NOT NULL,        -- adapter identifier (API/SDK/LAN/FILE) §16 Q-03
  punch_at TIMESTAMPTZ NOT NULL,
  raw_payload JSONB,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  shift_id UUID NOT NULL REFERENCES shifts(id),
  attendance_date DATE NOT NULL,
  actual_in TIMESTAMPTZ, actual_out TIMESTAMPTZ,
  late_minutes INT NOT NULL DEFAULT 0, early_exit_minutes INT NOT NULL DEFAULT 0,
  worked_minutes INT NOT NULL DEFAULT 0,
  status attendance_status NOT NULL DEFAULT 'ABSENT',
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES portal_users(id), approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id, attendance_date)
);

CREATE TABLE attendance_corrections (       -- immutable append-only, D16 p.19/p.33
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id UUID NOT NULL REFERENCES attendance_records(id),
  original_value JSONB NOT NULL, corrected_value JSONB NOT NULL,
  reason TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES portal_users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE staff_salary_profiles (        -- staff-specific, effective-dated (D16 p.33)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  salary_basis VARCHAR(20) NOT NULL,          -- MONTHLY / PER_DAY / other approved basis
  base_amount NUMERIC(14,2) NOT NULL CHECK (base_amount >= 0),
  payroll_divisor INT NOT NULL DEFAULT 30,
  deduction_rules JSONB NOT NULL DEFAULT '{}', -- {late: {...}, early_exit: {...}, absence: {...}}
  allowance_rules JSONB NOT NULL DEFAULT '{}',
  effective_from DATE NOT NULL, effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id)
);

CREATE TABLE salary_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  period_type VARCHAR(20) NOT NULL,           -- PER_DAY / MONTHLY / CUSTOM
  period_start DATE NOT NULL, period_end DATE NOT NULL,
  base_amount NUMERIC(14,2) NOT NULL, allowances NUMERIC(14,2) NOT NULL DEFAULT 0,
  attendance_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
  adjustments NUMERIC(14,2) NOT NULL DEFAULT 0,
  generated_amount NUMERIC(14,2) NOT NULL,     -- snapshot result of §4.4 formula
  calculation_snapshot JSONB NOT NULL,         -- full inputs used, per D15 §15 "snapshot the calculation inputs"
  status salary_status NOT NULL DEFAULT 'DRAFT',
  approved_by UUID REFERENCES portal_users(id), approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id)
);
CREATE TABLE salary_batch_lines (            -- per-component breakdown for reporting/print slip
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_batch_id UUID NOT NULL REFERENCES salary_batches(id),
  component_type VARCHAR(30) NOT NULL,        -- BASE/ABSENCE/LATE/EARLY_EXIT/ALLOWANCE/ADJUSTMENT
  description TEXT, amount NUMERIC(14,2) NOT NULL
);
CREATE TABLE salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_batch_id UUID NOT NULL REFERENCES salary_batches(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  method payment_method NOT NULL, reference VARCHAR(100),
  paid_by UUID NOT NULL REFERENCES portal_users(id), paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.7 Domain D — Doctor Commission

```sql
CREATE TABLE staff_commission_rules (        -- staff/service-specific, effective-dated (D16 p.21, p.33)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  service_id UUID REFERENCES services(id),    -- NULL = doctor-wide default
  rule_type commission_rule_type NOT NULL,
  rate NUMERIC(14,2) NOT NULL,                 -- percentage (0-100) or fixed amount, per rule_type
  basis commission_basis NOT NULL DEFAULT 'NET',
  effective_from DATE NOT NULL, effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id)
);

CREATE TABLE commission_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),  -- doctor
  period_type VARCHAR(20) NOT NULL, period_start DATE NOT NULL, period_end DATE NOT NULL,
  generated_amount NUMERIC(14,2) NOT NULL,
  status commission_status NOT NULL DEFAULT 'ACCRUED',
  approved_by UUID REFERENCES portal_users(id), approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id)
);
CREATE TABLE commission_statement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_statement_id UUID NOT NULL REFERENCES commission_statements(id),
  invoice_line_id UUID NOT NULL REFERENCES invoice_lines(id),
  commission_amount NUMERIC(14,2) NOT NULL,
  rule_snapshot JSONB NOT NULL,
  UNIQUE(invoice_line_id)                      -- enforces "included in only one statement" (D16 p.21)
);
CREATE TABLE commission_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_statement_id UUID NOT NULL REFERENCES commission_statements(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  method payment_method NOT NULL, reference VARCHAR(100),
  paid_by UUID NOT NULL REFERENCES portal_users(id), paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE commission_reversals (          -- refund/cancel after generation (D16 p.21)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_statement_line_id UUID NOT NULL REFERENCES commission_statement_lines(id),
  reversal_amount NUMERIC(14,2) NOT NULL, reason TEXT NOT NULL,
  reversed_by UUID NOT NULL REFERENCES portal_users(id), reversed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.8 Domain E — Patients, Appointments & Hospital Billing

```sql
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_type patient_type NOT NULL,
  full_name VARCHAR(150) NOT NULL, guardian_name VARCHAR(150), gender VARCHAR(20),
  dob DATE, cnic_or_passport VARCHAR(50), phone VARCHAR(30), address TEXT,
  panel_id UUID REFERENCES panels(id),         -- required if patient_type = PANEL
  panel_member_id VARCHAR(50),
  mr_number VARCHAR(30) UNIQUE,                 -- assigned only for PANEL (permanent, reusable) — D16 p.7
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id),
  CONSTRAINT chk_panel_fields CHECK (patient_type <> 'PANEL' OR panel_id IS NOT NULL)
);
-- NOTE: SELF_PAY rows are never deleted; "temporary identity" is a business/UX distinction
-- (not reused for future visits), not a data-retention rule — D16 p.7 explicitly requires
-- invoices/receipts/transaction snapshots to remain after closure.

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  department_id UUID NOT NULL REFERENCES departments(id),
  doctor_staff_id UUID NOT NULL REFERENCES staff(id),
  service_id UUID NOT NULL REFERENCES services(id),
  slot_at TIMESTAMPTZ NOT NULL,
  estimated_amount NUMERIC(14,2) NOT NULL,
  status appointment_status NOT NULL DEFAULT 'DRAFT',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID REFERENCES portal_users(id)
);

CREATE TABLE encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id),   -- NULL for direct walk-ins
  patient_id UUID NOT NULL REFERENCES patients(id),
  encounter_type encounter_type NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id),
  doctor_staff_id UUID REFERENCES staff(id),
  complaint_notes TEXT,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id)
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(30) NOT NULL UNIQUE,   -- sequence generated, §7 service layer
  source_type VARCHAR(20) NOT NULL,             -- ENCOUNTER / ADMISSION (polymorphic source)
  encounter_id UUID REFERENCES encounters(id),
  admission_id UUID REFERENCES admissions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0, discount_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0, paid_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'UNPAID',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id),
  CONSTRAINT chk_invoice_source CHECK (
    (source_type = 'ENCOUNTER' AND encounter_id IS NOT NULL) OR
    (source_type = 'ADMISSION' AND admission_id IS NOT NULL)
  )
);
CREATE TABLE invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  service_id UUID NOT NULL REFERENCES services(id),
  rate_snapshot NUMERIC(14,2) NOT NULL,          -- frozen at billing time, D15 §15
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  line_gross NUMERIC(14,2) NOT NULL, discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_net NUMERIC(14,2) NOT NULL,
  performed_by_staff_id UUID REFERENCES staff(id),  -- doctor, for commission accrual
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id),
  payment_request_id UUID REFERENCES payment_requests(id), -- admission advance/partial/final
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  method payment_method NOT NULL, reference VARCHAR(100),
  collected_by UUID NOT NULL REFERENCES portal_users(id), collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_reversed BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number VARCHAR(30) NOT NULL UNIQUE,
  payment_id UUID NOT NULL REFERENCES payments(id),
  printed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_line_id UUID NOT NULL REFERENCES invoice_lines(id),
  discount_percent NUMERIC(5,2), discount_amount NUMERIC(14,2),
  reason TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES portal_users(id),
  approved_by UUID REFERENCES portal_users(id), approved_at TIMESTAMPTZ,
  status request_status NOT NULL DEFAULT 'SUBMITTED'
);
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_payment_id UUID NOT NULL REFERENCES payments(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0), reason TEXT NOT NULL, method payment_method NOT NULL,
  status request_status NOT NULL DEFAULT 'SUBMITTED',
  requested_by UUID NOT NULL REFERENCES portal_users(id),
  approved_by UUID REFERENCES portal_users(id), approved_at TIMESTAMPTZ,
  paid_by UUID REFERENCES portal_users(id), paid_at TIMESTAMPTZ
);
```

### 6.9 Domain F — Admission

```sql
CREATE TABLE admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_number VARCHAR(30) NOT NULL UNIQUE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  department_id UUID NOT NULL REFERENCES departments(id),
  doctor_staff_id UUID NOT NULL REFERENCES staff(id),
  bed_id UUID REFERENCES beds(id),              -- NULL until Confirm Arrival / Admit
  status admission_status NOT NULL DEFAULT 'PLANNED',
  medication_mode medication_mode NOT NULL DEFAULT 'SELF',
  diagnosis TEXT, expected_at TIMESTAMPTZ, admitted_at TIMESTAMPTZ, discharged_at TIMESTAMPTZ,
  estimated_amount NUMERIC(14,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID REFERENCES portal_users(id)
);

CREATE TABLE admission_service_lines (        -- feeds the running Hospital Bill / invoices
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES admissions(id),
  invoice_line_id UUID REFERENCES invoice_lines(id),  -- posted charge, once billed
  service_id UUID NOT NULL REFERENCES services(id),
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  performed_by_staff_id UUID REFERENCES staff(id),
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(), posted_by UUID NOT NULL REFERENCES portal_users(id)
);

CREATE TABLE bed_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES admissions(id),
  from_bed_id UUID REFERENCES beds(id), to_bed_id UUID NOT NULL REFERENCES beds(id),
  reason TEXT, transferred_by UUID NOT NULL REFERENCES portal_users(id),
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE medication_mode_changes (        -- immutable audit trail (D16 p.12)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES admissions(id),
  previous_mode medication_mode NOT NULL, new_mode medication_mode NOT NULL,
  reason TEXT NOT NULL, changed_by UUID NOT NULL REFERENCES portal_users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_requests (               -- Admission → Billing hand-off (never holds cash itself)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES admissions(id),
  request_type VARCHAR(20) NOT NULL,            -- ADVANCE / PARTIAL / FINAL
  requested_amount NUMERIC(14,2) NOT NULL, notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING / FULFILLED / PARTIALLY_FULFILLED / CANCELLED
  requested_by UUID NOT NULL REFERENCES portal_users(id), requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE discharge_clearances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES admissions(id),
  clearance_type clearance_type NOT NULL,
  status clearance_status NOT NULL DEFAULT 'PENDING',
  cleared_by UUID REFERENCES portal_users(id), cleared_at TIMESTAMPTZ,
  UNIQUE(admission_id, clearance_type)
);

CREATE TABLE discharge_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL UNIQUE REFERENCES admissions(id),
  discharge_doctor_staff_id UUID REFERENCES staff(id),
  summary_notes TEXT,
  hospital_bill_total NUMERIC(14,2), pharmacy_bill_total NUMERIC(14,2), -- display-only consolidation, D16 p.13: "not a third accounting invoice"
  confirmed_by UUID NOT NULL REFERENCES portal_users(id), confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.10 Domain G/H — HMS Inventory & Standalone Pharmacy (parallel, non-intersecting schemas)

Both inventory systems follow the **same ledger pattern** independently — this symmetry is intentional and documents the "not duplicated" ownership rule (§4.8, §4.10) at the schema level: there is no shared `stock_ledger` table.

```sql
-- ===== HMS Inventory (non-medicine) =====
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
  category VARCHAR(50), unit VARCHAR(20) NOT NULL, reorder_level NUMERIC(14,3) NOT NULL DEFAULT 0,
  default_location_id UUID REFERENCES inventory_stock_locations(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id)
);
CREATE TABLE inventory_stock_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(100) NOT NULL,
  location_type VARCHAR(30), department_id UUID REFERENCES departments(id),
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE inventory_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(150) NOT NULL,
  contact VARCHAR(100), phone VARCHAR(30), address TEXT, terms TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE inventory_purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), requested_by UUID NOT NULL REFERENCES portal_users(id),
  status request_status NOT NULL DEFAULT 'DRAFT', priority VARCHAR(10), needed_by DATE,
  approved_by UUID REFERENCES portal_users(id), approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE inventory_fund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), requested_by UUID NOT NULL REFERENCES portal_users(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0), purpose TEXT, needed_date DATE,
  status request_status NOT NULL DEFAULT 'SUBMITTED',
  approved_by UUID REFERENCES portal_users(id), approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE inventory_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), supplier_id UUID NOT NULL REFERENCES inventory_suppliers(id),
  purchase_request_id UUID REFERENCES inventory_purchase_requests(id),
  invoice_reference VARCHAR(100), payment_method purchase_payment_method NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL, purchased_by UUID NOT NULL REFERENCES portal_users(id),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE inventory_purchase_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), purchase_id UUID NOT NULL REFERENCES inventory_purchases(id),
  item_id UUID NOT NULL REFERENCES inventory_items(id), quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  rate NUMERIC(14,2) NOT NULL CHECK (rate >= 0), location_id UUID NOT NULL REFERENCES inventory_stock_locations(id)
);
CREATE TABLE inventory_stock_ledger (         -- append-only, delta-only (§6.1 ledger pattern)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id), location_id UUID NOT NULL REFERENCES inventory_stock_locations(id),
  movement_type stock_movement_type NOT NULL,
  quantity_delta NUMERIC(14,3) NOT NULL,       -- signed: +IN / −OUT
  reference_table VARCHAR(50) NOT NULL, reference_id UUID NOT NULL,  -- polymorphic source (purchase/issue/transfer/adjustment)
  actor_id UUID NOT NULL REFERENCES portal_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_negative_stock CHECK (true)   -- non-negativity enforced by service-layer transaction check (§7.9), not a naive CHECK, to allow controlled-exception override
);
CREATE TABLE inventory_supplier_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), supplier_id UUID NOT NULL REFERENCES inventory_suppliers(id),
  entry_type VARCHAR(20) NOT NULL,             -- PURCHASE_CREDIT / PAYMENT / RETURN / CREDIT_NOTE
  amount NUMERIC(14,2) NOT NULL, reference_table VARCHAR(50), reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id)
);
CREATE TABLE department_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), department_id UUID NOT NULL REFERENCES departments(id),
  issued_by UUID NOT NULL REFERENCES portal_users(id), received_by VARCHAR(150),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE department_issue_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), department_issue_id UUID NOT NULL REFERENCES department_issues(id),
  item_id UUID NOT NULL REFERENCES inventory_items(id), quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  returned_quantity NUMERIC(14,3) NOT NULL DEFAULT 0
);
CREATE TABLE inventory_stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), item_id UUID NOT NULL REFERENCES inventory_items(id),
  from_location_id UUID NOT NULL REFERENCES inventory_stock_locations(id), to_location_id UUID NOT NULL REFERENCES inventory_stock_locations(id),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0), reason TEXT,
  transferred_by UUID NOT NULL REFERENCES portal_users(id), transferred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE inventory_supplier_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), original_purchase_id UUID NOT NULL REFERENCES inventory_purchases(id),
  item_id UUID NOT NULL REFERENCES inventory_items(id), quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  refund_method VARCHAR(20) NOT NULL, reason TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES portal_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), item_id UUID NOT NULL REFERENCES inventory_items(id),
  location_id UUID NOT NULL REFERENCES inventory_stock_locations(id), quantity_delta NUMERIC(14,3) NOT NULL,
  reason_type VARCHAR(30) NOT NULL, remarks TEXT,
  approved_by UUID REFERENCES portal_users(id), created_by UUID NOT NULL REFERENCES portal_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE inventory_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), category VARCHAR(50) NOT NULL, amount NUMERIC(14,2) NOT NULL,
  payment_method purchase_payment_method NOT NULL, reference VARCHAR(100), details TEXT,
  incurred_by UUID NOT NULL REFERENCES portal_users(id), incurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Standalone Pharmacy (medicine) — parallel structure, independent =====
CREATE TABLE pharmacy_medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code VARCHAR(30) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
  category VARCHAR(50), unit VARCHAR(20) NOT NULL, batch_managed BOOLEAN NOT NULL DEFAULT true,
  purchase_rate NUMERIC(14,2), sale_rate NUMERIC(14,2), is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id)
);
CREATE TABLE pharmacy_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(100) NOT NULL, location_type VARCHAR(20) -- STORE/COUNTER
);
CREATE TABLE pharmacy_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(150) NOT NULL, contact VARCHAR(100),
  phone VARCHAR(30), address TEXT, terms TEXT, is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE pharmacy_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), medicine_id UUID NOT NULL REFERENCES pharmacy_medicines(id),
  batch_number VARCHAR(50) NOT NULL, expiry_date DATE NOT NULL, cost_rate NUMERIC(14,2) NOT NULL,
  UNIQUE(medicine_id, batch_number)
);
CREATE TABLE pharmacy_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), supplier_id UUID NOT NULL REFERENCES pharmacy_suppliers(id),
  invoice_reference VARCHAR(100), payment_method purchase_payment_method NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL, purchased_by UUID NOT NULL REFERENCES portal_users(id),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE pharmacy_purchase_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), purchase_id UUID NOT NULL REFERENCES pharmacy_purchases(id),
  batch_id UUID NOT NULL REFERENCES pharmacy_batches(id), quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  rate NUMERIC(14,2) NOT NULL, location_id UUID NOT NULL REFERENCES pharmacy_locations(id)
);
CREATE TABLE pharmacy_stock_ledger (          -- append-only, delta-only, batch-referenced (D09 p.1)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), medicine_id UUID NOT NULL REFERENCES pharmacy_medicines(id),
  batch_id UUID REFERENCES pharmacy_batches(id),  -- NULL only if batch_managed = false
  location_id UUID NOT NULL REFERENCES pharmacy_locations(id),
  movement_type VARCHAR(30) NOT NULL,           -- RECEIPT/DISPENSE/SALE/RETURN_IN/RETURN_OUT/TRANSFER_IN/TRANSFER_OUT/EXPIRY/DAMAGE/ADJUSTMENT
  quantity_delta NUMERIC(14,3) NOT NULL,
  reference_table VARCHAR(50) NOT NULL, reference_id UUID NOT NULL,
  actor_id UUID NOT NULL REFERENCES portal_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE pharmacy_supplier_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), supplier_id UUID NOT NULL REFERENCES pharmacy_suppliers(id),
  entry_type VARCHAR(20) NOT NULL, amount NUMERIC(14,2) NOT NULL,
  reference_table VARCHAR(50), reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES portal_users(id)
);
CREATE TABLE pharmacy_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), batch_id UUID NOT NULL REFERENCES pharmacy_batches(id),
  from_location_id UUID NOT NULL REFERENCES pharmacy_locations(id), to_location_id UUID NOT NULL REFERENCES pharmacy_locations(id),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0), transferred_by UUID NOT NULL REFERENCES portal_users(id),
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE pharmacy_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), return_type VARCHAR(20) NOT NULL, -- PATIENT / SUPPLIER
  original_reference_table VARCHAR(50), original_reference_id UUID,
  batch_id UUID NOT NULL REFERENCES pharmacy_batches(id), quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  refund_method VARCHAR(20), reason TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES portal_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE pharmacy_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), batch_id UUID NOT NULL REFERENCES pharmacy_batches(id),
  location_id UUID NOT NULL REFERENCES pharmacy_locations(id), quantity_delta NUMERIC(14,3) NOT NULL,
  reason_type VARCHAR(30) NOT NULL, remarks TEXT,
  created_by UUID NOT NULL REFERENCES portal_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE pharmacy_sales (                 -- Pharmacy invoice, retail or HMS-linked
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), invoice_number VARCHAR(30) NOT NULL UNIQUE,
  channel pharmacy_sale_channel NOT NULL, pharmacy_request_id UUID REFERENCES pharmacy_requests(id),
  patient_id UUID REFERENCES patients(id),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0, discount_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0, paid_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'UNPAID',
  sold_by UUID NOT NULL REFERENCES portal_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE pharmacy_sale_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sale_id UUID NOT NULL REFERENCES pharmacy_sales(id),
  medicine_id UUID NOT NULL REFERENCES pharmacy_medicines(id), batch_id UUID REFERENCES pharmacy_batches(id),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0), rate_snapshot NUMERIC(14,2) NOT NULL,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0, line_net NUMERIC(14,2) NOT NULL,
  dispensed_by UUID NOT NULL REFERENCES portal_users(id)
);
CREATE TABLE pharmacy_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sale_id UUID NOT NULL REFERENCES pharmacy_sales(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0), method payment_method NOT NULL, reference VARCHAR(100),
  collected_by UUID NOT NULL REFERENCES portal_users(id), collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Bridge: HMS ↔ Pharmacy =====
CREATE TABLE pharmacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_request_number VARCHAR(30) NOT NULL UNIQUE,  -- stable request ID, D16 p.14
  admission_id UUID NOT NULL REFERENCES admissions(id),
  status pharmacy_request_status NOT NULL DEFAULT 'REQUESTED',
  requested_by UUID NOT NULL REFERENCES portal_users(id), requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_by UUID REFERENCES portal_users(id), fulfilled_at TIMESTAMPTZ,
  idempotency_key VARCHAR(100) NOT NULL UNIQUE          -- callback de-duplication, §4.12
);
CREATE TABLE pharmacy_request_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), pharmacy_request_id UUID NOT NULL REFERENCES pharmacy_requests(id),
  medicine_id UUID NOT NULL REFERENCES pharmacy_medicines(id), requested_quantity NUMERIC(14,3) NOT NULL,
  approved_quantity NUMERIC(14,3), dispensed_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  batch_id UUID REFERENCES pharmacy_batches(id), priority VARCHAR(10), notes TEXT
);
```

### 6.11 Domain I — Universal Cash Accountability (shared model across Billing / Inventory / Pharmacy)

```sql
CREATE TABLE cash_transactions (              -- generic ledger of every cash-affecting event, any module
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id UUID NOT NULL REFERENCES portal_users(id),   -- the cash-holder
  module_scope VARCHAR(20) NOT NULL,            -- BILLING / INVENTORY / PHARMACY
  direction VARCHAR(3) NOT NULL CHECK (direction IN ('IN','OUT')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  category VARCHAR(30) NOT NULL,                -- COLLECTION/PURCHASE/REFUND/EXPENSE/PETTY_CASH_ISSUE/RECOVERY
  is_physical_cash BOOLEAN NOT NULL,             -- false for Card/Bank/Online (reported, never counted physically)
  reference_table VARCHAR(50) NOT NULL, reference_id UUID NOT NULL,
  is_settled BOOLEAN NOT NULL DEFAULT false,     -- flips true only when included in an ACCEPTED settlement
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_cash_txn_settled_once ON cash_transactions (reference_table, reference_id)
  WHERE is_settled = true;                       -- prevents re-settlement of an already-accepted transaction

CREATE TABLE petty_cash_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), recipient_portal_user_id UUID NOT NULL REFERENCES portal_users(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0), purpose TEXT, method VARCHAR(20),
  issued_by UUID NOT NULL REFERENCES portal_users(id), issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE account_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id UUID NOT NULL REFERENCES portal_users(id),
  module_scope VARCHAR(20) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL, period_end TIMESTAMPTZ NOT NULL,
  expected_cash NUMERIC(14,2) NOT NULL, physical_cash NUMERIC(14,2) NOT NULL,
  variance NUMERIC(14,2) NOT NULL, variance_reason TEXT,
  handover_amount NUMERIC(14,2), carry_forward_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status settlement_status NOT NULL DEFAULT 'PREPARED',
  submitted_by UUID REFERENCES portal_users(id), submitted_at TIMESTAMPTZ,
  received_by UUID REFERENCES portal_users(id),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_self_submit CHECK (submitted_by IS NULL OR submitted_by = portal_user_id)  -- D16 p.16
);
CREATE TABLE settlement_transactions (        -- join: which cash_transactions this settlement covers
  settlement_id UUID NOT NULL REFERENCES account_settlements(id),
  cash_transaction_id UUID NOT NULL REFERENCES cash_transactions(id),
  PRIMARY KEY (settlement_id, cash_transaction_id)
);
CREATE TABLE settlement_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), settlement_id UUID NOT NULL REFERENCES account_settlements(id),
  decision VARCHAR(20) NOT NULL,                -- ACCEPT/PARTIAL_ACCEPT/RETURN/REJECT
  accepted_amount NUMERIC(14,2), remarks TEXT,
  reviewed_by UUID NOT NULL REFERENCES portal_users(id), reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.12 Domain J — Cross-Cutting / System

```sql
CREATE TABLE audit_logs (                     -- NOT a navigation page (D17 p.2) but mandatory as data (§16 C1)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id UUID REFERENCES portal_users(id),
  action VARCHAR(50) NOT NULL,                  -- e.g. CREATE/UPDATE/APPROVE/REVERSE/LOGIN/LOGIN_FAILED
  entity_table VARCHAR(50) NOT NULL, entity_id UUID,
  before_state JSONB, after_state JSONB,
  ip_address INET, user_agent TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (occurred_at);             -- monthly partitions, §11.9 retention

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), recipient_portal_user_id UUID NOT NULL REFERENCES portal_users(id),
  type VARCHAR(50) NOT NULL, payload JSONB NOT NULL, is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE file_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), entity_table VARCHAR(50) NOT NULL, entity_id UUID NOT NULL,
  file_url TEXT NOT NULL, file_name VARCHAR(255), mime_type VARCHAR(100), size_bytes BIGINT,
  uploaded_by UUID NOT NULL REFERENCES portal_users(id), uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE integration_events (             -- idempotency + retry log for HMS↔Pharmacy callbacks (§4.12)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), idempotency_key VARCHAR(100) NOT NULL UNIQUE,
  event_type VARCHAR(50) NOT NULL, payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING/PROCESSED/FAILED
  attempts INT NOT NULL DEFAULT 0, last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), processed_at TIMESTAMPTZ
);
```

### 6.13 Naming conventions summary

| Rule | Example |
|---|---|
| Tables: plural snake_case | `salary_batches`, `pharmacy_stock_ledger` |
| Junction/join tables: `<a>_<b>` | `settlement_transactions` |
| Boolean columns: `is_`/`has_` prefix | `is_active`, `is_settled` |
| FK columns: `<singular_table>_id` | `staff_id`, `department_id` |
| Enum types: `<domain>_<concept>` | `admission_status`, `stock_movement_type` |
| Ledger/movement tables: `*_ledger` | `inventory_stock_ledger` |
| Audit pairs: `created_by`/`updated_by` (not `creator_id`) | consistent across all 70+ tables |

### 6.14 Indexing strategy **[RECOMMENDATION]**

- B-tree index on every FK column (Postgres does not auto-index FKs).
- Composite index on every ledger table: `(item_id/medicine_id, location_id, created_at)` — supports the window-function running-balance query pattern (§6.1).
- Partial index `uq_cash_txn_settled_once` (above) enforces the "no double settlement" rule at the database level, not just in application code.
- `GIN` index on `hospital_profile.billing_legal_metadata` and other JSONB config columns if queried.
- Index on `patients (mr_number)`, `patients (cnic_or_passport)`, `staff (employee_code)`, `portal_users (username)`, `portal_users (email)` for lookup-heavy screens.

### 6.15 Migration strategy **[RECOMMENDATION]**

- Use a TypeScript-native migration tool consistent with the mandated stack — **Prisma Migrate** or **node-pg-migrate** (§7.3 decision recorded there). Every schema change is a versioned, checked-in migration file; no manual production DDL.
- Enum additions use `ALTER TYPE ... ADD VALUE IF NOT EXISTS` in a dedicated migration (cannot run inside the same transaction as other DDL in Postgres < 12 semantics — verify target Postgres version, recommend **Postgres 15+**).
- Every migration is forward-only in production; rollback is achieved by a new corrective migration, never by `DOWN`-running against a live database with financial data.
- Staging environment applies every migration against a masked copy of production-shaped data before production rollout (§13.8).

### 6.16 Seed data requirements **[RECOMMENDATION]**

| Seed set | Content | When |
|---|---|---|
| Enum-backed lookups | `staff_categories`, discount reason codes, adjustment reason types | Every environment, via migration |
| Reference Hospital Setup | At least one Department, one Service, one Ward/Room/Bed, one Shift | Dev/staging only — production Setup is entered live by the client during onboarding (§15) |
| First administrator account | See §6.17 | All environments, credentials never checked into source control |
| System settings defaults | Currency=PKR, rounding=ROUND_HALF_UP, timezone=Asia/Karachi, near-expiry-days, settlement cadence default | Every environment |

### 6.17 First administrator-account provisioning **[RECOMMENDATION]**

1. A one-time, idempotent bootstrap script (`npm run seed:super-admin`) runs against an **empty** `portal_users` table only (guarded by a `COUNT(*) = 0` check on `role = 'SUPER_ADMIN'`) — refuses to run against a populated database.
2. The script reads `SUPER_ADMIN_EMAIL` and a **generated** one-time password from environment/secret store (never a hard-coded default password), hashes it with Argon2id, and inserts the first `SUPER_ADMIN` row with `is_protected = true` and `must_reset_password = true`.
3. First login forces an immediate password change before any other action is permitted.
4. This is the **only** way a Super Admin is ever created outside the running application (§3.2 — even a second Super Admin must be created by an existing Super Admin through the UI/API, never by re-running the bootstrap script).

### 6.18 Data-retention considerations **[RECOMMENDATION — no explicit source requirement, see §16]**

No source document specifies a retention period. Recommended defaults, pending client confirmation (§16 Q-04):
- Financial/stock/payroll/commission ledgers: retain indefinitely (never purged) — consistent with the "no silent history changes" principle (D16 p.27).
- `attendance_raw_punches`: retain 2 years, then archive to cold storage (high volume, low long-term query value once normalized into `attendance_records`).
- `audit_logs`: retain 7 years (typical healthcare/financial compliance baseline), monthly-partitioned, older partitions moved to cheaper storage.
- `refresh_tokens`: purge expired/revoked rows after 90 days.
- `notifications`: purge read notifications after 180 days.

---

## 7. Backend Architecture

**[RECOMMENDATION — mandatory stack: Node.js + Express.js + TypeScript]**

### 7.1 Recommended folder structure

```
backend/
├── src/
│   ├── config/                # env loading, typed config object, constants
│   ├── db/
│   │   ├── client.ts           # pg Pool / Prisma client singleton
│   │   ├── migrations/         # versioned SQL or Prisma migrations
│   │   └── seeds/
│   ├── modules/                 # one folder per bounded domain (§6.3 A–J)
│   │   ├── identity/             # staff, portal_users, auth
│   │   │   ├── identity.routes.ts
│   │   │   ├── identity.controller.ts
│   │   │   ├── identity.service.ts
│   │   │   ├── identity.repository.ts
│   │   │   ├── identity.schemas.ts      # Zod request/response validation
│   │   │   └── identity.types.ts
│   │   ├── setup/                # departments, services, wards, panels, shifts
│   │   ├── attendance/
│   │   ├── payroll/               # salary
│   │   ├── commission/
│   │   ├── frontdesk/             # patients, appointments, encounters, invoices
│   │   ├── admission/
│   │   ├── inventory/             # HMS non-medicine inventory
│   │   ├── pharmacy/              # medicine inventory + dispensing
│   │   ├── pharmacy-bridge/       # HMS↔Pharmacy integration endpoints
│   │   ├── cash/                  # balance sheets, settlements (shared module)
│   │   └── reports/
│   ├── middleware/
│   │   ├── authenticate.ts        # verifies access token
│   │   ├── authorize.ts           # role/permission-matrix enforcement (§3.4)
│   │   ├── validate.ts            # Zod schema validation wrapper
│   │   ├── auditLog.ts            # writes audit_logs on mutating requests
│   │   ├── rateLimiter.ts
│   │   └── errorHandler.ts        # single error → HTTP response translator
│   ├── shared/
│   │   ├── errors/                # typed AppError hierarchy
│   │   ├── pagination.ts
│   │   ├── money.ts                # decimal-safe arithmetic helpers
│   │   └── logger.ts
│   ├── jobs/                      # background workers (§7.12)
│   ├── app.ts                     # Express app assembly (no listen())
│   └── server.ts                  # listen() + graceful shutdown (§7.16)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── prisma/ (or db/migrations)
├── .env.example
├── tsconfig.json
├── package.json
└── Dockerfile
```

**[RECOMMENDATION]** Each module follows **routes → controller → service → repository**: routes bind HTTP verbs/paths and middleware; controllers translate HTTP ⇄ DTOs only (no business logic); services hold business rules and orchestrate transactions (this is where formulas from §4/§15 live); repositories are the only layer that issues SQL/ORM calls. This mirrors the layering the module breakdown in §4 already implies (business rules are distinct from screens/forms).

### 7.2 Configuration management & environment variables

**[RECOMMENDATION]** A single typed `config` object (validated at boot with Zod, process exits non-zero on invalid config) is the only place `process.env` is read.

| Variable | Purpose | Example |
|---|---|---|
| `NODE_ENV` | environment | `production` |
| `PORT` | HTTP port | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/chss` |
| `DATABASE_POOL_MAX` | connection pool size | `20` |
| `JWT_ACCESS_SECRET` | access-token signing secret | *(secret manager)* |
| `JWT_ACCESS_TTL` | access-token lifetime | `15m` |
| `JWT_REFRESH_TTL` | refresh-token lifetime | `30d` |
| `COOKIE_DOMAIN` | refresh-token cookie domain | `.chss-hms.example` |
| `CORS_ALLOWED_ORIGINS` | frontend origin(s) | `https://app.chss-hms.example` |
| `FILE_STORAGE_DRIVER` | `local` \| `s3`-compatible | `s3` |
| `FILE_STORAGE_BUCKET` | object storage bucket | *(secret manager)* |
| `SUPER_ADMIN_EMAIL` / bootstrap password | first-admin provisioning (§6.17) | *(secret manager, one-time)* |
| `LOG_LEVEL` | pino/winston level | `info` |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | §7.11 | `60000` / `100` |
| `ATTENDANCE_DEVICE_ADAPTER` | `api`\|`sdk`\|`lan_sync`\|`file_import` (§16 Q-03) | *(TBD)* |

Secrets are **never** committed; `.env.example` documents keys with placeholder values only.

### 7.3 Database connection strategy

**[RECOMMENDATION]** `pg` (`node-postgres`) connection pool as the transport, with **Prisma ORM** on top for type-safe queries and migrations (chosen over a hand-rolled query builder because the schema in §6 has ~70 tables with many FK relationships — Prisma's generated types keep repository code and the DB schema mechanically in sync, reducing drift risk). Every service-layer method that touches more than one table (e.g., posting a stock ledger row **and** updating a purchase's status) runs inside an explicit `prisma.$transaction(...)` block — **transaction boundaries are drawn at the business-operation level, not the HTTP-request level**, so a partial failure never leaves, e.g., a `pharmacy_stock_ledger` row without its corresponding `pharmacy_sale_lines` row.

**Transaction boundary examples (from §5 workflows):**

| Operation | Tables written atomically |
|---|---|
| Collect payment against invoice | `payments`, `invoices.paid_total`/`status`, `receipts` |
| Dispense medicine | `pharmacy_stock_ledger`, `pharmacy_sale_lines`, `pharmacy_sales.total`, `cash_transactions` (if cash) |
| Accept settlement | `account_settlements.status`, `settlement_reviews`, `cash_transactions.is_settled` (all included rows), custody-transfer bookkeeping |
| Generate salary | `salary_batches`, `salary_batch_lines` — reads `attendance_records` with `FOR SHARE` to prevent concurrent correction mid-generation |
| Complete discharge | `discharge_clearances` (verify all 3 = CLEARED), `admissions.status`, `beds.status`, `discharge_summaries` |

### 7.4 Route structure & API versioning

`/api/v1/<module>/<resource>` — see full inventory in §8. Versioning is **URL-prefixed** (`/api/v1/...`); a breaking change ships as `/api/v2/...` with the previous version kept running until the frontend has migrated (§8.1).

### 7.5 Controllers, Services, Repositories — responsibility split

| Layer | Responsibility | Must NOT do |
|---|---|---|
| Controller | Parse/validate request (via `validate.ts` + Zod schema), call one service method, map result to HTTP response/status code | Contain business rules, direct DB access |
| Service | Business rules (§4 rules, §15 formulas), orchestrate multi-repository transactions, enforce ownership rules (e.g., "own settlement only") | Know about `req`/`res`, HTTP status codes |
| Repository | Typed data access (Prisma calls) for one or a tightly related set of tables | Contain business rules or cross-module orchestration |

### 7.6 Middleware stack (applied in order)

1. `helmet()` — secure headers (§11.1)
2. `cors()` — allow-listed origins only (§7.15)
3. Request-ID + structured request logging
4. Body parsing (`express.json({limit: '2mb'})`)
5. Rate limiter (§7.11)
6. `authenticate` — verifies JWT access token, attaches `req.user`
7. `authorize(module, action)` — per-route, checks `req.user.role` against the §3.3 matrix, and record-ownership where applicable
8. Route handler (controller)
9. `auditLog` — post-handler, writes `audit_logs` for mutating verbs (POST/PUT/PATCH/DELETE) — **[RECOMMENDATION]** implemented as response-finish middleware so it captures the actual outcome/status code
10. `errorHandler` — final middleware, maps `AppError` subclasses to consistent JSON error responses (§8.2)

### 7.7 Validation

**[RECOMMENDATION]** **Zod** schemas per endpoint (request body/query/params), colocated in each module's `*.schemas.ts`. Same Zod schemas are shared with the frontend (published as an internal `@chss/api-contracts` package or a shared `types/` workspace in the monorepo) so request shapes cannot drift between client and server — this directly serves §9.6 form validation.

### 7.8 Authentication

**[RECOMMENDATION — "secure token/session-based authentication based on documented requirements", per mandatory stack; no source PDF specifies a mechanism]**

- **Access token:** short-lived JWT (default 15 min), returned in the response body, held in memory on the frontend (not `localStorage`, to reduce XSS exfiltration risk), sent as `Authorization: Bearer <token>`.
- **Refresh token:** opaque random token, stored **hashed** in `refresh_tokens` (§6.4), delivered as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie — this is the "session" half of the hybrid model, immune to JS-based theft.
- Login: `POST /api/v1/auth/login` (username/email + password) → verify Argon2id hash → issue access token + refresh cookie → write `audit_logs` (`LOGIN` or `LOGIN_FAILED`).
- Refresh: `POST /api/v1/auth/refresh` → validate refresh cookie against `refresh_tokens` (hash match, not expired, not revoked) → rotate (issue new refresh token, revoke old) → issue new access token. Rotation on every use detects token replay (an already-used, revoked token being replayed triggers a full session revoke for that user).
- Logout: revoke the current refresh token row; clear cookie.
- Password hashing: **Argon2id** (preferred over bcrypt for memory-hardness against GPU attack) via a vetted library; never plaintext, never reversible encryption (mandatory stack requirement, verbatim).
- Forced reset: `must_reset_password` flag blocks all non-auth routes until changed (used for the bootstrap Super Admin, §6.17, and any Admin-issued Reset Password action, §4.1).
- **[ASSUMPTION]** No self-service "forgot password" flow is described in the source; v1 password resets are Admin/Super-Admin-issued only (matches the "Reset Password" button on Staff/Admin/Pharmacy user screens, D17). A self-service flow is a reasonable future addition — flagged in §16.

### 7.9 Authorization / RBAC

Implements the matrix in §3.3 as a declarative policy object loaded at boot:

```ts
// simplified shape
type Policy = Record<PortalRole, Record<ModuleKey, Set<Action>>>;
```

`authorize(module, action)` middleware checks `policy[req.user.role][module].has(action)`; for record-scoped actions (submit-own-settlement, edit-own-draft) the **service layer** additionally checks ownership (`resource.portal_user_id === req.user.id`) — this is deliberately **not** expressible as a static policy table because it depends on the specific row, matching §3.4/§3.5.

### 7.10 Error handling

**[RECOMMENDATION]** A typed `AppError` hierarchy (`ValidationError`→400, `AuthenticationError`→401, `AuthorizationError`→403, `NotFoundError`→404, `ConflictError`→409, `BusinessRuleError`→422, `InternalError`→500) thrown from services/repositories, caught once by `errorHandler`, mapped to the consistent error envelope defined in §8.2. Stack traces never reach the client in production; full detail is logged server-side with the request ID for correlation.

### 7.11 Rate limiting

**[RECOMMENDATION]** Global limiter (e.g., 100 req/min/IP) via `express-rate-limit` backed by a shared store (Redis, if horizontally scaled — §13) or in-memory for single-instance deployment; a stricter limiter on `/api/v1/auth/login` (e.g., 5 attempts/15 min/IP+username) to blunt credential-stuffing, feeding `audit_logs` on repeated failures.

### 7.12 File uploads & background jobs

- **File uploads [ASSUMPTION — needed for staff documents/notes attachments, D16 p.4 "notes/documents"]:** multipart upload via `multer` (memory storage) → streamed to object storage (S3-compatible; local disk only for dev) → `file_attachments` row created; virus/type scanning **[RECOMMENDATION]** before storage if the client's compliance posture requires it (§16 open question).
- **Background jobs [RECOMMENDATION]:** a lightweight job queue (e.g., `pg-boss`, which uses PostgreSQL itself — avoids adding Redis as a hard dependency for v1) for: nightly low-stock/near-expiry scan (§4.8, §4.10 alerts), attendance device sync polling (if the chosen adapter is pull-based), scheduled report pre-generation, and retry of `integration_events` in `FAILED` status (§4.12, §6.12).

### 7.13 Notifications

**[ASSUMPTION — no channel specified by source]** In-app notifications persisted to `notifications` (§6.12) and surfaced via a bell icon + polling or WebSocket (§9); email/SMS channels are **not** confirmed as in-scope (§16 open question) — the notification service is built with a pluggable channel interface so email/SMS can be added later without a data-model change.

### 7.14 Audit trail

Every mutating request is captured in `audit_logs` via the `auditLog` middleware (§7.6, step 9), recording actor, action, entity, before/after state (for UPDATE), IP, and user agent. **This satisfies D16's "actual user attribution" requirement (p.22) even though no dedicated Audit Log page exists in the HMS navigation (D17 p.2, §16 Conflict C1)** — the data must exist regardless of whether a UI surfaces it in v1.

### 7.15 API versioning & CORS

- CORS: allow-list the deployed frontend origin(s) only, `credentials: true` (required for the refresh-token cookie), explicit allowed methods/headers — never a wildcard origin in production (§11.1).
- Versioning: see §7.4.

### 7.16 Health-check endpoint & graceful shutdown

- `GET /api/v1/health` — liveness (process up) — no auth, no DB call, always fast.
- `GET /api/v1/health/ready` — readiness — checks DB connectivity (`SELECT 1`) and job-queue connectivity; used by the orchestrator/load balancer to gate traffic (§13.3).
- **Graceful shutdown [RECOMMENDATION]:** on `SIGTERM`, stop accepting new connections, wait for in-flight requests to complete (bounded timeout, e.g. 10s), close the DB pool, then exit — critical for zero-downtime deploys behind a load balancer/orchestrator (§13).

### 7.17 Security controls (backend-specific; full list in §11.1)

- `helmet()` secure headers, strict CSP for any server-rendered content.
- Parameterized queries only (Prisma/`pg` parameter binding) — no string-concatenated SQL, anywhere, preventing SQL injection.
- Input validation on every mutating endpoint (§7.7) before it reaches a service.
- Output encoding for any user-supplied text rendered in generated PDFs (§10) to prevent injection into report templates.
- Least-privilege database role for the application user (no `SUPERUSER`, no `DROP` on production credentials — migrations run under a separate, more-privileged CI-only role, §13.6).

---

## 8. REST API Specification

**[RECOMMENDATION — proposed endpoint inventory]**, grouped by module, built from the actions/forms enumerated in §4 and §17 UI spec. Role column uses the abbreviations from §3.1 (`SA`=Super Admin, `AD`=Admin, `FB`=Front Desk/Billing, `AM`=Admission, `IM`=Inventory Management, `PSA`=Pharmacy Super Admin, `PM`=Pharmacy Manager, `PD`=Pharmacy Sales/Dispensing).

### 8.1 Conventions

- Base path: `/api/v1`.
- **Response envelope (success):** `{ "data": <payload>, "meta": { "pagination": {...} } }` (meta omitted when not paginated).
- **Pagination:** `?page=1&pageSize=25` (default 25, max 100); list responses include `meta.pagination = { page, pageSize, totalItems, totalPages }`.
- **Filtering:** list endpoints accept `?from=YYYY-MM-DD&to=YYYY-MM-DD` for date-scoped resources plus resource-specific filters (documented per group below) as query params; unknown filter keys are rejected with `400`.
- **Sorting:** `?sort=field:asc|desc` (default: `created_at:desc`).
- All timestamps in request/response bodies are ISO-8601 UTC; the client renders in the hospital's configured timezone (§11.13).

### 8.2 Error format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "amount must be greater than 0",
    "details": [{ "field": "amount", "issue": "must be > 0" }],
    "requestId": "b3f1..."
  }
}
```

| HTTP status | `code` | Thrown when |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod schema rejects request |
| 401 | `AUTHENTICATION_ERROR` | missing/expired/invalid access token |
| 403 | `AUTHORIZATION_ERROR` | role/ownership check fails (§3.4) |
| 404 | `NOT_FOUND` | resource does not exist |
| 409 | `CONFLICT` | e.g., double-settlement attempt, duplicate check-in |
| 422 | `BUSINESS_RULE_ERROR` | e.g., discharge attempted with pending clearance, negative stock blocked |
| 429 | `RATE_LIMITED` | §7.11 |
| 500 | `INTERNAL_ERROR` | unexpected server fault (logged, generic message to client) |

### 8.3 Auth & Identity

| Method | Route | Purpose | Roles | Notes |
|---|---|---|---|---|
| POST | `/auth/login` | Authenticate, issue access token + refresh cookie | Public | Rate-limited (§7.11); writes `audit_logs` |
| POST | `/auth/refresh` | Rotate refresh token, issue new access token | Authenticated (via cookie) | Detects replay of revoked token → revokes all sessions |
| POST | `/auth/logout` | Revoke current refresh token | Authenticated | |
| POST | `/auth/change-password` | Self password change | Authenticated | Required if `must_reset_password = true` |
| GET | `/me` | Current user profile + effective permissions | Authenticated | Frontend uses this to drive nav (§9.7) |
| GET | `/staff` | List staff (search/filter by department, category, status) | SA, AD | Pagination |
| POST | `/staff` | Create staff record | SA, AD | Employee ID system-generated |
| GET | `/staff/:id` | Staff 360° profile (all tabs) | SA, AD | |
| PATCH | `/staff/:id` | Edit staff | SA, AD | |
| POST | `/staff/:id/deactivate` | Deactivate staff | SA, AD | Soft delete only |
| GET | `/staff/:id/attendance-report` | Individual attendance report | SA, AD | `from`/`to` filters |
| GET | `/staff/:id/salary-report` | Individual salary report | SA, AD | |
| GET | `/staff/:id/commission-report` | Individual commission report | SA, AD | Empty for non-commissioned staff |
| POST | `/staff/:id/portal-account` | Link/create portal account for a staff record | SA, AD (Pharmacy staff via PSA) | Enforces §3.2 protected-role rule |
| GET | `/portal-users` | List portal users (role filter) | SA, AD, PSA (Pharmacy scope) | |
| POST | `/portal-users` | Create portal user | SA (any role incl. Super Admin), AD (non-Super-Admin only), PSA (Pharmacy roles only) | `403` if AD targets `SUPER_ADMIN` role |
| PATCH | `/portal-users/:id` | Edit portal user | SA, AD\*, PSA\* | \*blocked on protected accounts they don't own authority over |
| POST | `/portal-users/:id/reset-password` | Admin-issued password reset | SA, AD, PSA | Sets `must_reset_password = true` |
| POST | `/portal-users/:id/suspend` | Suspend account | SA, AD, PSA | Blocked if target is the last active Super Admin (§3.2, §6.4) |
| POST | `/portal-users/:id/reactivate` | Reactivate | SA, AD, PSA | |

### 8.4 Hospital Setup

| Method | Route | Purpose | Roles |
|---|---|---|---|
| GET/PATCH | `/setup/hospital-profile` | View/edit singleton hospital identity | SA, AD (all); others: GET only where referenced |
| GET/POST/PATCH/POST `:id/deactivate` | `/setup/departments[/:id]` | Department CRUD | SA, AD |
| GET/POST/PATCH/POST `:id/deactivate` | `/setup/services[/:id]` | Service & rate CRUD | SA, AD; GET: FB, AM (read-only) |
| GET/POST/PATCH | `/setup/wards[/:id]`, `/setup/rooms[/:id]`, `/setup/beds[/:id]` | Ward→Room→Bed hierarchy CRUD | SA, AD; GET: AM |
| POST | `/setup/beds/:id/out-of-service` | Mark bed out of service | SA, AD |
| GET/POST/PATCH | `/setup/panels[/:id]` | Panel CRUD | SA, AD; GET: FB |
| PUT | `/setup/panels/:id/discount-rules` | Configure panel service discounts | SA, AD |
| GET/POST/PATCH | `/setup/shifts[/:id]` | Shift CRUD | SA, AD |
| POST | `/setup/shifts/:id/duplicate` | Duplicate shift | SA, AD |
| GET/PATCH | `/setup/system-settings` | System configuration key/value | SA, AD (SA-only for security-sensitive keys) |

### 8.5 Attendance & Payroll

| Method | Route | Purpose | Roles |
|---|---|---|---|
| POST | `/attendance/sync` | Trigger device adapter import (or receive push payload) | System/adapter; SA, AD (manual trigger) |
| GET | `/attendance` | List/browse attendance records (`staff_id`, `department_id`, `from`, `to`, `status` filters) | SA, AD |
| GET | `/attendance/:id` | Day detail | SA, AD |
| POST | `/attendance/:id/correct` | Apply correction (reason required) | SA, AD | Writes `attendance_corrections`; never mutates history in place |
| POST | `/attendance/:id/approve` | Approve attendance record | SA, AD |
| POST | `/attendance/bulk-approve` | Approve a filtered batch | SA, AD |
| POST | `/payroll/salary-batches` | Generate salary (staff/department + period) | SA, AD | Snapshots inputs (§6.6) |
| GET | `/payroll/salary-batches` | List/filter salary batches | SA, AD |
| GET | `/payroll/salary-batches/:id` | Batch detail + line breakdown | SA, AD |
| POST | `/payroll/salary-batches/:id/approve` | Approve | SA, AD |
| POST | `/payroll/salary-batches/:id/payments` | Record payment (full/partial) | SA, AD | Never references commission tables |
| GET | `/payroll/salary-batches/:id/slip` | Print slip (PDF) | SA, AD |
| GET | `/payroll/reports` | Payroll reports (generated/paid/partial/outstanding) | SA, AD |

### 8.6 Doctor Commission

| Method | Route | Purpose | Roles |
|---|---|---|---|
| POST | `/commission/statements` | Generate commission statement (doctor + period) | SA, AD | Resolves rule per §4.5; unique per line |
| GET | `/commission/statements` | List/filter | SA, AD |
| GET | `/commission/statements/:id` | Detail + service-wise breakdown | SA, AD |
| POST | `/commission/statements/:id/approve` | Approve | SA, AD |
| POST | `/commission/statements/:id/payments` | Record payment (full/partial) | SA, AD |
| POST | `/commission/lines/:id/reversal` | Create reversal (refund/cancel after generation) | SA, AD | Never deletes the original line |
| GET | `/commission/reports` | Accrual/generated/paid/outstanding reports | SA, AD |
| GET/POST/PATCH | `/staff/:id/commission-rules[/:ruleId]` | Staff-specific commission rule config | SA, AD | Effective-dated (§6.7) |

### 8.7 Front Desk / Billing — Patients, Appointments, Encounters, Invoicing

| Method | Route | Purpose | Roles |
|---|---|---|---|
| GET/POST/PATCH | `/patients[/:id]` | Panel/temporary patient identity (`patient_type` filter) | FB (create/edit), SA/AD/AM (read) |
| GET | `/patients/:id/history` | Transaction/encounter/admission history | FB, SA, AD |
| GET/POST | `/appointments[?department,doctor,date,status]` | List/book appointments | FB (write), SA/AD (read) |
| PATCH | `/appointments/:id` | Edit/reschedule | FB |
| POST | `/appointments/:id/check-in` | Convert to encounter | FB |
| POST | `/appointments/:id/cancel` | Cancel/no-show | FB |
| POST | `/appointments/:id/advance` | Collect advance | FB | Feeds `payments` |
| POST | `/encounters` | Create walk-in/OBS/ER encounter | FB |
| POST | `/encounters/:id/services` | Add service line | FB |
| GET | `/encounters/:id/invoice` | Current invoice state | FB, SA, AD |
| POST | `/invoices/:id/discounts` | Request/apply discount | FB | Routes to approval if above threshold (§16 Q-05) |
| POST | `/invoices/:id/discounts/:discountId/approve` | Approve discount | SA, AD |
| POST | `/invoices/:id/payments` | Collect payment | FB | Updates `invoices.paid_total`/`status` atomically |
| GET | `/invoices/:id/receipt` | Print/reprint receipt | FB |
| POST | `/payments/:id/refunds` | Create refund | FB | Routes to approval if required |
| POST | `/refunds/:id/approve` | Approve refund | SA, AD |
| POST | `/refunds/:id/pay` | Pay refund | FB |
| GET | `/payment-requests?status=pending` | Admission payment-request queue | FB |
| POST | `/payment-requests/:id/fulfill` | Collect against an Admission payment request | FB | Syncs status back to `admissions` |
| GET | `/billing/reports` | Appointments/billing/collections/discounts/refunds/outstanding reports | FB (own), SA/AD (all) |

### 8.8 Admission

| Method | Route | Purpose | Roles |
|---|---|---|---|
| GET/POST | `/admissions[?status,department,doctor]` | List/create planned admission | AM (write), SA/AD/FB (read) |
| PATCH | `/admissions/:id` | Edit planned admission | AM |
| POST | `/admissions/:id/payment-requests` | Raise advance/partial/final payment request | AM | Fulfilled only by FB (§8.7) |
| POST | `/admissions/:id/confirm-arrival` | Confirm arrival | AM |
| POST | `/admissions/:id/assign-bed` | Assign bed (Active Admission begins) | AM | Sets `beds.status = OCCUPIED` |
| POST | `/admissions/:id/transfers` | Bed transfer | AM |
| POST | `/admissions/:id/services` | Post hospital service/procedure charge | AM | Feeds running Hospital Bill |
| POST | `/admissions/:id/medication-mode` | Change SELF ⇄ HOSPITAL_MANAGED | AM | Requires `reason`; immutable audit row |
| GET | `/admissions/:id/medication-mode/history` | Mode change history | AM, SA, AD |
| POST | `/admissions/:id/pharmacy-requests` | Create medicine request (HOSPITAL_MANAGED only) | AM | `422` if mode ≠ HOSPITAL_MANAGED |
| GET | `/admissions/:id/pharmacy-requests` | Status of raised requests | AM, SA, AD |
| POST | `/admissions/:id/clinical-ready` | Mark Clinical Ready | AM |
| GET | `/admissions/:id/clearances` | Clearance status (3 types) | AM, SA, AD, FB, PM |
| POST | `/admissions/:id/discharge` | Attempt final discharge | AM | `422 BUSINESS_RULE_ERROR` naming any pending clearance |
| GET | `/admissions/:id/discharge-summary` | Consolidated summary (display-only totals) | AM, SA, AD |
| GET | `/admission/reports` | Occupancy/transfers/charges/payment-status/mode-changes/discharge-delay reports | AM (own), SA/AD (all) |
| GET | `/beds?status=available&wardId=` | Bed board | AM |

### 8.9 HMS Inventory (Non-Medicine)

| Method | Route | Purpose | Roles |
|---|---|---|---|
| GET/POST/PATCH | `/inventory/items[/:id]` | Item master CRUD | IM (write), SA/AD (read) |
| GET/POST/PATCH | `/inventory/suppliers[/:id]` | Supplier master CRUD | IM |
| GET/POST/PATCH | `/inventory/locations[/:id]` | Stock location CRUD | IM |
| POST | `/inventory/purchase-requests` | Create purchase request | IM |
| POST | `/inventory/fund-requests` | Request petty cash/advance | IM |
| POST | `/inventory/fund-requests/:id/approve` | Approve fund request | SA, AD | Credits recipient's `petty_cash_issues` |
| POST | `/inventory/purchases` | Record purchase/goods receipt | IM | Posts Stock Ledger IN + Supplier Ledger atomically |
| GET | `/inventory/stock-ledger?itemId=&locationId=&from=&to=` | Stock ledger with computed running balance | IM (write ops elsewhere), SA/AD (read) |
| GET | `/inventory/supplier-ledger?supplierId=` | Supplier ledger + outstanding | IM, SA, AD |
| POST | `/inventory/department-issues` | Issue stock to department | IM | `422` if would drive stock negative (unless override flag) |
| POST | `/inventory/department-issues/:id/return` | Record unused return | IM |
| POST | `/inventory/transfers` | Location-to-location transfer | IM |
| POST | `/inventory/supplier-returns` | Purchase return to supplier | IM |
| POST | `/inventory/adjustments` | Positive/negative adjustment | IM | `reason` required (DB constraint) |
| GET | `/inventory/alerts/low-stock` | Reorder alert list | IM, SA, AD |
| POST | `/inventory/expenses` | Record approved cash expense | IM |
| GET/POST | `/inventory/balance-sheet`, `/inventory/settlements` | See §8.11 (shared cash module) | IM |
| GET | `/inventory/reports` | Purchases/stock/supplier/issues/adjustments/low-stock reports | IM (own cash), SA/AD (all) |

### 8.10 Standalone Pharmacy (Medicine)

| Method | Route | Purpose | Roles |
|---|---|---|---|
| GET/POST/PATCH | `/pharmacy/medicines[/:id]` | Medicine master CRUD | PM, PSA |
| GET/POST/PATCH | `/pharmacy/suppliers[/:id]` | Supplier master CRUD | PM, PSA |
| GET/POST/PATCH | `/pharmacy/locations[/:id]` | Store/counter location CRUD | PM, PSA |
| GET/POST/PATCH | `/pharmacy/users[/:id]` | Pharmacy portal user CRUD | PSA only |
| POST | `/pharmacy/purchases` | Record purchase/receipt (batch+expiry+cost) | PM | Posts Medicine Stock Ledger IN + Supplier Ledger |
| GET | `/pharmacy/stock-ledger?medicineId=&batchId=&locationId=` | Stock ledger with running balance | PM, PSA |
| GET | `/pharmacy/supplier-ledger?supplierId=` | Supplier ledger + outstanding | PM, PSA |
| POST | `/pharmacy/transfers` | Store↔counter / location transfer | PM |
| POST | `/pharmacy/returns` | Patient or supplier return | PM, PD (patient return only, within permission) |
| POST | `/pharmacy/adjustments` | Expiry/damage/breakage/variance adjustment | PM | `reason` required |
| GET | `/pharmacy/alerts?type=low_stock\|near_expiry\|expired` | Stock alert queues | PM, PSA |
| GET | `/pharmacy/batches/:medicineId/fefo-candidate` | Suggested FEFO batch for a dispense qty | PM, PD | Overridable, logged (§4.10) |
| GET | `/pharmacy/reports` | Purchases/stock/batch/supplier/sales/HMS-integration reports | PM, PSA |
| GET/PATCH | `/pharmacy/settings` | Pharmacy Profile/Settings | PSA |

### 8.11 Pharmacy Sales / Dispensing & HMS↔Pharmacy Bridge

| Method | Route | Purpose | Roles |
|---|---|---|---|
| GET | `/pharmacy/hms-requests?status=` | Assigned/queued HMS medicine requests | PM (accept/assign), PD (dispense) |
| POST | `/pharmacy/hms-requests/:id/decision` | Accept / Partially Fulfill / Reject | PM | Idempotency-key enforced (§6.10) |
| POST | `/pharmacy/hms-requests/:id/dispense` | Dispense (full/partial), allocate batch | PD | Atomic with stock ledger + invoice line (§7.3) |
| GET | `/pharmacy/hms-requests/:id/status` | HMS-visible status (read from HMS side) | AM, SA, AD |
| POST | `/pharmacy/sales` | Retail sale (new sale, add item, confirm) | PD | |
| POST | `/pharmacy/sales/:id/payments` | Collect payment | PD |
| GET | `/pharmacy/sales/:id/invoice` | Print/reprint invoice | PD |
| POST | `/pharmacy/sales/:id/returns` | Return against a sale/dispense | PD (within permission), PM (approve) |
| GET | `/pharmacy/stock-lookup?medicineId=&locationId=` | Read-only counter stock check | PD |
| GET/POST | `/pharmacy/balance-sheet`, `/pharmacy/settlements` | See §8.12 (shared cash module) | PD |
| GET | `/pharmacy/my-reports` | Own sales/dispensing/returns/settlements | PD |

### 8.12 Universal Cash Accountability (shared across FB / IM / PD)

One set of routes, `moduleScope` resolved server-side from the caller's role — this is the concrete API expression of the shared schema in §6.11.

| Method | Route | Purpose | Roles |
|---|---|---|---|
| GET | `/cash/balance-sheet` | Own current expected cash + transaction feed | FB, IM, PD |
| GET | `/cash/balance-sheet/:portalUserId` | Any user's balance sheet (oversight) | SA, AD, PSA, PM\* | \*PM only if granted (D09 p.2) |
| POST | `/cash/petty-cash-issues` | Issue petty cash/advance | SA, AD, PSA |
| POST | `/cash/settlements` | Prepare + submit settlement (own only — enforced by `submitted_by = self`) | FB, IM, PD |
| GET | `/cash/settlements?userId=&status=&from=&to=` | List settlements | SA, AD, PSA, PM\* |
| GET | `/cash/settlements/:id` | Settlement detail | Owner, SA, AD, PSA, PM\* |
| POST | `/cash/settlements/:id/review` | Accept / Partial Accept / Return / Reject | SA, AD, PSA, PM\* | Executes custody transfer atomically |
| GET | `/cash/reports/consolidated` | Total cash held, pending settlements, non-cash totals, accountability deltas | SA, AD, PSA |

### 8.13 Reports (cross-module aggregation endpoints)

| Method | Route | Purpose | Roles |
|---|---|---|---|
| GET | `/reports/dashboard` | Portal-specific dashboard KPIs (§4.13) | All (portal-scoped) |
| GET | `/reports/:module/:reportName?from=&to=&format=json\|pdf\|excel` | Any named report from §4/§10, filtered, exportable | Per §3.3 matrix |
| GET | `/reports/staff/:id/full-profile-report` | Combined attendance+salary+commission+employment export | SA, AD |

**Audit requirement (applies to every mutating endpoint above):** the `auditLog` middleware (§7.6) records actor, action, entity, and before/after state without exception — this is not repeated per row in the tables above to avoid redundancy but is a blanket requirement.

---

## 9. Frontend Architecture

**[RECOMMENDATION — mandatory stack: Next.js + TypeScript]**

### 9.1 App Router structure

```
frontend/
├── app/
│   ├── (public)/
│   │   └── login/page.tsx
│   ├── (portal)/                       # authenticated layout group, role-gated
│   │   ├── layout.tsx                   # sidebar + top bar shell (§17 UI spec shared layout, D17 p.2)
│   │   ├── super-admin/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── hospital-management/{departments,services,wards,panels}/page.tsx
│   │   │   ├── users-workforce/{admin-users,staff-users,shifts,attendance}/page.tsx
│   │   │   ├── payroll/{salary,commission}/page.tsx
│   │   │   ├── patients-operations/{panel-registry,appointments-overview}/page.tsx
│   │   │   ├── financial-control/{billing,collections,discounts,refunds,outstanding,petty-cash,balance-sheets,settlements}/page.tsx
│   │   │   ├── oversight/{inventory,pharmacy}/page.tsx
│   │   │   └── reports/, system-settings/
│   │   ├── admin/                       # mirrors super-admin/ minus protected-account screens
│   │   ├── front-desk-billing/
│   │   │   ├── dashboard/, appointments/, encounter-intake/, opd/, observation/, emergency/
│   │   │   ├── invoices/, payment-requests/, discounts/, refunds/, outstanding/, panel-billing/
│   │   │   └── my-balance-sheet/, my-settlement/, reports/
│   │   ├── admission/
│   │   │   ├── dashboard/, planned/, check-in/, bed-board/, active/
│   │   │   ├── services/, medication-mode/, pharmacy-requests/, payment-requests/
│   │   │   └── clearances/, discharge/, reports/
│   │   ├── inventory/
│   │   │   ├── dashboard/, items/, categories-units/, suppliers/, locations/
│   │   │   ├── purchase-requirements/, fund-requests/, purchases/
│   │   │   ├── stock-ledger/, supplier-ledger/, stock-balance/
│   │   │   ├── department-issues/, transfers/, supplier-returns/, adjustments/, low-stock/
│   │   │   └── expenses/, my-balance-sheet/, my-settlement/, reports/
│   │   ├── pharmacy-super-admin/  ├── pharmacy-manager/  └── pharmacy-sales-dispensing/
│   │   │        (mirrors the Pharmacy navigation groups in D17 §7–9, one route tree per portal)
│   └── api/                             # Next.js route handlers ONLY for BFF concerns (e.g., file-download proxy);
│                                          # all business data flows through the Express REST API (§8), never re-implemented here
├── components/
│   ├── ui/                              # design-system primitives (button, input, table, drawer, badge, KPI tile)
│   ├── layout/                          # Sidebar, TopBar, PageHeader, Breadcrumb
│   ├── forms/                           # reusable form field wrappers bound to react-hook-form + zod
│   └── domain/                          # module-specific composed components (InvoiceLineEditor, BedBoard, FefoBatchPicker...)
├── lib/
│   ├── api-client.ts                     # typed fetch wrapper (§9.6)
│   ├── auth/                             # access-token memory store, refresh-on-401 interceptor
│   ├── permissions.ts                    # role→module→action helper, mirrors §3.3 (UI-side hint only, §3.4)
│   └── query-client.ts                   # TanStack Query client config
├── hooks/
├── types/                                # generated/shared from backend Zod schemas (§7.7)
├── middleware.ts                          # Next.js middleware: route guard by role before render
├── next.config.js
└── .env.production
```

### 9.2 Public vs. protected routes

- **Public:** `/login` only. Every other route sits under the `(portal)` layout group, which is guarded twice: `middleware.ts` (Edge, redirects unauthenticated requests to `/login` before any render) and a client-side `AuthProvider` that re-validates the session on mount (handles token expiry mid-session).
- **Protected, role-scoped:** each portal's route subtree (`/super-admin/*`, `/admission/*`, etc.) is additionally gated so a `FRONT_DESK_BILLING` user hitting `/admission/*` directly is redirected — **[RECOMMENDATION]** this is a UX convenience; the authoritative check is always the backend (§3.4).

### 9.3 Role-based navigation

The sidebar renders from the **same** policy data source as the backend's `authorize` middleware (§7.9), fetched once via `GET /me` at login (§8.3) and cached in the auth context — this guarantees the nav a user sees is never out of sync with what their token can actually do. Navigation groups per portal match §17 UI spec verbatim (D17 §2–9) — e.g., Super Admin: Overview / Hospital Management / Users & Workforce / Payroll / Patients & Operations / Financial Control / Oversight / Reporting & System.

### 9.4 Layouts

- **Shared layout standard [CONFIRMED, D17 p.2]:** left sidebar (portal name, module groups, current-page highlight, quick module search, Logout at bottom); top bar (hospital/pharmacy identity, notifications, logged-in user, portal badge, profile menu); page header (breadcrumb, title, short description, primary action on the right).
- **[RECOMMENDATION]** Implemented as one `PortalLayout` component parameterized by role, reused across all 8 portal route trees rather than 8 duplicated layouts — keeps the shared UI conventions (§17) enforced structurally, not by convention alone.

### 9.5 Pages, forms, tables, filters, dashboards

- **List/master pages [CONFIRMED, D17 p.2]:** search + filters + status badges + pagination/result count + Add New/View/Edit/Activate-Deactivate/Import Excel/Export actions.
- **Transactional pages:** header + line items + totals + actor/status, with Save Draft / Confirm-Post pattern for multi-step postings (e.g., purchase receipt, admission service posting).
- **Report pages [CONFIRMED, D17 p.2]:** From Date + To Date + quick presets + report-specific filters + PDF/Excel/Print.
- **Cash settlement pages [CONFIRMED, D17 p.2]:** opening cash, cash in/out, online totals, expected cash, physical cash, variance + Prepare Settlement/Submit/View Receipt/Print.
- **[RECOMMENDATION]** Tables use a shared `<DataTable>` component (TanStack Table) with server-side pagination/sorting/filtering bound directly to the §8 list-endpoint query params — no client-side-only pagination on datasets that can grow unbounded (ledgers, invoices).
- **Dashboards:** KPI tiles + recent-activity feed + alert cards, content per §4.13 per-portal breakdown, built with the charting guidance the project's dataviz conventions provide (not a source requirement — visual only).

### 9.6 State management, API client, form validation

- **Server state:** **TanStack Query** — every list/detail view is a query keyed by endpoint+params; every mutation (Book Appointment, Collect Payment, Generate Salary, etc.) is a `useMutation` that invalidates the relevant query keys on success, giving automatic refetch-and-reflect for the "no silent history changes" transparency the source requires.
- **Client/local state:** React state/context for pure UI concerns (drawer open/closed, wizard step); no global client-state library is needed given TanStack Query owns server state.
- **API client [RECOMMENDATION]:** a single typed `apiClient` (thin `fetch` wrapper) that: attaches the in-memory access token, retries once on `401` after a silent `/auth/refresh` call, and throws a typed `ApiError` matching the §8.2 envelope so components handle errors uniformly.
- **Form validation:** `react-hook-form` + the **same Zod schemas** the backend validates with (§7.7, shared package) — client-side validation is therefore never allowed to drift from server-side validation; a form cannot accept something the API would reject.

### 9.7 Authentication state & permission-based UI rendering

- `AuthProvider` holds `{ user, role, permissions }` from `GET /me`, exposes a `useCan(module, action)` hook used to conditionally render/disable buttons — e.g., an Admin's "Delete Super Admin" button is never rendered, and if somehow triggered, the backend still returns `403` (§3.4 — UI hiding is UX only, never the security boundary).
- Access token lives in memory (a module-level variable / React context, not `localStorage`/`sessionStorage`) to reduce XSS token-theft surface (§7.8, §11.1); refresh token is an `HttpOnly` cookie the frontend never reads directly.

### 9.8 Loading, empty, success, and error states

**[RECOMMENDATION]** Every data-bound page implements all four states explicitly via the shared `<DataTable>`/`<DetailView>` primitives: skeleton loaders (not spinners, for perceived-performance on list pages), a designed empty state with the primary "Add New" action inline (not just "No data"), toast + inline field errors mapped from the §8.2 error envelope, and optimistic UI only where a failed rollback is cheap (never for financial postings — those wait for server confirmation given the "no silent history" requirement).

### 9.9 Responsive behavior & accessibility

- **[RECOMMENDATION]** Desktop-first (hospital back-office usage pattern implied throughout the source — no mobile-specific screen is described), but responsive down to tablet width for ward-side/bedside use (Admission's Bed Board is a plausible tablet-in-hand screen). Sidebar collapses to an icon rail below a breakpoint; tables switch to a card layout below ~768px for the highest-traffic screens (Appointments, Invoices).
- **Accessibility [RECOMMENDATION — not a source requirement, standard practice, see §16]:** WCAG 2.1 AA target — semantic landmarks, keyboard-navigable tables/forms, visible focus states, color contrast ≥4.5:1 for status badges (a real risk given how heavily this UI relies on color-coded statuses, D17 throughout), `aria-live` regions for toast notifications.

### 9.10 Reusable components (domain-specific, built once, used across portals)

| Component | Used in |
|---|---|
| `<PatientPicker>` (Panel search / temporary identity capture) | Appointments, Admission, Pharmacy retail sale |
| `<InvoiceLineEditor>` | OPD/OBS/ER billing, Admission service posting, Pharmacy sale |
| `<DiscountRequestModal>` (threshold-aware, routes to approval) | Billing, Pharmacy sale |
| `<SettlementWizard>` (Prepare → Count → Submit) | Front Desk, Inventory, Pharmacy Sales/Dispensing — one component, three `moduleScope` values |
| `<BedBoard>` (ward/room/bed occupancy grid) | Admission |
| `<FefoBatchPicker>` (suggested batch, overridable+logged) | Pharmacy Manager, Pharmacy Sales/Dispensing |
| `<ClearanceChecklist>` (3-state gate) | Admission discharge |
| `<AuditTrailDrawer>` (original/corrected/reason/actor/time) | Attendance correction, Medication Mode change |
| `<ReportToolbar>` (From/To + presets + PDF/Excel/Print) | Every report page |

### 9.11 Production environment configuration

- `NEXT_PUBLIC_API_BASE_URL` — the Express API's public origin (never a same-origin assumption; frontend and backend are **separately deployed**, per the mandatory architecture, §13).
- Build-time-safe: no server secret is ever exposed via `NEXT_PUBLIC_*`; the access token is never persisted client-side; the refresh cookie's domain/flags are backend-controlled.
- **[RECOMMENDATION]** Static assets and pages that can be are statically optimized by Next.js; every authenticated portal page is rendered client-side or with per-request server rendering (no static generation of data that must reflect live permissions/financial state).

---

## 10. Reporting and Analytics

Every report named across D02–D10, D16 §21, and D17 is listed below with the fields required by the task brief. All reports share the conventions in §4.13/§9.5: From/To date + quick presets, module-specific filters, PDF/Excel/Print export that "respects active filters" (D17 p.2), and the configured Hospital Profile identity on every export header (D16 p.6).

| Report | Authorized users | Data source | Filters | Key columns | Calculations | Grouping/Totals | Export |
|---|---|---|---|---|---|---|---|
| Individual Staff Attendance Report | SA, AD | `attendance_records`, `attendance_corrections` | staff, department, from/to, status | Date, Shift, In/Out, Late/Early Min, Status, Correction flag | Late/Early Minutes (§4.3) | Totals: days present/absent/late; grand total worked minutes | PDF, Excel, Print |
| Individual Staff Salary Report / History | SA, AD | `salary_batches`, `salary_batch_lines`, `salary_payments` | staff, period, status | Period, Base, Deductions, Allowances, Adjustments, Generated, Paid, Outstanding | Generated Salary formula (§4.4) | Totals per period; running outstanding | PDF, Excel, Print |
| Individual Staff Commission Report / History | SA, AD | `commission_statements`, `commission_statement_lines`, `commission_payments`, `commission_reversals` | doctor, period, status | Service, Qty, Rule, Amount, Reversals | Commission formulas (§4.5) | Totals per doctor/service type | PDF, Excel, Print |
| Employment / Shift History | SA, AD | `staff_employment_history` | staff, date range | Department, Designation, Shift, Effective From/To | — | — | PDF, Excel, Print |
| Appointments Report | FB, SA, AD | `appointments` | doctor, department, date, status | Patient, Doctor, Dept, Slot, Status, Advance | — | Count by status | PDF, Excel, Print |
| Billing / Collections Report | FB (own), SA, AD | `payments`, `invoices` | user, method, encounter type, date | Date, Patient, Invoice, Method, Amount, Collected By | Cash vs. non-cash split (§4.9) | Totals by method/user/date | PDF, Excel, Print |
| Discounts Report | FB, SA, AD | `discounts` | date, approver, status | Invoice, Service, %/Amount, Reason, Approver | — | Total discount value | PDF, Excel, Print |
| Refunds Report | FB, SA, AD | `refunds` | date, status | Original receipt, Amount, Reason, Method, Approver | — | Total refunded | PDF, Excel, Print |
| Outstanding Balances Report | FB, SA, AD | `invoices` (status ≠ PAID) | date, patient type | Invoice, Patient, Total, Paid, Outstanding | Outstanding formula (§4.6) | Aging buckets **[ASSUMPTION — bucket thresholds TBD, §16]** | PDF, Excel, Print |
| Admission Partial/Final Payments Report | FB, AM, SA, AD | `payments` (admission-sourced), `payment_requests` | admission, date | Request type, Requested, Collected, Balance | Admission Hospital Due (§4.6) | Total per admission | PDF, Excel, Print |
| Planned/Active Admissions & Bed Occupancy | AM, SA, AD | `admissions`, `beds`, `bed_transfers` | department, ward, status, date | Patient, Doctor, Bed, Status, Admitted date | Occupancy % **[ASSUMPTION]** | By ward/department | PDF, Excel, Print |
| Medication Mode Change Report | AM, SA, AD | `medication_mode_changes` | admission, date | Previous/New Mode, Reason, Changed By/At | — | — | PDF, Excel, Print |
| Discharge Readiness / Clearance Delay Report | AM, SA, AD | `discharge_clearances` | status, department | Admission, Clinical/Hospital/Pharmacy status, Days pending | Days-pending = now − raised date | By clearance type | PDF, Excel, Print |
| HMS Inventory Stock Ledger | IM, SA, AD | `inventory_stock_ledger` | item, location, movement type, date | Date, Item, Movement, Qty Δ, Running Balance, Actor | Running balance via window function (§6.14) | Per item/location | PDF, Excel, Print |
| HMS Inventory Supplier Ledger / Outstanding | IM, SA, AD | `inventory_supplier_ledger` | supplier, date | Date, Type, Amount, Reference | Supplier Outstanding (§4.8) | Per supplier | PDF, Excel, Print |
| Low-Stock / Reorder Report | IM, SA, AD | `inventory_items`, ledger aggregate | category, location | Item, Available Qty, Reorder Level, Suggested Qty | Reorder Need (§4.8) | — | PDF, Excel, Print |
| Department Issue/Return Report | IM, SA, AD | `department_issues`, lines | department, date | Item, Qty issued, Qty returned, Issued By | — | Per department | PDF, Excel, Print |
| Inventory User Cash Balance & Settlement History | IM, SA, AD | `cash_transactions`, `account_settlements` (scope=INVENTORY) | user, date | Expected, Physical, Variance, Status | §4.9 Inventory formulas | Per user/period | PDF, Excel, Print |
| Pharmacy Medicine Stock Ledger | PM, PSA | `pharmacy_stock_ledger` | medicine, batch, location, date | Date, Movement, Qty Δ, Batch, Running Balance | §6.14 running balance | Per medicine/batch | PDF, Excel, Print |
| Batch / Near-Expiry / Expired Report | PM, PSA | `pharmacy_batches`, ledger | medicine, location | Batch, Expiry, Qty, Days to Expiry | Near Expiry formula (§4.10) | By expiry bucket | PDF, Excel, Print |
| Pharmacy Supplier Ledger / Outstanding | PM, PSA | `pharmacy_supplier_ledger` | supplier, date | Date, Type, Amount, Reference | §4.10 formula | Per supplier | PDF, Excel, Print |
| Pharmacy Sales / Dispensing Report | PD (own), PM, PSA | `pharmacy_sales`, `pharmacy_sale_lines` | user, channel, date | Medicine, Qty, Rate, Discount, Payer, Sold By | — | By user/date/channel | PDF, Excel, Print |
| HMS Integration Status Report | PM, PSA, SA, AD | `pharmacy_requests` | status, date | Admission, Medicine, Requested/Dispensed Qty, Status | — | By status | PDF, Excel, Print |
| Pharmacy Cash Balance & Settlement | PD (own), PM\*, PSA | `cash_transactions`, `account_settlements` (scope=PHARMACY) | user, date | Expected, Physical, Variance, Status | §4.9 Pharmacy formulas | Per user/period | PDF, Excel, Print |
| Management Consolidated Cash Report | SA, AD, PSA | `cash_transactions`, `account_settlements` (all scopes in own system) | date, module | Total held, Pending settlements, Non-cash totals, Accountability deltas | §4.9 management formulas | By module/user | PDF, Excel, Print |
| Hospital-Wide Dashboard Summary | SA, AD | cross-module aggregate | date | KPIs per §4.13 | — | — | PDF, Print (screen-primary) |

**Date and timezone handling [RECOMMENDATION, §11.13]:** all filters interpreted in the hospital's configured timezone (`hospital_profile.timezone`, default `Asia/Karachi`); stored as UTC; report headers show the timezone explicitly to avoid ambiguity across shift boundaries (relevant given overnight shifts, D16 p.19).

**Currency handling [CONFIRMED, D15 §15]:** rounding method is a system setting, applied identically across UI, PDF, Excel, and the stored transaction snapshot — never recomputed differently per output channel.

**Print requirements [CONFIRMED, D17 p.2]:** every transactional/report page offers Print in addition to PDF/Excel; printed output uses the same filtered result set, not a separate "print view" query.

**Data-scope restrictions:** every report row above inherits the §3.3 access-control matrix — a Front Desk/Billing user's "own" reports are pre-filtered to `collected_by = self` unless they hold oversight (Super Admin/Admin).

---
