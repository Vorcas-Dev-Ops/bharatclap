-- 001_auth.sql
-- BharatClap PostgreSQL Migration — Auth Schema
-- Owner: auth-service

CREATE SCHEMA IF NOT EXISTS auth;

-- ── users ──────────────────────────────────────────────────────────
CREATE TABLE auth.users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT,
    email                   CITEXT,
    phone                   TEXT,
    password_hash           TEXT,
    role                    VARCHAR(20) NOT NULL DEFAULT 'customer'
                            CHECK (role IN ('admin', 'customer', 'provider')),
    admin_role              VARCHAR(20)
                            CHECK (admin_role IN (
                                'super_admin', 'operations_admin',
                                'support_admin', 'finance_admin'
                            )),
    permissions             TEXT[] DEFAULT '{}',
    profile_image           TEXT,
    status                  VARCHAR(10) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'blocked')),
    gender                  VARCHAR(10),
    date_of_birth           DATE,
    -- wallet_balance intentionally removed (P0-1: single source of truth in payment.customer_wallets)
    last_login              TIMESTAMPTZ,
    is_email_verified       BOOLEAN NOT NULL DEFAULT FALSE,
    is_phone_verified       BOOLEAN NOT NULL DEFAULT FALSE,
    token_version           INTEGER NOT NULL DEFAULT 0,
    google_id               TEXT,
    auth_provider           VARCHAR(10) NOT NULL DEFAULT 'local'
                            CHECK (auth_provider IN ('local', 'google')),
    referral_code           TEXT,
    two_factor_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret       TEXT,
    two_factor_recovery     TEXT[] DEFAULT '{}',
    failed_otp_attempts     INTEGER NOT NULL DEFAULT 0,
    otp_locked_until        TIMESTAMPTZ,
    deletion_requested_at   TIMESTAMPTZ,
    deletion_scheduled_at   TIMESTAMPTZ,
    is_anonymized           BOOLEAN NOT NULL DEFAULT FALSE,
    consent_given_at        TIMESTAMPTZ,
    consent_version         TEXT DEFAULT 'v1.0',
    legacy_mongo_id         TEXT,
    version                 INTEGER NOT NULL DEFAULT 1,
    deleted_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique: reusable after soft-delete
CREATE UNIQUE INDEX ux_users_email ON auth.users(email)
    WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX ux_users_phone ON auth.users(phone)
    WHERE phone IS NOT NULL AND deleted_at IS NULL;

-- Global unique: NOT reusable after delete (audit trail integrity)
CREATE UNIQUE INDEX ux_users_referral ON auth.users(referral_code)
    WHERE referral_code IS NOT NULL;
CREATE UNIQUE INDEX ux_users_google ON auth.users(google_id)
    WHERE google_id IS NOT NULL;

-- Query indexes
CREATE INDEX ix_users_role_status ON auth.users(role, status)
    WHERE deleted_at IS NULL;
CREATE INDEX ix_users_created ON auth.users(created_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX ix_users_deletion ON auth.users(deletion_scheduled_at)
    WHERE deletion_scheduled_at IS NOT NULL AND is_anonymized = FALSE;

-- ── otp_challenges ─────────────────────────────────────────────────
CREATE TABLE auth.otp_challenges (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier              TEXT NOT NULL,
    purpose                 VARCHAR(30) NOT NULL
                            CHECK (purpose IN (
                                'LOGIN_REGISTRATION', 'PHONE_CHANGE',
                                'PASSWORD_RESET', 'ACCOUNT_DELETION'
                            )),
    otp_hash                TEXT NOT NULL,
    role                    VARCHAR(20) NOT NULL DEFAULT 'customer',
    status                  VARCHAR(10) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'consumed', 'locked')),
    attempts                INTEGER NOT NULL DEFAULT 0,
    consumed_at             TIMESTAMPTZ,
    locked_at               TIMESTAMPTZ,
    expires_at              TIMESTAMPTZ NOT NULL,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one ACTIVE challenge per identifier+purpose at a time
CREATE UNIQUE INDEX ux_active_otp ON auth.otp_challenges(identifier, purpose)
    WHERE status = 'active';

CREATE INDEX ix_otp_identifier ON auth.otp_challenges(identifier);
CREATE INDEX ix_otp_expires ON auth.otp_challenges(expires_at)
    WHERE status = 'active';

