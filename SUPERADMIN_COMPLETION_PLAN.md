# Super Admin Portal — Step-by-Step Completion Plan (Living Tracker)

Companion to `SUPERADMIN_AUDIT.md`. This file is the single source of truth for progress — update checkboxes as work lands. Device integration and Attendance are explicitly **out of scope** for this plan (per instruction) even though referenced backend models already exist.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Phase 0 — Analysis & Planning
- [x] Full audit of every Super Admin page vs backend routes vs Prisma schema → `SUPERADMIN_AUDIT.md`
- [x] This tracker

## Phase 1 — Backend gap-filling (must happen before frontend rewiring of the pages that need it)

### 1.1 Portal User (login account) management — blocks Admin Users + Staff Users pages ✅ DONE (2026-09-13)
- [x] `portalUser.schemas.ts`: create-login (staffId?, username, email?, password, role, isCashHandling), update, reset-password, status body schemas
- [x] `portalUser.repository.ts` + `portalUser.service.ts` + `portalUser.controller.ts`: list (filterable via `?roles=SUPER_ADMIN,ADMIN`), get by id, create login (optionally linked to a `Staff` record), update, reset password (admin-forced, sets `mustResetPassword=true` + revokes sessions), status (ACTIVE/SUSPENDED, revokes sessions on suspend), hard delete with FK-conflict guard (tells caller to suspend instead), `isProtected` accounts blocked from suspend/reset-password/delete
- [x] `portalUser.routes.ts`, mounted standalone at **`/api/v1/portal-users`** (NOT nested under `/staff` — avoids colliding with `staff.routes.ts`'s `/:id` pattern)
- [x] Wired into `app.ts`
- [x] Uses existing `authorize('identity', ...)` policy (already full-access for SUPER_ADMIN/ADMIN)
- [x] End-to-end smoke tested against the live dev DB: login → create → reset-password → suspend → protected-account rejection → delete. All verified working.

### 1.2 Shift Management — blocks Shift Management page ✅ DONE (2026-09-13)
- [x] Added `Shift` Prisma model (code, name, departmentId, shiftType enum, startTime/endTime HH:mm, breakMinutes, arrival-grace/early-exit tolerance minutes, defaultWeeklyOffDays string[], isActive, full audit trail) — matches the frontend `types/shift.ts` contract exactly. Duration/overnight-ness deliberately NOT persisted (pure derivation from start/end/break, computed client-side same as today via `calculateShiftTiming`). Staff→shift assignment continues to use the existing `StaffEmploymentHistory` row (not duplicated) — this master just gives it a real, selectable source of truth instead of free-typed text.
- [x] Migration `20260913113131_add_shift_master` generated via `prisma migrate diff` (non-interactive `migrate dev` workaround) and applied with `prisma migrate deploy` after baselining the pre-existing init migration
- [x] Folded into `setup.schemas.ts` / `setup.service.ts` / `setup.controller.ts` (matches existing setup-module convention of one file per layer, no separate repository)
- [x] Routes added to `setup.routes.ts`: `GET/POST /setup/shifts`, `PATCH /setup/shifts/:id`, `POST /setup/shifts/:id/deactivate`
- [x] Smoke tested: created a Morning shift against a real department, deactivated it — verified.

### 1.3 Corporate Panels — backend already complete, just needs a real frontend view (tracked in Phase 2)

### 1.4 Reports engine — scope this properly, do NOT attempt inline
- [ ] Write a short `REPORTS_SCOPE.md` enumerating exactly which report endpoints are needed (management/billing/collection/admission/inventory/staff/salary/commission) and their expected filters/columns, based on `PROJECT_MASTER_SPEC.md` §4/§8 and the `prompts/` folder
- [ ] Build incrementally, one report type at a time, after Phase 2 modules are live (reports read from the same tables Phase 2 makes real)

### 1.5 Dashboard aggregation endpoint(s)
- [ ] `GET /reports/dashboard/super-admin` (or similar) returning real counts: departments, staff, beds occupancy, today's revenue, etc. — built last, once the underlying modules are real, otherwise it would just be aggregating mock data under a real-looking wrapper

---

## Phase 2 — Frontend rewiring (mock → real API), in priority order

Priority order chosen by: (a) backend already ready = fastest real wins first, (b) most-used pages first.

### 2.1 Hospital Overview ✅ DONE (2026-09-13)
- [x] Extended backend `HospitalProfile` model (`extendedProfile` JSON blob + `createdAt`/`createdBy` columns, migration `20260913113710_extend_hospital_profile`) and `updateHospitalProfileSchema` to accept the full frontend field set (identity/contact/address/operations/working-hours/billing — see audit)
- [x] Added `resolveActorLabel()` so `createdBy`/`updatedBy` store a real "Username (Role)" string instead of a bare PortalUser id
- [x] Rewrote `hospitalProfileService.ts`: `fetchHospitalProfile()`/`saveHospitalProfile()` call `GET/PUT /api/v1/setup/hospital-profile` via `apiClient`; kept a synchronous `getHospitalProfile()` reading an in-memory cache (populated only from real backend responses, never localStorage/mock) for the ~15 print/export helpers that need synchronous letterhead data
- [x] `AuthContext.tsx` primes that cache once per authenticated session (`primeHospitalProfileCache()`)
- [x] `SuperAdminHospitalOverview.tsx` now does a real async load with loading/error/retry states; `EditHospitalProfileModal.tsx` awaits the real save, shows a saving spinner, surfaces real backend error messages, and no longer fabricates `updatedAt`/`updatedBy` client-side
- [x] `npm run typecheck` (backend) and `npm run lint` (frontend `tsc --noEmit`) both clean; end-to-end verified against the live dev DB (GET/PUT round-trip, value persists across requests)

### 2.2 Departments ✅ DONE (2026-09-13)
- [x] Extended backend `Department` model: `description`, `contactExtension`, `location`, `supportsObservation`, `supportsEmergency`, `pharmacyRelated`, `statusChangedAt`/`statusChangedBy`, and widened the `DepartmentType` enum from 2 to all 8 frontend values (migration `20260913114702_extend_department`)
- [x] `setup.service.ts` departments block now returns real computed `doctorCount`/`staffCount`/`serviceCount`/`wardCount` (via `_count` + a `staff.groupBy` for doctors — never stored, always derived) and resolved `createdByLabel`/`updatedByLabel`/`statusChangedBy` actor labels; duplicate department codes now surface as a clean `ConflictError` instead of a raw Prisma error
- [x] Rewrote `departmentService.ts` end-to-end against `/api/v1/setup/departments*` — kept the same public method names/signatures so the ~10 dependent files (Services & Rates, Wards/Rooms/Beds, Staff Users, Shift Management, exports) keep working unchanged, backed by an in-memory `cachedDepartments` (primed once per session in `AuthContext`, same pattern as the hospital profile) instead of localStorage
- [x] Removed the old `resolveCanonicalDepartment` hardcoded `'DEP-01'..'DEP-12'` legacy-id/keyword map — meaningless against real UUIDs, was actively wrong
- [x] `deleteDepartment()` now honestly always guides to deactivation (the backend has no hard-delete for departments, by design, same as Staff) instead of pretending a delete could succeed; `DeleteSafeguardModal.tsx` updated to match
- [x] `SuperAdminDepartmentsView.tsx` does a real async load with loading/error/retry states
- [x] `ImportDepartmentsModal.tsx` now persists each validated row via a real `POST /setup/departments` call (loop with per-row error collection) instead of injecting locally-fabricated records into state
- [x] Known, flagged limitation: the "Head / In-charge" picker still sources options from `departmentMockData.ts`'s placeholder `DOC-xxx` ids (real `headStaffId` is only sent when the value is an actual UUID) — will resolve naturally once Staff Users (2.8) wires real Staff records
- [x] Backend `npm run typecheck`/`test` and frontend `npm run lint` (`tsc --noEmit`) all clean; full CRUD + status-toggle verified end-to-end against the live dev DB
- [ ] Follow-up (not blocking): delete `departmentMockData.ts` once the Head/In-charge picker (depends on 2.8) no longer needs it

### 2.3 Services & Rates ✅ DONE (2026-09-13)
- [x] Extended backend `ServiceRate` model: `description`, `statusChangedAt`/`statusChangedBy`, `updatedById`+relation (migration `20260913121457_...`); `setup.service.ts` now returns real `linkedInvoiceCount`/`linkedPanelRuleCount` (via `_count`) and resolved actor labels; duplicate codes → clean `ConflictError`
- [x] Rewrote `serviceRatesService.ts` against `/api/v1/setup/services-rates*` — same in-memory-cache pattern as Departments, `primeServicesCache()` added to `AuthContext`
- [x] `deleteService()` now honestly reflects the backend (no hard-delete — guides to deactivate)
- [x] `SuperAdminServicesRatesView.tsx` real async load/error/retry + async create/edit/status-toggle/delete
- [x] `ServiceImportModal.tsx` now persists each row via real `POST /setup/services-rates` (loop + failure collection) instead of fabricating local records
- [x] Backend typecheck/tests + frontend `tsc --noEmit` clean; full CRUD verified end-to-end against the live dev DB

### 2.4 Wards / Rooms / Beds ✅ DONE (2026-09-13)
- [x] Extended backend `Ward`/`Room`/`Bed` models: `code` (unique), `Ward` gets genderPolicy/floor/location/description/statusChanged*/updatedBy; `Room` gets roomNumber/floor/capacity/dailyRoomRate/statusChanged*/updatedBy; `Bed` gets bedType, new **orthogonal** `BedOperationalStatus` enum (ACTIVE/CLEANING/MAINTENANCE/OUT_OF_SERVICE/DECOMMISSIONED) + statusChanged*/updatedBy — deliberately did NOT touch `Bed.status` (occupancy), which the Admission module already owns and 11 passing admission tests depend on (migration `20260913121457_...`)
- [x] `setup.service.ts`'s `listWardHierarchy()` now returns the full nested Department→Ward→Room→Bed tree with real computed `roomCount`/`bedCount`/`availableBeds` at every level, resolved actor labels throughout, and — importantly — each bed's **current occupant is derived live from `AdmissionRecord`** (`status=ACTIVE` for that `bedId`, patient name resolved from `PanelPatient`/`SelfPayEncounter`) rather than duplicated/stored on `Bed` itself
- [x] Rewrote `wardsRoomsBedsService.ts` (2030 → ~650 lines, all `INITIAL_WARDS`/`INITIAL_ROOMS`/`INITIAL_BEDS` mock data removed): one `fetchWardHierarchy()` call flattens the nested response into the three cached `Ward[]`/`Room[]`/`Bed[]` arrays the existing flat-list UI expects; `primeWardsRoomsBedsCache()` added to `AuthContext`
- [x] `deleteWard`/`deleteRoom`/`deleteBed` now honestly reflect the backend (no hard-delete routes exist — guide to deactivate/decommission)
- [x] `SuperAdminWardsRoomsBedsView.tsx` real async load/error/retry + async create/edit/status-toggle/delete for all three entities
- [x] `WardsRoomsBedsImportModal.tsx` now persists each row via real backend calls (loop + failure collection) for all three import types
- [x] Backend typecheck/tests (admission suite included) + frontend `tsc --noEmit` clean; full nested create/read verified end-to-end against the live dev DB

### 2.5 Corporate Panels — data layer ✅ DONE, dedicated view still outstanding (2026-09-13)
- [x] Extended backend `CorporatePanel` model: `code` (unique), `category`, `discountAgreement`; `setup.service.ts` now returns a real computed `activePatientsCount` (via `_count.panelPatients`, never stored/stale) and resolved actor labels; duplicate codes → `ConflictError` (migration `20260913132821_extend_corporate_panel`)
- [x] Rewrote `panelService.ts` — **this was fully hardcoded** (`CENTRAL_CORPORATE_PANELS`, 3 fake "Demo Corporate Panel" entries) and fed the panel picker on the Patient Registry page; now backed by `/api/v1/setup/corporate-panels`, same cache+prime pattern as everything else
- [x] Built the dedicated `SuperAdminCorporatePanelsView.tsx` (2026-09-13): KPI bar, search/status filter, table, Add/Edit modal, activate/deactivate confirm, and a discount-rule editor modal (add/remove rows against the real Services & Rates list, saved via `PUT /setup/corporate-panels/:id/discount-rules`) — wired into `SuperAdminModuleView.tsx`'s routing ahead of the legacy fallback. The old mock table for this module in that file (fed by `superAdminData.ts`'s `MOCK_CORPORATE_PANELS`) is now unreachable dead code, same as the other modules that already got dedicated views earlier — left in place rather than risk excising shared JSX from that 1900+ line file (tracked in Phase 3 cleanup)
- [x] Full create → discount-rules → deactivate flow verified end-to-end against the live dev DB

