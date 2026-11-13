-- ==================================================
-- 002: Production readiness
--  * ADMIN role, account state, email verification, session revocation
--  * One-time auth tokens (email verification / password reset)
--  * Organization verification workflow
--  * Waitlist, attendance / check-in, reminders
--  * Self-reported hours (PENDING -> VERIFIED / REJECTED)
--  * Audit log for admin actions
-- ==================================================

-- ---------- USERS ----------
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('VOLUNTEER', 'COORDINATOR', 'ADMIN'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT TRUE;

-- Accounts that existed before email verification was introduced are trusted.
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;

-- Case-insensitive email uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ---------- ONE-TIME AUTH TOKENS ----------
CREATE TABLE IF NOT EXISTS auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET')),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_type ON auth_tokens(user_id, type);

-- ---------- ORGANIZATIONS ----------
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_verification_status_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_verification_status_check
    CHECK (verification_status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS verification_note TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Organizations that existed before verification was introduced are trusted.
UPDATE organizations
   SET verification_status = 'APPROVED', verified_at = COALESCE(verified_at, created_at)
 WHERE verification_status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_organizations_verification_status ON organizations(verification_status);

-- ---------- OPPORTUNITIES ----------
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS skills_required TEXT[];
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS check_in_code VARCHAR(12);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

UPDATE opportunities
   SET check_in_code = UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 6))
 WHERE check_in_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_category ON opportunities(category);

-- ---------- SIGNUPS ----------
ALTER TABLE signups DROP CONSTRAINT IF EXISTS signups_status_check;
ALTER TABLE signups ADD CONSTRAINT signups_status_check
    CHECK (status IN ('REGISTERED', 'CANCELLED'));
ALTER TABLE signups ADD COLUMN IF NOT EXISTS attendance_status VARCHAR(20);
ALTER TABLE signups DROP CONSTRAINT IF EXISTS signups_attendance_status_check;
ALTER TABLE signups ADD CONSTRAINT signups_attendance_status_check
    CHECK (attendance_status IS NULL OR attendance_status IN ('PRESENT', 'ABSENT'));
ALTER TABLE signups ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_signups_status ON signups(status);

-- ---------- WAITLIST ----------
CREATE TABLE IF NOT EXISTS waitlist_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    volunteer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_waitlist_volunteer_opportunity UNIQUE (opportunity_id, volunteer_id)
);
CREATE INDEX IF NOT EXISTS idx_waitlist_opportunity_created ON waitlist_entries(opportunity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_volunteer ON waitlist_entries(volunteer_id);

-- ---------- VOLUNTEER HOURS ----------
ALTER TABLE volunteer_hours DROP CONSTRAINT IF EXISTS volunteer_hours_status_check;
ALTER TABLE volunteer_hours ADD CONSTRAINT volunteer_hours_status_check
    CHECK (status IN ('PENDING', 'RECORDED', 'VERIFIED', 'REJECTED'));
ALTER TABLE volunteer_hours ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE volunteer_hours ADD COLUMN IF NOT EXISTS self_reported BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_volunteer_hours_status ON volunteer_hours(status);

-- ---------- NOTIFICATIONS ----------
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- ---------- AUDIT LOG ----------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
