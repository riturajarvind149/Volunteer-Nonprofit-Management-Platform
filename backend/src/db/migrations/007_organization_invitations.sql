-- Invitations from an NGO admin to people they want as coordinators.
-- The emailed link carries a random token; only its SHA-256 hash is stored.
CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'COORDINATOR' CHECK (role IN ('COORDINATOR')),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- At most one open invitation per email per organization.
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invitations_open
    ON organization_invitations (organization_id, LOWER(email))
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON organization_invitations (organization_id);
