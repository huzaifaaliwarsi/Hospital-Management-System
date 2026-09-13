# Super Admin Portal — Hardcoded Data & Backend Wiring Audit

**Date:** 2026-09-13
**Scope:** Every page reachable from the Super Admin portal navigation (device integration & attendance intentionally excluded per instruction).
**Method:** Traced every Super Admin frontend view → its service file → whether that service calls `apiClient` (real backend) or `localStorage`/in-file `MOCK_*` arrays. Cross-checked against actual backend routes (`hms-backend/src/modules/**/*.routes.ts`) and Prisma schema.

## Headline finding

**Every single Super Admin page is currently 100% mock / localStorage-driven.** None of the 8 functional modules call the backend today, even though the backend and frontend live in the same repo with a working `apiClient` + JWT auth pipeline already proven out by the login flow (`authApiService` → `POST /auth/login`).

There is also one orphaned file, `services/setupApiService.ts`, that already tries to talk to the backend but is imported nowhere, and its endpoint paths don't even match the real backend routes (`/setup/profile` vs actual `/setup/hospital-profile`, `/setup/service-rates` vs actual `/setup/services-rates`, etc.). It should be deleted/replaced, not extended.

## Page-by-page matrix

| # | Super Admin Page | Frontend component | Data source today | Backend route(s) available | Status |
|---|---|---|---|---|---|
| 1 | Hospital Overview | `SuperAdminHospitalOverview.tsx` | `hospitalProfileService.ts` → `localStorage` only | `GET/PUT /setup/hospital-profile` ✅ exists | **Backend ready — needs frontend rewire** |
| 2 | Departments | `SuperAdminDepartmentsView.tsx` | `departmentService.ts` → `departmentMockData.ts` (422 lines) + `localStorage` | `GET/POST/PATCH /setup/departments`, `POST /setup/departments/:id/deactivate` ✅ exists | **Backend ready — needs frontend rewire** |
| 3 | Services & Rates | `SuperAdminServicesRatesView.tsx` | `serviceRatesService.ts` → in-file mock + `localStorage` | `GET/POST/PATCH /setup/services-rates`, deactivate ✅ exists | **Backend ready — needs frontend rewire** |
| 4 | Wards / Rooms / Beds | `SuperAdminWardsRoomsBedsView.tsx` | `wardsRoomsBedsService.ts` → mock + `localStorage` | `GET /setup/wards-rooms-beds`, `POST/PATCH` wards/rooms/beds ✅ exists | **Backend ready — needs frontend rewire** |
| 5 | Admin Users | `SuperAdminAdminUsersView.tsx` | `adminUserService.ts` → mock + `localStorage` | ❌ **No portal-account (login) management API exists at all.** `staff.routes.ts` only manages the HR `Staff` record — no username/password/role/status/reset-password endpoints. | **Backend gap — must build "Portal Users" module first** |
| 6 | Staff Users | `SuperAdminStaffUsersView.tsx` | `staffUserService.ts` → mock + `localStorage` | `GET/POST/PATCH /staff`, `/staff/:id/deactivate`, `/staff/:id/360` ✅ exists for the HR profile, but same login-account gap as above (assigning a portal, username, shift, reset password) | **Partial backend — HR side ready, login/account side missing (shared gap with #5)** |
| 7 | Shift Management | `ShiftManagementView.tsx` | `shiftService.ts` → mock + `localStorage` | ❌ **No `Shift` model in Prisma schema at all**, no shift module/routes. (`StaffEmploymentHistory` has shift *fields* but no dedicated roster/shift-definition entity or endpoints.) | **Backend gap — must design + build Shift module** |
| 8 | Corporate Panels | (rendered via legacy `SuperAdminModuleView.tsx` mock tables — no dedicated view file yet) | `panelService.ts` → mock | `GET/POST/PATCH /setup/corporate-panels`, `PUT /setup/corporate-panels/:id/discount-rules` ✅ exists | **Backend ready — no dedicated frontend view yet; needs both a real view component and wiring** |
| 9 | Panel Patient Registry | `PatientRegistryView.tsx` | `patientRegistryService.ts` → mock | `GET/POST/PATCH /patients/panel` ✅ exists | **Backend ready — needs frontend rewire** |
| 10 | Reports (management/billing/collection/admission/inventory/staff/salary/commission) | `SuperAdminReportsView.tsx` | Fully static/mock | `reports.routes.ts` is a **scaffold only** (`GET /reports/_scaffold`) — zero real report endpoints | **Backend gap — lowest priority, largest scope; treat as its own phase** |
| 11 | Super Admin Dashboard (landing page KPIs) | `SuperAdminDashboard.tsx` | `superAdminDashboardData.ts` (1,759 lines of hand-authored KPI/chart data) | Would need aggregation endpoints across setup/frontdesk/admission/inventory/pharmacy/cash | **Backend gap — needs a dashboard/aggregation endpoint; do last, after underlying modules are real** |

Attendance and any biometric device integration pages are explicitly out of scope per instruction, even though `AttendanceRecord`/`BiometricRawPunch` models and `/attendance` routes already exist server-side.

## Root causes found

1. **No service in `src/services/` for Super Admin modules calls `apiClient`.** They all read/write `localStorage` under keys like `css_hms_departments_dataset_v1`, seeded from in-file `MOCK_*`/`INITIAL_*` constants. This is why "data hardcoded lag raha hai" — it's not fetched from the DB, it's fabricated in the browser bundle.
2. **`setupApiService.ts` is dead code** — written against a guessed API shape that doesn't match the real backend contract, and never imported by any component.
3. **Two real backend gaps block the two account-management pages entirely**: there is no concept of "give this employee a login" in the API yet (no username/password/role/status/reset-password surface), and no `Shift` data model at all.
4. **Corporate Panels has no dedicated view component** — right now it silently falls through to the old catch-all `SuperAdminModuleView.tsx`, which still contains ~1,300 lines of legacy mock-table JSX for modules that already got proper dedicated views elsewhere (dead code that should eventually be trimmed once Corporate Panels gets its own view).
5. **Reports and the Dashboard are aggregation-heavy** and depend on every other module being real first — they are correctly last in sequence.

## What "done" means for each page (definition of done)

For every page above, "complete" = the page's Create/Read/Update/Delete/Import/Export/Search/Filter actions all round-trip through `apiClient` to the real Postgres-backed Prisma models, with:
- Loading states while a request is in flight
- Real error messages surfaced from the backend (already supported by `apiClient`'s interceptor)
- No `localStorage` used as the source of truth (only, at most, non-critical UI prefs like a remembered filter)
- No `MOCK_*` / `INITIAL_*` seed arrays left importable in production code paths

See **`SUPERADMIN_COMPLETION_PLAN.md`** for the phased, trackable execution plan against this audit.
