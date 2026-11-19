-- organization_members is the only record of who runs an organization.
-- Remove the old single-coordinator column that it replaced.

-- Safety net: any organization still without an owner membership (e.g. created by an
-- older server during a deploy) gets one from the column before it is dropped.
INSERT INTO organization_members (organization_id, user_id, role, created_at)
SELECT o.id, o.coordinator_id, 'OWNER', o.created_at
  FROM organizations o
 WHERE NOT EXISTS (
         SELECT 1 FROM organization_members m WHERE m.organization_id = o.id AND m.role = 'OWNER'
       )
   AND NOT EXISTS (
         SELECT 1 FROM organization_members m WHERE m.organization_id = o.id AND m.user_id = o.coordinator_id
       );

-- Also drops its index and foreign key.
ALTER TABLE organizations DROP COLUMN IF EXISTS coordinator_id;
