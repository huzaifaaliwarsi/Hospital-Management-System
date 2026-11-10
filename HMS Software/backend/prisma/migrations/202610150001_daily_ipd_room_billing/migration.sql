-- Preserve existing admission/date uniqueness and historical amounts.
ALTER TABLE admission_room_charge_log
 ADD COLUMN bed_assignment_id TEXT,
 ADD COLUMN room_id TEXT,
 ADD COLUMN bed_id TEXT,
 ADD COLUMN room_name_snapshot TEXT,
 ADD COLUMN bed_number_snapshot TEXT,
 ADD COLUMN posted_by TEXT,
 ADD COLUMN charge_type TEXT NOT NULL DEFAULT 'ROOM_BED_DAILY';
ALTER TABLE admission_room_charge_log ADD CONSTRAINT daily_room_charge_type CHECK (charge_type = 'ROOM_BED_DAILY');
