-- Details an NGO gives when it registers, shown to platform admins during verification.
-- Existing organizations keep NULL here until their owner fills them in.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS registration_type VARCHAR(20);
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_registration_type_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_registration_type_check
    CHECK (registration_type IS NULL OR registration_type IN ('TRUST', 'SOCIETY', 'SECTION_8', 'OTHER'));

-- Registration number or NGO Darpan ID (optional).
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS registration_number VARCHAR(60);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- Fast case-insensitive lookup for the "name already registered" check.
CREATE INDEX IF NOT EXISTS idx_organizations_lower_name ON organizations (LOWER(name));
