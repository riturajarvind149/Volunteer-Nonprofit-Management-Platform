-- A platform admin can close an NGO that stops operating (or asks to leave ServeHub).
-- A closed NGO is hidden everywhere, its upcoming events are cancelled and its team
-- memberships are removed, so the former NGO admin can delete their account or register
-- a new NGO. Past events and verified hours are kept for volunteers' certificates.
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_verification_status_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_verification_status_check
    CHECK (verification_status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'CLOSED'));

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
