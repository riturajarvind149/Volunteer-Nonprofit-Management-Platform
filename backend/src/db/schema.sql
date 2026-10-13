-- Volunteer & Nonprofit Management Platform
-- Relational Database Schema (PostgreSQL)

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================================================
-- 1. USERS TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('VOLUNTEER', 'COORDINATOR')),
    phone VARCHAR(50),
    location VARCHAR(255),
    bio TEXT,
    skills TEXT[],
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==================================================
-- 2. ORGANIZATIONS TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    coordinator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    address TEXT,
    social_links JSONB,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==================================================
-- 3. OPPORTUNITIES TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location VARCHAR(255) NOT NULL,
    address TEXT,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==================================================
-- 4. SIGNUPS TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'REGISTERED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_signups_volunteer_opportunity UNIQUE (volunteer_id, opportunity_id)
);

-- ==================================================
-- 5. VOLUNTEER_HOURS TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS volunteer_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signup_id UUID NOT NULL REFERENCES signups(id) ON DELETE CASCADE,
    hours NUMERIC(6, 2) NOT NULL CHECK (hours >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RECORDED', 'VERIFIED')),
    recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    idempotency_key VARCHAR(255),
    payload_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==================================================
-- 6. NOTIFICATIONS TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'INFO',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    reference_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Backward-compatible schema migrations for existing database instances
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS skills TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS social_links JSONB;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE volunteer_hours ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
ALTER TABLE volunteer_hours ADD COLUMN IF NOT EXISTS payload_hash VARCHAR(64);

-- ==================================================
-- INDEXES FOR FOREIGN KEYS & FREQUENT LOOKUPS
-- ==================================================
CREATE INDEX IF NOT EXISTS idx_organizations_coordinator_id ON organizations(coordinator_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_organization_id ON opportunities(organization_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_event_date ON opportunities(event_date);
CREATE INDEX IF NOT EXISTS idx_signups_volunteer_id ON signups(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_signups_opportunity_id ON signups(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_hours_signup_id ON volunteer_hours(signup_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_hours_recorded_by ON volunteer_hours(recorded_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_volunteer_hours_coordinator_idempotency
    ON volunteer_hours(recorded_by, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_event_completed
    ON notifications(user_id, reference_id, type)
    WHERE type = 'EVENT_COMPLETED';
