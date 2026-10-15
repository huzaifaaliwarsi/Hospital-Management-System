# 🛠️ Biometric Device Integration Specification & Implementation Plan
**CH Sharif & Saeed Hospital — Hospital Management System (HMS)**  
*Document Version: 2.0 — Direct Cloud Push Architecture*  
*Target: Cloud/Vercel-hosted HMS Backend + PostgreSQL*  
*Integration Mode: HTTP/HTTPS ADMS / Device Push*  
*Local Agent: Not used*

---

## 🎯 Executive Overview
This document defines the final architecture and implementation plan for integrating physical biometric attendance devices (Fingerprint, Facial Recognition, RFID Card) with the HMS.

The approved architecture is **device-to-cloud push**. A supported biometric machine sends attendance punches directly to the public HMS backend over HTTP/HTTPS. The HMS backend does not open TCP/UDP connections to the machine's private LAN IP, does not poll port 4370, and does not require any local Windows service/agent.

This architecture is valid only for devices that support HTTP/HTTPS ADMS, cloud server mode, or another configurable HTTP push protocol. If a device supports only local TCP/UDP pull, it cannot be integrated directly with a public cloud backend without an additional network bridge/tunnel/agent.

The Super Admin Hospital Overview will manage device registration, status, staff biometric mappings, recent push activity, and attendance exceptions. Actual device network/server settings are configured on the physical biometric terminal.

---

## ✅ Final Architecture Rule

```
Physical Biometric Machine
(ZKTeco / Hikvision / Compatible Push Device)
        │
        │ HTTP/HTTPS ADMS / Cloud Push
        ▼
Public HMS Backend API
(Vercel / Cloud)
        │
        │ Validate + Persist Raw Event
        ▼
BiometricRawPunch
        │
        │ Staff Biometric Mapping (StaffBiometricIdentity)
        ▼
Shift / Attendance Normalization Engine
        │
        ▼
AttendanceRecord (source = DEVICE)
        │
        ▼
Admin Review / Correction / Approval
        │
        ▼
Payroll / Attendance Reporting
```

### Non-negotiable rules
- **No direct cloud-to-device TCP/UDP polling.**
- **No node-zklib socket connection from Vercel to 192.168.x.x.**
- **No local agent/service in the approved architecture.**
- **Device pushes attendance events to a public HTTPS endpoint.**
- **Raw punches are always stored before normalization.**
- **Staff mapping is explicit; do not guess using Staff.id or numeric suffixes.**
- **Duplicate device events must be idempotent.**
- **Manual corrections must preserve the original device punch history.**
- **Payroll uses normalized/approved attendance, not raw device punches directly.**

---

## 🧱 Data Ownership & Source of Truth

### Biometric Device
**Owns:**
- enroll/user number on the device
- physical punch event
- punch timestamp
- verification method if provided by device
- punch state/type if provided by device

### HMS
**Owns:**
- Staff master
- explicit staff ↔ biometric enroll mapping (`StaffBiometricIdentity`)
- shift/schedule assignment
- grace/tolerance rules
- normalized attendance record
- attendance corrections and approvals
- payroll calculations
- audit trail

---

## 📋 Comprehensive 12-Step Implementation Roadmap

### Step 1: Database Models & Migration
**Objective:** Persist device registration, staff biometric mappings, and raw punch metadata safely in PostgreSQL.

#### 1.1 BiometricDevice
```prisma
model BiometricDevice {
  id                    String    @id @default(uuid())
  name                  String    @map("name")
  brandModel            String?   @map("brand_model")
  deviceSerial          String    @unique @map("device_serial")
  protocol              String    @default("HTTP_ADMS") @map("protocol")
  timezone              String    @default("Asia/Karachi") @map("timezone")
  isEnabled             Boolean   @default(true) @map("is_enabled")

  // Authentication/registration metadata.
  authMode              String    @default("DEVICE_SERIAL") @map("auth_mode")
  sharedSecretEncrypted String?   @map("shared_secret_encrypted")

  lastSeenAt            DateTime? @map("last_seen_at")
  lastPushAt            DateTime? @map("last_push_at")
  lastPushStatus        String    @default("NEVER") @map("last_push_status") // SUCCESS | FAILED | NEVER
  lastPushMessage       String?   @map("last_push_message")

  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  staffMappings         StaffBiometricIdentity[]
  rawPunches            BiometricRawPunch[]

  @@map("biometric_devices")
}
```
*Note: `ipAddress`, `port`, `commKey`, `syncIntervalMinutes`, and TCP protocol fields are not required for this cloud-push architecture. If any of them are retained for reference/legacy purposes, they must not drive cloud polling logic.*

