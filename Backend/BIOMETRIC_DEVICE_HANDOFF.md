# Biometric device integration — connection handoff

Implementation scope: ZKTeco-compatible **unencrypted attendance PUSH / ADMS** and authenticated **JSON push**. Device model/firmware has not yet been supplied. Hikvision ISAPI, proprietary encrypted PUSH, device enrollment commands and USB/desktop fingerprint scanners are not claimed as supported.

## What is implemented

- Registered device configuration with protocol/timezone validation and safe updates by device ID.
- Shared secrets are one-way hashed and never returned in device/mapping responses. Leaving the secret blank retains it.
- JSON ingestion requires a per-device shared secret (Bearer authorization or X-Device-Secret).
- ADMS supports registered serial + an exact approved source IP, or a trusted gateway injecting a shared-secret header. Serial alone is not accepted from the public internet.
- Admin/Super Admin attendance permissions protect configuration, mappings and reprocessing.
- ADMS GET /iclock/cdata registration/options, POST /iclock/cdata ATTLOG, GET /iclock/getrequest and /iclock/ping heartbeats, /iclock/devicecmd acknowledgement. Equivalent .aspx paths work.
- Text-body parsing precedes Express JSON/form parsing. ATTLOG acknowledgements are plain text and sent only after raw events are committed.
- Attendance-only transfer flags; no biometric templates or photos are requested. Ancillary startup OPERLOG/USERINFO/options tables are acknowledged without importing personal templates.
- Raw original ATTLOG record, device status and verification code are retained.
- Event hash uniqueness and transaction-level device locking prevent repeat uploads/mapping races.
- Staff mapping is scoped to device + enrollment ID. Historical enrollment IDs cannot silently be reassigned to another employee. Removing a mapping deactivates it without deleting history.
- Unmapped punches are retained, counted and linked when a mapping is created.
- Offset-free timestamps are parsed in the registered device timezone; attendance dates use the hospital timezone. Night duty uses the preceding shift day, with the split halfway between adjacent overnight shifts (or four hours after overnight end when no next shift exists).
- Assigned shift / effective weekly override, actual break pairs, worked minutes, grace/tolerance, missing punches, late arrival and early exit are calculated. Missing duty configuration and non-working-day punches are held for review rather than assuming a shift.
- First/last AUTO punches are supported; explicit IN/OUT/break codes are respected. A single IN does not invent an OUT.
- Manual, imported and approved attendance is not overwritten by device processing.
- Raw events form a durable retry queue. Processing failures are visible, with lastAttemptAt separate from receivedAt. Repeat upload, manual Retry Pending Punches and five-minute Vercel cron process pending work. Staff row locks serialize concurrent attendance calculations.
- Hospital Overview displays correct ADMS server address vs JSON endpoint, connection authentication, heartbeat, pending/error counters and recent processing errors.

## Before connecting the machine

1. Confirm the exact model and that it supports the documented ADMS attendance PUSH protocol. Models requiring encrypted proprietary PUSH or other protocols need a matching adapter/gateway.
2. Deploy the backend and frontend. Apply the biometric migration in the target database. This work was applied only to local localhost:5432/chss_hms, not cloud.
3. In Hospital Overview → Biometric Attendance Terminal → Configure Device:
   - Enter the terminal's actual serial number, name and model.
   - Select HTTP/HTTPS ADMS for a compatible terminal; select Authenticated JSON Push for a gateway.
   - Set the device clock and timezone correctly (normally Asia/Karachi).
   - Choose authentication as below, save and enable it.
