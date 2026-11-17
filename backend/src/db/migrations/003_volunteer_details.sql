-- ==================================================
-- 003 — Volunteer identity details + admin verification
-- ==================================================
-- Volunteers must provide these details once (stored on their profile)
-- before their first registration, so a platform admin can check that
-- each volunteer is a real person. Only the last 4 characters of a
-- government ID are ever stored — never the full number or an image.
-- All columns are nullable / defaulted, so existing rows are kept as-is.

ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_type VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_last4 VARCHAR(4);
ALTER TABLE users ADD COLUMN IF NOT EXISTS details_updated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_note TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_verification_status_check;
ALTER TABLE users ADD CONSTRAINT users_verification_status_check
  CHECK (verification_status IN ('UNVERIFIED', 'VERIFIED', 'FLAGGED'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_type_check;
ALTER TABLE users ADD CONSTRAINT users_id_type_check
  CHECK (id_type IS NULL OR id_type IN ('AADHAAR', 'PAN', 'VOTER_ID', 'DRIVING_LICENCE', 'PASSPORT', 'OTHER'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_last4_check;
ALTER TABLE users ADD CONSTRAINT users_id_last4_check
  CHECK (id_last4 IS NULL OR id_last4 ~ '^[A-Za-z0-9]{4}$');

CREATE INDEX IF NOT EXISTS idx_users_verification_status ON users(verification_status) WHERE role = 'VOLUNTEER';