#### 1.2 StaffBiometricIdentity
*Rule: Do not derive device identity from `Staff.id` or numeric suffixes.*
```prisma
model StaffBiometricIdentity {
  id            String          @id @default(uuid())
  staffId       String          @map("staff_id")
  deviceId      String          @map("device_id")
  enrollNumber  String          @map("enroll_number")
  isActive      Boolean         @default(true) @map("is_active")
  effectiveFrom DateTime?       @map("effective_from")
  effectiveTo   DateTime?       @map("effective_to")
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @updatedAt @map("updated_at")

  device        BiometricDevice @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  staff         Staff           @relation(fields: [staffId], references: [id], onDelete: Cascade)

  @@unique([deviceId, enrollNumber])
  @@index([staffId])
  @@map("staff_biometric_identities")
}
```

#### 1.3 BiometricRawPunch
Enhance `BiometricRawPunch`:
- `deviceId`: String? nullable
- `deviceSerial`: String
- `enrollNumber`: String
- `staffId`: String? nullable (unmapped punches must be retained)
- `punchAt`: DateTime
- `punchType`: String? (CHECK_IN, CHECK_OUT, BREAK_OUT, BREAK_IN, AUTO)
- `verificationType`: String? (FINGERPRINT, FACE, CARD, PASSWORD)
- `rawPayload`: Json?
- `eventHash`: String @unique (idempotency key)
- `processingStatus`: String @default("RECEIVED") // RECEIVED | UNMAPPED | NORMALIZED | DUPLICATE | INVALID | ERROR
- `receivedAt`: DateTime @default(now())

#### Migration Rule
Create a standard Prisma migration locally and deploy it through the project's existing production-safe migration process (`prisma migrate dev` / `prisma migrate deploy`). Never use destructive reset commands on production.

---

### Step 2: Super Admin Hospital Overview — Biometric Device Section
**Objective:** Manage device registration and operational health from `/super-admin/overview`.

#### Components
- `BiometricDeviceSection.tsx` (Hospital Overview card)
- `EditBiometricDeviceModal.tsx` (Registration & configuration)
- `StaffBiometricMappingModal.tsx` (Explicit Staff ↔ Enroll Number manager)
- `RawPunchesDrawerModal.tsx` (Recent & unmapped punches monitor)

#### Display Fields
- Device Name
- Brand / Model
- Device Serial Number
- Protocol (`HTTP_ADMS` / supported push adapter)
- HMS Push Server URL (`https://hms-project-backend.vercel.app/api/v1/attendance/punch-ingest`)
- Device Timezone (`Asia/Karachi`)
- Enabled / Disabled status toggle
- Status Pill: `ONLINE / RECENT`, `STALE`, `NEVER_CONNECTED`, `DISABLED`
- Last Seen
- Last Punch Received
- Last Push Status (`SUCCESS` / `FAILED`)
- Last Push Message
- Mapped Staff count
- Unmapped punch count

#### Actions
- ⚙️ **Configure Device**
- 📋 **Copy Server URL**
- 👥 **Manage Staff Mapping**
- 📜 **View Recent Punches**
- ⚠️ **View Unmapped Punches**
- 🔄 **Refresh Status**

*Constraint: Do not add a cloud-side button that tries to ping `192.168.x.x:4370`. Do not implement "Sync Punches Now" as a TCP pull from the cloud. In push mode, the device sends events itself.*

---

### Step 3: Public Device Push / Ingest API
**Objective:** Receive biometric events directly from supported physical devices over HTTPS.

#### Primary Normalized Endpoint:
`POST /api/v1/attendance/punch-ingest`

#### Normalized Request DTO Shape:
```json
{
  "deviceSerial": "ZK-982341",
  "events": [
    {
      "enrollNumber": "101",
      "punchTime": "2026-10-15T08:55:00+05:00",
      "punchType": "CHECK_IN",
      "verificationType": "FINGERPRINT",
      "deviceEventId": "optional-vendor-event-id"
    }
  ]
}
```

