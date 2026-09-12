# PHASE 3: Hospital Masters, Staff 360° Profiles & Patient Registry Endpoints

```markdown
TASK: Build REST APIs for Hospital Setup, Staff 360° Profiles, and Patient Registry

Context:
Refer to '16 Client.pdf' Sections 4, 5, 6, 31, 32. Eliminate all client-side mock arrays.

Instructions:
1. Hospital Setup APIs:
   - GET / PUT /api/v1/setup/hospital-profile:
     Hospital legal name, address, contact numbers, NTN, print header/footer template.
   - /api/v1/setup/departments:
     CRUD for clinical and administrative departments (Note: wards are NOT departments).
   - /api/v1/setup/services-rates:
     CRUD for standard billable services, base rates, panel discount eligibility.
   - /api/v1/setup/wards-rooms-beds:
     Manage Department -> Ward -> Room -> Bed hierarchy.
     Track bed status (Available, Occupied, Maintenance) and operational status.
   - /api/v1/setup/corporate-panels:
     Manage Corporate Panels, discount agreements, credit limits, and eligibility criteria.
2. Staff 360° Profile API:
   - /api/v1/staff (List, Create, Update, Deactivate).
   - GET /api/v1/staff/:id/360:
     Returns consolidated 360° view:
     * HR details (ID, designation, department, contact, joining date)
     * Linked Portal User credentials & status
     * Shift & duty roster history
     * Recent attendance overview
     * Staff-specific salary configuration (reusable templates vs employee actual rate)
     * Doctor commission configuration rules
3. Patient Registry API:
   - Enforce Pakistani CNIC validation (XXXXX-XXXXXXX-X) and Phone normalization (03XX-XXXXXXX).
   - GET /api/v1/patients/check-duplicate?cnic=...&phone=...
   - Permanent Panel Patients (/api/v1/patients/panel): Reusable patient masters linked to panel rules.
   - Temporary Self-Pay Encounters (/api/v1/patients/encounters): Encounter-specific identities; invoice & transaction history retained without polluting permanent master registry.
```
