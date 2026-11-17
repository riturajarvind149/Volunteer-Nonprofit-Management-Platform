-- 6-digit codes sent alongside verification / reset links, so users can finish
-- the flow on any device (typing the code) even when the link can't be opened.
-- Only a keyed hash of the code is stored; `attempts` limits guessing.
ALTER TABLE auth_tokens ADD COLUMN IF NOT EXISTS code_hash VARCHAR(64);
ALTER TABLE auth_tokens ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