#### Adapter Architecture
Real ADMS payloads vary by manufacturer/model. Therefore implement a pluggable adapter layer:
```
Raw Vendor Request (e.g. ZKTeco cdata / ADMS plain text or JSON)
      ↓
Vendor/Protocol Adapter (zkAdmsAdapter.ts / genericJsonAdapter.ts)
      ↓
Normalized Punch DTO
      ↓
Canonical Ingestion Service
```
*Do not duplicate attendance business logic inside each vendor-specific route.*

#### Authentication & Registration
- Authenticate via registered `deviceSerial`.
- Optional shared secret / token if supported by device model.
- Unknown or disabled device serials must be rejected with 401/403 or quarantined per security policy.
- Do not require custom headers like `x-bridge-token` unless the physical device model natively supports custom HTTP header injection.

---

### Step 4: Physical Device Configuration
**Objective:** Point the biometric terminal to the public HMS endpoint.

On the physical device, configure the appropriate cloud/ADMS settings supported by the model:
- **Server / Domain:** `hms-project-backend.vercel.app`
- **Protocol:** HTTP/HTTPS ADMS or supported cloud-push mode
- **Port:** `443` for HTTPS (or `80` if device lacks TLS stack)
- **Push URL Path:** `/api/v1/attendance/punch-ingest` (or standard ADMS `/iclock/cdata`)
- **Device Serial:** device's real serial number
- **Timezone / Date-Time:** `Asia/Karachi` / synchronized accurately

#### Required Verification
Before implementation sign-off, confirm the actual biometric model supports one of:
1. HTTP ADMS
2. HTTPS cloud server
3. Vendor push API
4. Configurable web server endpoint

*If it supports only local TCP/UDP pull, this direct-cloud architecture cannot receive punches from it without changing the network architecture.*

---

### Step 5: Push Validation, Time Normalization & Raw Persistence
**Objective:** Never lose a valid device event and never let malformed data directly update payroll attendance.

#### Event Pipeline:
1. Validate device registration and `isEnabled == true`.
2. Validate required fields (`deviceSerial`, `enrollNumber`, `punchTime`).
3. Parse vendor timestamp using configured device timezone (`Asia/Karachi`).
4. Convert/store canonical timestamp consistently in UTC.
5. Build deterministic `eventHash`:
   `SHA256(deviceSerial + ':' + enrollNumber + ':' + punchTimeIso + ':' + (punchType || ''))`
6. Check idempotency: If `eventHash` exists, skip re-insertion and acknowledge 200 OK.
7. Persist raw event in `BiometricRawPunch` first.
8. Attempt staff mapping via `StaffBiometricIdentity`.
9. Trigger/queue normalization.
10. Return an acknowledgement suitable for the device protocol.

*Rule: Never discard an event only because staff mapping is missing. Retain it with status `UNMAPPED`.*

---

### Step 6: Explicit Staff Biometric Enroll Mapping
**Objective:** Safely map device user/enroll numbers to real HMS staff.

```
Device Serial + Enroll Number
             ↓
StaffBiometricIdentity
             ↓
Staff
```

#### Prohibited:
- ❌ Do not use `Staff.id` guessing.
- ❌ Do not use numeric suffix guessing.
- ❌ Do not use fuzzy name matching.
- ❌ Do not use phone matching.

#### Unmapped Punch Handling:
- Store the raw punch with `processingStatus = 'UNMAPPED'`.
- Display counter and table in Super Admin review.
- Allow authorized admin to assign enroll number to a Staff member via modal.
- After creating the mapping, allow one-click reprocessing of historical unmapped raw punches.

---

### Step 7: Raw Punch Idempotency & Audit Trail
**Objective:** Repeated device pushes or network retries must never create duplicate attendance effects.

#### Idempotency Key:
Use vendor event ID when reliable; otherwise generate deterministic hash:
`SHA256(deviceSerial + enrollNumber + canonicalPunchTimestamp + punchType)`

#### Processing States:
- `RECEIVED` — Ingested and awaiting normalization.
- `UNMAPPED` — Enroll number has no active staff identity mapping.
- `NORMALIZED` — Processed into `AttendanceRecord`.
- `DUPLICATE` — Repeated push payload detected and safely ignored.
- `INVALID` — Corrupted date/time or malformed payload.
- `ERROR` — Processing exception during normalization.

