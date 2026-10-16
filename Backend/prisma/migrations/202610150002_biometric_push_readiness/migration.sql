-- Bring existing installations and migration-managed installations to the same device schema.
-- Existing records and raw payloads are preserved.
CREATE TABLE IF NOT EXISTS biometric_devices (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, brand_model TEXT, device_serial TEXT NOT NULL,
 protocol TEXT NOT NULL DEFAULT 'HTTP_ADMS', timezone TEXT NOT NULL DEFAULT 'Asia/Karachi',
 is_enabled BOOLEAN NOT NULL DEFAULT true, auth_mode TEXT NOT NULL DEFAULT 'DEVICE_SERIAL',
 shared_secret_encrypted TEXT, last_seen_at TIMESTAMP(3), last_push_at TIMESTAMP(3),
 last_push_status TEXT NOT NULL DEFAULT 'NEVER', last_push_message TEXT,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS biometric_devices_device_serial_key ON biometric_devices(device_serial);
CREATE TABLE IF NOT EXISTS staff_biometric_identities (
 id TEXT PRIMARY KEY, staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE ON UPDATE CASCADE,
 device_id TEXT NOT NULL REFERENCES biometric_devices(id) ON DELETE CASCADE ON UPDATE CASCADE,
 enroll_number TEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT true,
 effective_from TIMESTAMP(3), effective_to TIMESTAMP(3),
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS staff_biometric_identities_device_id_enroll_number_key ON staff_biometric_identities(device_id,enroll_number);
CREATE INDEX IF NOT EXISTS staff_biometric_identities_staff_id_idx ON staff_biometric_identities(staff_id);
ALTER TABLE biometric_raw_punches ALTER COLUMN staff_id DROP NOT NULL;
ALTER TABLE biometric_raw_punches
 ADD COLUMN IF NOT EXISTS device_id TEXT REFERENCES biometric_devices(id) ON DELETE SET NULL ON UPDATE CASCADE,
 ADD COLUMN IF NOT EXISTS device_serial TEXT,
 ADD COLUMN IF NOT EXISTS enroll_number TEXT,
 ADD COLUMN IF NOT EXISTS punch_type TEXT,
 ADD COLUMN IF NOT EXISTS verification_type TEXT,
 ADD COLUMN IF NOT EXISTS event_hash TEXT,
 ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'RECEIVED',
 ADD COLUMN IF NOT EXISTS error_message TEXT,
 ADD COLUMN IF NOT EXISTS received_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS biometric_raw_punches_event_hash_key ON biometric_raw_punches(event_hash);
CREATE INDEX IF NOT EXISTS biometric_raw_punches_device_id_idx ON biometric_raw_punches(device_id);
CREATE INDEX IF NOT EXISTS biometric_raw_punches_staff_id_idx ON biometric_raw_punches(staff_id);
CREATE INDEX IF NOT EXISTS biometric_raw_punches_punch_at_idx ON biometric_raw_punches(punch_at);
CREATE INDEX IF NOT EXISTS biometric_raw_punches_processing_status_idx ON biometric_raw_punches(processing_status);
CREATE INDEX IF NOT EXISTS biometric_raw_punches_processing_status_last_attempt_at_idx ON biometric_raw_punches(processing_status,last_attempt_at);

