-- Who belongs to which organization (NGO), and in what capacity.
--   OWNER       — the NGO admin: manages the NGO profile and its team
--   COORDINATOR — staff appointed by the NGO: runs events, rosters and hours
-- This replaces organizations.coordinator_id as the source of truth for access.
-- (coordinator_id is kept, unused, until a later migration removes it.)
CREATE TABLE IF NOT EXISTS organization_members (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'COORDINATOR')),
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id);

-- Exactly one owner per organization.
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_members_one_owner
    ON organization_members(organization_id) WHERE role = 'OWNER';

-- Everyone who created an organization becomes its owner.
INSERT INTO organization_members (organization_id, user_id, role, created_at)
SELECT id, coordinator_id, 'OWNER', created_at
  FROM organizations
ON CONFLICT (organization_id, user_id) DO NOTHING;