---

### Step 8: Punch-to-Attendance Normalization & Shift Matching
**Objective:** Convert raw punches into meaningful `AttendanceRecord` entries.

#### Algorithm:
For each mapped staff member and applicable work date/shift:
1. Resolve the employee's effective shift/schedule for that date.
2. Build a valid shift window, including overnight shifts where applicable.
3. Fetch all mapped raw punches inside that window.
4. Determine valid `actualIn` and `actualOut` according to punch states when the device provides them.
5. If punch states are unavailable (all punches marked "AUTO"), use earliest and latest valid separated punches:
   - Accidental double-scans within 5 minutes are de-duplicated as bounce scans.
6. Calculate `lateMinutes` from shift start + grace period.
7. Calculate `earlyExitMinutes` from shift end - tolerance.
8. Calculate worked duration where relevant.
9. Determine status according to existing HMS attendance policy:
   - `PRESENT`
   - `HALF_DAY`
   - `MISSING_PUNCH`
   - `ABSENT`
   - Approved leave/off states as already defined by HMS.
10. Write/update `AttendanceRecord` with `source = 'DEVICE'`.

#### Critical Constraints:
- Weekly off must not become absence.
- Approved leave rules must remain intact.
- Overnight shifts must be supported.
- One missing punch must go to review (`MISSING_PUNCH`) rather than inventing an in/out time.
- Manual correction must preserve original device times and record correction actor/reason.

---

### Step 9: Push Health Monitoring & Internal Background Processing
**Objective:** Track device health without polling the physical machine.

*There is no device polling cron job in the final architecture.*

#### Health Rules:
- Update `lastSeenAt` and `lastPushAt` whenever the device sends a valid heartbeat/punch.
- Status derivation:
  - **ONLINE / RECENT:** Push received within configured freshness window (e.g. within 30 minutes during working hours).
  - **STALE:** No push received beyond threshold.
  - **NEVER_CONNECTED:** No successful push ever received.
  - **DISABLED:** Device disabled in HMS.

