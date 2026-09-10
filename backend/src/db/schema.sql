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
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