-- ── addresses ──────────────────────────────────────────────────────
CREATE TABLE auth.addresses (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL,
    address_type            VARCHAR(10) NOT NULL DEFAULT 'Home'
                            CHECK (address_type IN ('Home', 'Work', 'Other')),
    label                   TEXT,
    house_no_building       TEXT NOT NULL,
    address_line_1          TEXT NOT NULL,
    address_line_2          TEXT,
    address_line_3          TEXT,
    area_locality           TEXT NOT NULL,
    landmark                TEXT,
    city                    TEXT NOT NULL,
    district                TEXT NOT NULL,
    state                   TEXT NOT NULL,
    country                 TEXT NOT NULL DEFAULT 'India',
    pincode                 VARCHAR(10) NOT NULL,
    delivery_notes          TEXT,
    latitude                DOUBLE PRECISION NOT NULL,
    longitude               DOUBLE PRECISION NOT NULL,
    location                GEOGRAPHY(Point, 4326) NOT NULL,
    formatted_address       TEXT NOT NULL,
    place_id                TEXT,
    map_provider            TEXT,
    is_verified             BOOLEAN NOT NULL DEFAULT FALSE,
    is_default              BOOLEAN NOT NULL DEFAULT FALSE,
    legacy_mongo_id         TEXT,
    deleted_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one default address per user
CREATE UNIQUE INDEX ux_address_default ON auth.addresses(user_id)
    WHERE is_default = TRUE AND deleted_at IS NULL;

CREATE INDEX ix_address_user ON auth.addresses(user_id, is_default DESC, created_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX ix_address_location ON auth.addresses USING GIST(location);

-- ── refresh_tokens ─────────────────────────────────────────────────
CREATE TABLE auth.refresh_tokens (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL,
    token_hash              TEXT NOT NULL UNIQUE,
    device_info             TEXT DEFAULT 'Unknown Device',
    ip_address              TEXT DEFAULT 'Unknown IP',
    revoked                 BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at              TIMESTAMPTZ NOT NULL,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_token_user ON auth.refresh_tokens(user_id, revoked);
CREATE INDEX ix_token_expires ON auth.refresh_tokens(expires_at)
    WHERE revoked = FALSE;

-- ── admin_activity_logs (IMMUTABLE) ────────────────────────────────
CREATE TABLE auth.admin_activity_logs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id                UUID,  -- FK in 008, SET NULL on user delete
    admin_name              TEXT NOT NULL,
    action                  TEXT NOT NULL,
    target_id               TEXT,
    details                 JSONB,
    ip_address              TEXT,
    user_agent              TEXT,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_audit_admin ON auth.admin_activity_logs(admin_id, created_at DESC);
CREATE INDEX ix_audit_action ON auth.admin_activity_logs(action, created_at DESC);
CREATE INDEX ix_audit_time ON auth.admin_activity_logs(created_at DESC);

-- ── customer_referrals ─────────────────────────────────────────────
CREATE TABLE auth.customer_referrals (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id             UUID NOT NULL,
    referred_id             UUID NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
    reward_amount           NUMERIC(12,2) DEFAULT 0,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (referrer_id, referred_id)
);

-- ── referral_rewards ───────────────────────────────────────────────
CREATE TABLE auth.referral_rewards (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL,
    referral_id             UUID NOT NULL,
    amount                  NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    reward_type             VARCHAR(20) NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── account_deletion_requests ──────────────────────────────────────
CREATE TABLE auth.account_deletion_requests (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
    reason                  TEXT,
    scheduled_at            TIMESTAMPTZ,
    processed_at            TIMESTAMPTZ,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── account_deletion_outbox ────────────────────────────────────────
CREATE TABLE auth.account_deletion_outbox (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                TEXT NOT NULL UNIQUE,
    user_id                 UUID NOT NULL,
    event_type              TEXT NOT NULL,
    payload                 JSONB NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'DLQ')),
    attempts                INTEGER NOT NULL DEFAULT 0,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── pending_phone_changes ──────────────────────────────────────────
CREATE TABLE auth.pending_phone_changes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL,
    new_phone               TEXT NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'verified', 'cancelled', 'expired')),
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── phone_change_history (append-only) ─────────────────────────────
CREATE TABLE auth.phone_change_history (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL,
    old_phone               TEXT NOT NULL,
    new_phone               TEXT NOT NULL,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── locations (serviceable areas) ──────────────────────────────────
CREATE TABLE auth.locations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    city                    TEXT NOT NULL,
    state                   TEXT NOT NULL,
    pincode                 VARCHAR(10),
    latitude                DOUBLE PRECISION NOT NULL,
    longitude               DOUBLE PRECISION NOT NULL,
    location                GEOGRAPHY(Point, 4326) NOT NULL,
    service_radius          INTEGER DEFAULT 10000,
    status                  VARCHAR(10) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive')),
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_locations_geo ON auth.locations USING GIST(location);

-- ── pincode_cache ──────────────────────────────────────────────────
CREATE TABLE auth.pincode_cache (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pincode                 VARCHAR(10) NOT NULL UNIQUE,
    city                    TEXT,
    state                   TEXT,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── contact_inquiries ──────────────────────────────────────────────
CREATE TABLE auth.contact_inquiries (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    email                   TEXT,
    phone                   TEXT,
    message                 TEXT NOT NULL,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