#### Internal Cloud Background Jobs:
Cloud background tasks are for internal HMS processing only:
- Retrying failed normalization.
- End-of-day absence calculation.
- Rebuilding attendance after mapping correction.
- Exception notifications.
*(They must never attempt to connect to the device's private LAN IP).*

---

### Step 10: Attendance Review, Exception & Correction UI
**Objective:** Give authorized management a clear audit workflow.

#### Register Indicators:
- Source pills: `DEVICE` (blue), `MANUAL` (green), `IMPORTED` (amber).
- Exception tags: `Missing Punch`, `Late In`, `Early Exit`, `Unmapped Punch`.

#### Authorized Correction Flow:
- Corrected time/status values.
- Mandatory reason for correction.
- Audit fields: `markedById` (actor), `updatedAt`.
- Original device punch timestamps preserved in audit.

#### Super Admin Actions:
- View Raw Punches
- Resolve Unmapped Punch
- Reprocess Attendance
- Correct Attendance
- Export PDF/Excel

*Constraint: Do not expose a misleading cloud "Sync Biometric Machine" TCP button in push-only mode.*

---

### Step 11: Offline Fallback — USB / CSV / DAT Import
**Objective:** Provide a backup when the device cannot reach the internet/cloud endpoint.

```
Biometric Device
      ↓
USB Export (.dat / CSV)
      ↓
HMS Upload Punch File Modal
      ↓
Parser Adapter
      ↓
Canonical Raw Punch Ingestion
      ↓
Same Mapping + Normalization Engine
```

#### Parser Format:
Parses standard ZKTeco DAT/CSV:
`[Enroll Number] \t [YYYY-MM-DD HH:mm:ss] \t [Verification Type] \t [Punch State]`

Imported events use the exact same:
- Device/enroll mapping
- Idempotency rules
- Raw audit trail
- Timezone handling
- Normalization engine
- Set `source = 'IMPORTED'`

---

### Step 12: End-to-End HTTP Push Simulation & Verification
**Objective:** Test the complete integration before the physical device is connected.

*Do not simulate a TCP device on 127.0.0.1:4370. Create an HTTP push simulator test script.*

#### Test Endpoint:
`POST /api/v1/attendance/punch-ingest`

#### Verification Checklist:
1. Registered device punch accepted (200 OK).
2. Disabled/unknown device serial rejected (401/403).
3. Enroll number maps to correct Staff member via `StaffBiometricIdentity`.
4. Unmapped punch is retained and visible in Super Admin drawer.
5. Same event retried twice creates exactly one raw/business effect.
6. First valid punch creates/updates `actualIn`.
7. Last valid punch creates/updates `actualOut`.
8. Accidental duplicate scans within 5 minutes do not produce false checkout.
9. Late minutes are calculated from effective shift rules.
10. Early exit is calculated correctly.
11. Overnight shift punches normalize to the correct attendance date.
12. Missing punch enters review state (`MISSING_PUNCH`).
13. USB-imported punch follows the same normalization path.
14. Corrected attendance retains original device audit data.
15. Payroll reads the normalized/approved attendance result correctly.

---

## 🔐 Security Requirements
- **HTTPS only in production.**
- Validate device registration on every push.
- Store secrets encrypted at rest where application-managed credentials are required.
- Never expose database credentials to the device.
- Rate-limit public ingest endpoints appropriately without blocking legitimate device bursts.
- Validate payload size and field types.
- Preserve raw payload for audit but avoid logging sensitive secrets.
- Record device serial, request time, source IP where useful, and processing result.
- Admin configuration/mapping routes remain protected by normal HMS RBAC.

---

## 🕒 Timezone & Clock Rules
**Hospital Operational Timezone:** `Asia/Karachi` (UTC+5)

- Device clock must be maintained accurately (via NTP on terminal).
- Device timezone must be configured in `BiometricDevice.timezone`.
- Incoming local timestamps converted consistently to UTC for database storage.
- Converted back to `Asia/Karachi` for shift calculation, UI display, and reports.
- Detect obviously invalid/future timestamps and flag them for review.

---

## 💰 Payroll Integration Rule
**Raw biometric punches must never directly calculate salary.**

```
Raw Device Punch
      ↓
BiometricRawPunch
      ↓
Normalized AttendanceRecord
      ↓
Review / Correction / Approval Policy
      ↓
Payroll Calculation Engine
```

Existing payroll rules for monthly salary, attendance deductions, late/early deductions, paid leave, unpaid leave, weekly off, and manual corrections remain authoritative.

---

## ☁️ Vercel / Serverless Compatibility
The biometric integration remains strictly serverless-compatible:
- Public HTTP/HTTPS ingest endpoints only.
- No persistent TCP socket listeners.
- No direct private-LAN device connections.
- No in-memory-only state required for correctness.
- Every ingest request is independently idempotent.
- Use PostgreSQL transactions for raw-event persistence + idempotency metadata.

---

## 📅 Execution Phases Summary

| Phase | Steps | Deliverable |
| :--- | :--- | :--- |
| **Phase 1: Foundation** | 1–3 | Device registration, staff mapping model, Super Admin UI, public ingest API |
| **Phase 2: Device Push** | 4–7 | Physical device cloud configuration, vendor adapter, raw punch staging, idempotency |
| **Phase 3: Attendance Engine** | 8–9 | Shift normalization, overnight handling, health/status monitoring |
| **Phase 4: Operations** | 10–12 | Review/correction UI, offline import, HTTP simulator and E2E verification |

---

## ✅ Final Acceptance Criteria
Implementation is complete only when all of the following pass:
- Supported physical device can push a punch to HMS over public HTTP/HTTPS.
- No local agent/service is required.
- HMS never attempts TCP/UDP access to a private machine IP.
- Device serial is registered and validated.
- Enroll number maps through explicit `StaffBiometricIdentity`.
- Unmapped events are never lost.
- Duplicate pushes do not duplicate attendance.
- Shift-aware attendance is generated correctly.
- Missing/invalid punches enter review workflow.
- Manual corrections preserve original device data and actor/reason audit.
- USB/CSV/DAT fallback uses the same ingestion/normalization engine.
- Attendance integrates into payroll only after normalization/approval rules.
- Production build/typecheck/migrations/tests pass.

---

*This document replaces the previous TCP/UDP pull, direct LAN polling, and cloud node-zklib design. The approved implementation is push-based and requires a biometric device that supports HTTP/HTTPS ADMS or an equivalent configurable cloud push protocol.*
