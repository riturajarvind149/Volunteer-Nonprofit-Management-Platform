-- Volunteer hours belong to the volunteer, not to the coordinator who logged them.
-- Before this, deleting a coordinator's account had to delete every hour they had
-- recorded (recorded_by was NOT NULL ... ON DELETE RESTRICT), wiping verified hours
-- from volunteers' totals and certificates. Now the recorder is simply forgotten.
ALTER TABLE volunteer_hours ALTER COLUMN recorded_by DROP NOT NULL;
ALTER TABLE volunteer_hours DROP CONSTRAINT IF EXISTS volunteer_hours_recorded_by_fkey;
ALTER TABLE volunteer_hours ADD CONSTRAINT volunteer_hours_recorded_by_fkey
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL;