### 2.6 Panel Patient Registry ✅ DONE (2026-09-13)
- [x] Extended backend `PanelPatient` model substantially to match the registry screen: `guardianRelation`, `alternatePhone`, `email`, `addressLine1/2`, `city`, `province`, `country`, `bloodGroup`, `emergencyContact*`, `status` (ACTIVE/INACTIVE/DECEASED, kept in sync with `isActive`) (migration `20260913132319_extend_panel_patient`); `patients.service.ts` now generates sequential `MR-<year>-<seq>` numbers server-side (was `Date.now()`-based), paginates, resolves actor labels, and surfaces `ConflictError` on the (extremely unlikely) MR collision
- [x] **Scoping decision, matching the backend's documented architecture (D16 p.7)**: this Super Admin screen is the *Panel* Patient Registry — a Panel Patient is a permanent, reusable identity tied to a Corporate Panel, while a Self-Pay visitor is a deliberately *temporary, per-visit* identity that is never reused and has no permanent registry record. So: Panel Patients are fully read/write here against `/api/v1/patients/panel*`; Self-Pay encounters (`/api/v1/patients/encounters`) still show up read-only (real data, not fabricated) but are registered/edited at Front Desk, not from this master registry — attempting to edit/status-change one here now returns a clear explanatory error instead of silently no-op'ing
- [x] Rewrote `patientRegistryService.ts` (1453 lines → ~430) — kept the CNIC/phone/name duplicate-detection heuristics as legitimate pre-submit client-side checks (now running against the real cached list instead of mock data); dropped the fake credential-adjacent audit bits that didn't exist for this domain anyway
- [x] Also fixed a **hardcoded date bug** found along the way: `calculateAgeFromDob` was computing every patient's age against a fixed `new Date(2026, 8, 9)` ("today" pinned to Sep 9 2026) instead of the real current date — now uses `new Date()`
- [x] `PatientRegistryView.tsx` + `PatientImportModal.tsx` real async load/error/retry and create/edit/status/import
- [x] Backend typecheck/tests + frontend `tsc --noEmit` clean; full panel-patient CRUD incl. new fields, pagination, and status transitions verified end-to-end against the live dev DB