4. Staff Mappings: match the enrollment number on the machine to the existing staff record. Assign duty shifts/weekly schedules.
5. For ADMS, enter the **backend hostname** in the machine's ADMS/Cloud Server field, not the frontend hostname and not the JSON endpoint. The machine appends /iclock/cdata itself. Use HTTPS port 443 if firmware supports it.
6. An HTTP-only machine cannot be assumed to work through Vercel's HTTPS redirects. Use a hospital-network gateway/proxy that receives its HTTP requests and forwards HTTPS, preserving path, query string, text body and plain-text responses.
7. Standard status codes: 0 IN, 1 OUT, 2 break-out, 3 break-in, 4 overtime-in, 5 overtime-out, 255 AUTO. Configure status selection/auto-switch on the terminal. A machine sending only status 0 for both entry and exit will remain MISSING_PUNCH; do not silently treat every second IN as an OUT.
8. Confirm hospital timezone before connecting. Changing timezone or staff schedules after posting historical attendance requires review; historical roster versioning is outside this change.

## Authentication / deployment environment

ADMS direct mode:
- authMode DEVICE_SERIAL.
- Set BIOMETRIC_ALLOWED_IPS on the backend to comma-separated exact public egress IPs of the hospital network, or the trusted gateway's address.
- IPv4-mapped IPv6 addresses are normalized. CIDRs/wildcards are not accepted.
- Keep Express proxy trust aligned with the actual deployment. The current application trusts one reverse-proxy hop; do not expose that setup behind an untrusted arbitrary forwarded-IP chain.
- A changing hospital public IP needs allowlist maintenance or a gateway with stable egress. The UI indicates when the server allowlist is empty.

JSON / trusted gateway mode:
- authMode SHARED_SECRET; generate/copy a new secret in Configure Device and save it.
- Set Authorization: Bearer <secret> or X-Device-Secret on each request.
- This is an HMS gateway secret, not a vendor communication-key/password. Secrets are not accepted in query strings.
- CLOUD_SERVER protocol uses POST /api/v1/attendance/punch-ingest with:
  {"deviceSerial":"ACTUAL-SERIAL","events":[{"enrollNumber":"42","punchTime":"2026-10-15T09:00:00+05:00","punchType":"CHECK_IN","verificationType":"FINGERPRINT"}]}
- Each batch permits up to 1000 events. ADMS body limit is 1 MB. Oversized/invalid batches are rejected; nothing is acknowledged as stored for those batches.

Retry cron:
- GET /api/cron/biometric-reprocess, every five minutes in hms-backend/vercel.json.
- Uses existing CRON_SECRET; missing/incorrect bearer token is rejected.
- Configure CRON_SECRET and enable the cron on a Vercel plan that supports this frequency.
- Locally, incoming batches and the manual retry button process the queue; there is no in-memory timer.

## Database / generation

Migration: prisma/migrations/202610150002_biometric_push_readiness/migration.sql.
Creates the previously untracked biometric device/mapping schema when absent, preserves existing records, ensures raw event indexes, and adds last_attempt_at plus a retry index.
Applied and marked applied in the local database. Historical unrelated migration tracking remains outside this change.

Prisma client generated in a staging directory because the running Windows process locked the query-engine DLL. The new generated client was installed while retaining the existing engine only after verifying identical SHA-256 engine hashes. Clean deployments use normal prisma generate.

## Validation performed / deferred

Backend TypeScript/build: passed.
Frontend TypeScript/build: passed (existing large bundle warning).
Prisma schema validation: passed.
No automated behavior suite, device simulator or real-terminal test was run, per the request to defer testing. Builds establish compilation, not interoperability.
No live cloud deployment or hardware connection has been performed.

When the physical terminal arrives, verify handshake, one IN/OUT pair, duplicate resend, overnight duty, offline backlog upload, unmapped employee linking and secret/IP rejection. Inspect raw punch status and staff attendance before enabling payroll reliance.

## Protocol reference

Implementation follows the attendance handshake/upload/heartbeat sections of ZKTeco's March 2020 Attendance PUSH Communication Protocol (manufacturer-authored manual, mirrored at):
https://studylib.net/doc/27718586/ilide.info-attendance-push-communication-protocol-2020032...
Manufacturer product entry: https://www.zkteco.com/en/PUSHSDK