### 2.7 Admin Users (depends on Phase 1.1) ✅ DONE (2026-09-13)
- [x] Extended backend `PortalUser` model: `displayName`, `phone`, `passwordResetAt`/`passwordResetBy` (migration `20260913124643_extend_portal_user`); `portalUser.service.ts` now sets real `createdBy`/`updatedBy`/`passwordResetBy` actor labels on every create/update/status-change/reset (previously unset)
- [x] Factored the actor-label helper (`resolveActorLabel`/`formatActorFromRelation`/`actorSelect`) out of `setup.service.ts` into a shared `src/shared/actorLabel.ts`, reused by both modules
- [x] Rewrote `adminUserService.ts` (1116 → ~330 lines) against `/api/v1/portal-users*` filtered to `roles=SUPER_ADMIN,ADMIN` — dropped the entire fake `AdminCredential`/audit-log localStorage system (the backend's real `AuditLog` table, populated automatically per request by `app.ts`'s `auditLog` middleware, is the actual audit trail now; there's just no read endpoint for it yet — tracked below)
- [x] **Fixed a session-restore regression this rewrite would have caused**: `AuthContext.tsx`'s `validateAndNormalizeRestoredSession()` used to re-validate a restored Super Admin/Admin session against `AdminUserService`'s synchronous cache, which is empty until the async prime call resolves — every page refresh would have logged users out. Now trusts the already-issued JWT (`session.token`) for those two roles, matching how the real backend enforcement (Bearer token on every API call) already works
- [x] Removed the dead offline-fallback plaintext-credential login path for Admin/Super Admin accounts in `AuthContext.tsx` (it depended on the now-deleted fake credential store); Admin/Super Admin login now has no insecure fallback — only the real backend call authenticates them. The Staff-side offline fallback is untouched for now (still uses the pre-existing, not-yet-rewired `StaffUserService`) and will get the same fix in 2.8
- [x] `SuperAdminAdminUsersView.tsx` + `AdminUserImportModal.tsx` real async load/error/retry and async create/edit/reset-password/status-toggle/delete/import
- [x] Backend typecheck/tests + frontend `tsc --noEmit` clean; create/reset-password/delete verified end-to-end against the live dev DB
- [ ] Follow-up (not blocking): a real `GET /audit-logs` read endpoint over the existing `AuditLog` table, so the Admin Users dossier/detail views can show genuine action history instead of omitting it

### 2.8 Staff Users (depends on Phase 1.1) ✅ DONE (2026-09-13)
- [x] Extended backend `Staff` model: `fatherGuardianName`, `cnic`, `alternatePhone` (migration `20260913125857_extend_staff`); `staff.service.ts` now sets real `createdBy`/`updatedBy` actor labels (was storing the raw PortalUser id string before); list/create/update/deactivate all include the linked `portalUser` so the Staff Users table gets access-type/username/status in one call, no per-row fetch
- [x] Rewrote `staffUserService.ts` (1607 → ~470 lines, dropped the fake `StaffCredential`/audit-log localStorage system) — combines two real resources per row: the HR record (`/api/v1/staff*`) and its optional linked login (`/api/v1/portal-users*`, `staffId` FK); "STAFF_RECORD_ONLY" is simply the real absence of a linked `PortalUser`, not a separate flag to fake
- [x] `createStaffUser`/`updateStaffUser` orchestrate both resources: create the HR record first, then create/update/remove the linked portal account as the access-type toggle changes, with a real backend response if removal is blocked by linked activity (guides to suspend instead)
- [x] **Fixed the same session-restore regression pattern for Staff** (2.7's `AdminUserService` fix, mirrored here) — `AuthContext.tsx` now trusts the JWT for restoring Front Desk/Admission/Inventory sessions too, instead of an empty synchronous `StaffUserService` cache; removed the now-dead offline plaintext-credential fallback for staff logins the same way
- [x] `SuperAdminStaffUsersView.tsx` + `StaffUserStatusModal.tsx`/`StaffUserResetPasswordModal.tsx`/`StaffUserDeleteModal.tsx`/`StaffUserImportModal.tsx` all real async now
- [x] Known, flagged limitation: the Staff Users form doesn't yet collect a joining date, so `createStaffUser` defaults it to "today" — a sensible default for a backend-required field, not fabricated history; worth adding a real date picker to the form later
- [x] Backend typecheck/tests + frontend `tsc --noEmit` clean; create/deactivate verified end-to-end against the live dev DB (including the linked `portalUser` embed)

### 2.9 Shift Management (depends on Phase 1.2) ✅ DONE (2026-09-13)
- [x] Added `statusChangedAt`/`statusChangedBy` to the `Shift` model (migration `20260913131554_extend_shift_status`) for parity with every other master; `setup.service.ts`'s shift methods now resolve real actor labels and duplicate codes surface as `ConflictError`
- [x] Rewrote `shiftService.ts` against `/api/v1/setup/shifts*` — kept `calculateShiftTiming`/`format12HourTime`/`formatMinutesToHours` etc. as pure client-side helpers (legitimate derivations, not data) and `validateShift` as a real pre-submit check against the live cache
- [x] `ShiftManagementView.tsx` real async load/error/retry + async create/edit/status-toggle
- [x] Backend typecheck/tests + frontend `tsc --noEmit` clean; create/deactivate with status-change tracking verified end-to-end against the live dev DB

### 2.10 Reports pages (depends on Phase 1.4)
- [ ] Wire `SuperAdminReportsView.tsx` per report type as each backend report endpoint lands

### 1.5 Dashboard aggregation endpoint(s) ✅ DONE (2026-09-14)
- [x] Built real aggregation endpoint `GET /api/v1/reports/dashboard/super-admin` in `reports` module. Aggregates live master infrastructure counts (departments, staff, doctors, corporate panels, panel patients), bed metrics with live occupancy from `AdmissionRecord` and `Bed.status`, billing/invoices summaries, patient flows, inventory alerts from `StockItem` and `StockLedger`, and recent audit records from `AuditLog`.

---

## Phase 2 — Frontend rewiring (mock → real API), in priority order
...
### 2.11 Super Admin Dashboard ✅ DONE (2026-09-14)
- [x] Created `src/services/dashboardService.ts` calling `/api/v1/reports/dashboard/super-admin` with in-memory caching.
- [x] Rewired `SuperAdminDashboard.tsx` to fetch live data asynchronously on mount and date filter changes (`today`, `yesterday`, `this_week`, `this_month`, `custom`). Added live database connection badge, async syncing spinner, and error retry state.
- [x] Bound KPI cards, global bed metrics, ward occupancy breakdown, inventory threshold alerts, attention required alerts, and recent audit activity table directly to live state.
- [x] Full test suite passing (38/38 tests including new `tests/dashboard.test.ts`), `npm run typecheck` and frontend `npm run lint` clean.

## Phase 3 — Cleanup
- [ ] Delete `services/setupApiService.ts` (orphaned/mismatched) once its intended purpose is covered by the rewired services above
- [ ] Delete all now-unused `MOCK_*`/`INITIAL_*` data files
- [ ] Remove the dead legacy mock-table JSX left in `SuperAdminModuleView.tsx` for modules that now have dedicated real views
- [ ] Full click-through smoke test of every Super Admin nav item against a freshly seeded DB (`prisma/seed.ts`)

---

## Execution log
_(most recent first — one line per session/batch of work)_

- **2026-09-14** — **Super Admin Dashboard real data integration complete**: Built `GET /api/v1/reports/dashboard/super-admin` aggregation endpoint, schemas, and service querying live PostgreSQL database. Created `services/dashboardService.ts` and rewired `SuperAdminDashboard.tsx` with live async loading, date filtering, live connection indicator, and error recovery. 38/38 vitest tests passing; frontend and backend typechecks 100% clean.
- **2026-09-13 (session 1, continued)** — **All 8 audited Super Admin pages now have a fully real, backend-verified data layer**: Hospital Overview, Departments, Services & Rates, Wards/Rooms/Beds, Admin Users, Staff Users, Shift Management, and Panel Patient Registry (2.1–2.9 all done; 2.5 Corporate Panels data layer done, dedicated view screen still outstanding as the one remaining UI gap — see 2.5 notes). 11 Prisma migrations applied total this session. Every backend change verified with `npm run typecheck` + `npm run test` (37/37 passing throughout) and real `curl` round-trips against the live dev Postgres DB; every frontend change verified with `tsc --noEmit` clean. Also fixed two real bugs found along the way: a hardcoded age-calculation reference date in Patient Registry, and a session-restore regression the Admin/Staff Users rewrite would otherwise have introduced (users getting logged out on every page refresh) — see 2.7/2.8 notes.
- **2026-09-13** — Phase 1 backend gaps closed: Portal User management module (`/api/v1/portal-users`) and Shift Master module (`/api/v1/setup/shifts`, new `Shift` Prisma model + migration) built and smoke-tested end-to-end against the live dev DB. `identity` typecheck/tests all green.
- **2026-09-13** — Phase 0 complete (audit + this plan).

## Post-completion bugs found while testing (fixed same day)
- **Every request 401 after ~15 minutes**: the access token (`JWT_ACCESS_TTL=15m`) was never refreshed — the frontend had no logic at all to use the refresh token (an httpOnly cookie set on login, `POST /auth/refresh`). Fixed in `apiClient.ts`: the response interceptor now silently calls `/auth/refresh` on a 401 (queueing concurrent requests during the refresh, retrying each once), and dispatches `auth:token-refreshed` / `auth:session-expired` window events that `AuthContext.tsx` listens for to keep its in-memory session in sync or fall back to a clean logout if refresh itself fails. Verified the cookie-based refresh round-trip directly against the live backend with curl.
- A related, smaller bug in the same file: `AuthContext.tsx` persists its session under a `token` field to the same localStorage key `apiClient.ts` reads `accessToken` from — whichever last wrote to that key could silently blank out the JWT. `getStoredAccessToken()` now checks both field names.
- `RouterContext.tsx` was always appending a `#/path` hash alongside `pushState` (meant for iframe-embedded fallback), making the address bar show the path twice standalone. Now only does that when actually embedded (`window.self !== window.top`).

## Resume prompts for the next session
_(paste one of these verbatim to continue exactly where this session left off — each is self-contained)_

**To continue with the Dashboard (recommended next):**
> Continue the Super Admin dynamic-data work per SUPERADMIN_COMPLETION_PLAN.md. All 8 master-data pages + Corporate Panels are done and verified. Now wire the Super Admin Dashboard (`features/dashboard/SuperAdminDashboard.tsx` + `superAdminDashboardData.ts`) to real data — but only the parts genuinely available from what's already real: department/staff/bed/ward counts, bed occupancy, active corporate panels, active panel patients. Leave revenue/billing/pharmacy/inventory/expense widgets clearly marked as pending (do NOT fabricate them) since those depend on the Front Desk/Pharmacy/Inventory/Cash portals, which are out of today's scope. Build a real aggregation endpoint (e.g. `GET /api/v1/reports/dashboard/super-admin`) that queries the already-real tables directly.

**To continue with Reports:**
> Continue the Super Admin dynamic-data work per SUPERADMIN_COMPLETION_PLAN.md. First write `REPORTS_SCOPE.md` enumerating exactly which report types/filters/columns are needed (management/billing/collection/admission/inventory/staff/salary/commission), based on `PROJECT_MASTER_SPEC.md` §4/§8 and the `prompts/` folder. Then build the backend `reports` module (currently a scaffold, `hms-backend/src/modules/reports/`) incrementally, one report type at a time, and wire `SuperAdminReportsView.tsx` to each as it lands. This module reads across Front Desk billing, Admission, Inventory, Pharmacy, and Cash data — much larger than the 8 master-data pages already done.

**To do smaller cleanup items instead:**
> Continue the Super Admin dynamic-data work per SUPERADMIN_COMPLETION_PLAN.md. Do the smaller flagged follow-ups: (1) add a real `GET /api/v1/audit-logs` read endpoint over the existing `AuditLog` table so Admin Users/Staff Users dossier views show genuine action history; (2) add a joining-date field to the Staff Users create form (currently defaults to today server-side); (3) delete now-dead files: `services/setupApiService.ts` (orphaned), `departmentMockData.ts`'s head-options list (once Staff Users' HR picker is wired in), `superAdminData.ts` (superseded), and the dead legacy mock JSX block for `corporate_panels` inside `SuperAdminModuleView.tsx`.

## What's left (in priority order)
1. **Corporate Panels dedicated view** (2.5) — data layer is done; needs a new `SuperAdminCorporatePanelsView.tsx` screen (list/create/edit/deactivate + discount-rule editor). No existing UI to build on, unlike every page above.
2. **Reports** (1.4) — needs real scoping first (`REPORTS_SCOPE.md`), then incremental backend + frontend per report type. Largest remaining phase.
3. **Super Admin Dashboard** (2.11) — a real aggregation endpoint, done last once everything it aggregates is real (it now can start, since the underlying modules are).
4. Minor follow-ups noted inline above: a `GET /audit-logs` read endpoint for the real `AuditLog` table (Admin/Staff Users dossier views), a joining-date field on the Staff Users create form, deleting now-dead mock data files (`departmentMockData.ts`'s head-options list, `superAdminData.ts`, `superAdminDashboardData.ts` once the Dashboard is real, orphaned `services/setupApiService.ts`).