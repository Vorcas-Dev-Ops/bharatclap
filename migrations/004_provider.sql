-- 004_provider.sql
-- BharatClap PostgreSQL Migration — Provider Schema
-- Owner: provider-service
-- Note: ledger_entries removed (P0-2: replaced by accounting.journal_entries + journal_lines)

CREATE SCHEMA IF NOT EXISTS provider;

-- ── providers ──────────────────────────────────────────────────────
CREATE TABLE provider.providers (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL,
    provider_code               TEXT,
    availability_status         VARCHAR(10) NOT NULL DEFAULT 'offline'
                                CHECK (availability_status IN (
                                    'available', 'busy', 'offline', 'break', 'vacation', 'blocked'
                                )),
    status                      VARCHAR(10) NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'suspended', 'blocked')),
    is_online                   BOOLEAN DEFAULT FALSE,
    is_busy                     BOOLEAN DEFAULT FALSE,
    kyc_status                  VARCHAR(10) NOT NULL DEFAULT 'pending'
                                CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    is_verified                 BOOLEAN DEFAULT FALSE,
    gender                      VARCHAR(10),

    -- Wallet (materialized balance — wallet_transactions ledger is authoritative)
    wallet_balance              NUMERIC(12,2) NOT NULL DEFAULT 0,
    wallet_initialized          BOOLEAN DEFAULT FALSE,
    reserved_balance            NUMERIC(12,2) NOT NULL DEFAULT 0,
    credit_limit                NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_wallet_blocked           BOOLEAN DEFAULT FALSE,
    wallet_status               VARCHAR(20) NOT NULL DEFAULT 'active'
                                CHECK (wallet_status IN (
                                    'active', 'frozen_manual', 'frozen_auto',
                                    'pending_approval', 'suspended'
                                )),
    wallet_version              INTEGER DEFAULT 0,
    fencing_token               INTEGER NOT NULL DEFAULT 0,
    wallet_dirty                BOOLEAN DEFAULT FALSE,
    currency                    CHAR(3) NOT NULL DEFAULT 'INR',

    -- Ratings
    rating_count                INTEGER DEFAULT 0,
    average_rating              NUMERIC(3,2) DEFAULT 4.50,
    rating_sum                  NUMERIC(10,2) DEFAULT 0,
    total_rated_jobs            INTEGER DEFAULT 0,

    -- Geospatial
    live_location               GEOGRAPHY(Point, 4326),
    service_radius              INTEGER DEFAULT 10000,

    -- Subscription
    subscription_type           VARCHAR(20),
    access_mode                 VARCHAR(10),
    subscription_status         VARCHAR(20),
    subscription_start_date     TIMESTAMPTZ,
    subscription_end_date       TIMESTAMPTZ,
    subscription_auto_renew     BOOLEAN DEFAULT FALSE,
    grace_period_end            TIMESTAMPTZ,
    total_bookings              INTEGER DEFAULT 0,
    successful_bookings         INTEGER DEFAULT 0,
    cancellation_count          INTEGER DEFAULT 0,

    -- COD
    cod_due_balance             NUMERIC(12,2) DEFAULT 0,
    is_dispatch_blocked_by_cod  BOOLEAN DEFAULT FALSE,

    -- Onboarding
    onboarding_status           VARCHAR(20) DEFAULT 'DRAFT'
                                CHECK (onboarding_status IN (
                                    'DRAFT', 'UNDER_REVIEW', 'ACTION_REQUIRED',
                                    'APPROVED', 'REJECTED', 'SUSPENDED'
                                )),
    onboarding_step             INTEGER DEFAULT 0,
    onboarding_draft            JSONB,

    -- Razorpay
    razorpay_contact_id         TEXT,
    razorpay_fund_account_id    TEXT,
    razorpay_account_status     VARCHAR(20),

    version                     INTEGER NOT NULL DEFAULT 1,
    legacy_mongo_id             TEXT,
    deleted_at                  TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_provider_user ON provider.providers(user_id);
-- Global unique: provider_code never reused
CREATE UNIQUE INDEX ux_provider_code ON provider.providers(provider_code)
    WHERE provider_code IS NOT NULL;

CREATE INDEX ix_provider_location ON provider.providers USING GIST(live_location);
CREATE INDEX ix_provider_dispatch ON provider.providers(kyc_status, availability_status, is_busy)
    WHERE deleted_at IS NULL AND status = 'active';

-- ── provider_bank_details (normalized from embedded) ───────────────
CREATE TABLE provider.provider_bank_details (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL UNIQUE,
    account_holder_name     TEXT NOT NULL,
    account_number_last4    VARCHAR(4),
    account_number_hash     TEXT,
    ifsc_code               TEXT NOT NULL,
    bank_name               TEXT,
    branch                  TEXT,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'verified', 'rejected')),
    verified_at             TIMESTAMPTZ,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── provider_services ──────────────────────────────────────────────
CREATE TABLE provider.provider_services (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    price                   NUMERIC(12,2) DEFAULT 0,
    discount_percentage     NUMERIC(5,2) DEFAULT 0,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── provider_service_subservices (M:N join) ────────────────────────
CREATE TABLE provider.provider_service_subservices (
    provider_service_id     UUID NOT NULL,
    subservice_id           UUID NOT NULL,
    PRIMARY KEY (provider_service_id, subservice_id)
);

-- ── provider_service_locations (normalized from embedded) ──────────
CREATE TABLE provider.provider_service_locations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_service_id     UUID NOT NULL,
    location_id             UUID NOT NULL,
    schedules               JSONB DEFAULT '[]',
    capacity                JSONB DEFAULT '{}',
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── provider_service_documents (normalized from embedded) ──────────
CREATE TABLE provider.provider_service_documents (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_service_id     UUID NOT NULL,
    document_type           TEXT NOT NULL,
    document_url            TEXT NOT NULL,
    public_id               TEXT,
    status                  VARCHAR(20) DEFAULT 'pending',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── provider_settlements ───────────────────────────────────────────
CREATE TABLE provider.provider_settlements (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id                 UUID NOT NULL,
    booking_id                  UUID NOT NULL,
    booking_display_id          TEXT NOT NULL,
    service_name                TEXT,
    variant_name                TEXT,
    payment_type                VARCHAR(10) NOT NULL
                                CHECK (payment_type IN ('online', 'cod')),
    gross_amount                NUMERIC(12,2) NOT NULL,
    commission_percentage       NUMERIC(5,2) NOT NULL,
    commission_amount           NUMERIC(12,2) NOT NULL,
    gst_on_commission           NUMERIC(12,2) NOT NULL,
    tds_amount                  NUMERIC(12,2) NOT NULL DEFAULT 0,
    tcs_amount                  NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_payable_amount          NUMERIC(12,2) NOT NULL,
    cod_due_amount              NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency                    CHAR(3) NOT NULL DEFAULT 'INR',
    status                      VARCHAR(20) NOT NULL DEFAULT 'pending_hold'
                                CHECK (status IN (
                                    'pending_hold', 'ready_for_payout', 'processing',
                                    'paid', 'failed', 'disputed', 'held_by_admin',
                                    'cod_pending', 'cod_settled', 'cancelled'
                                )),
    is_locked                   BOOLEAN DEFAULT FALSE,
    payout_reference_id         TEXT,
    payout_utr                  TEXT,
    payout_completed_at         TIMESTAMPTZ,
    payout_idempotency_key      TEXT,
    audit_trail                 JSONB DEFAULT '[]',
    payout_attempts             INTEGER NOT NULL DEFAULT 0,
    version                     INTEGER NOT NULL DEFAULT 1,
    legacy_mongo_id             TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Business invariant: exactly one settlement per booking
CREATE UNIQUE INDEX ux_settlement_booking ON provider.provider_settlements(booking_id);
CREATE UNIQUE INDEX ux_settlement_idempotency ON provider.provider_settlements(payout_idempotency_key)
    WHERE payout_idempotency_key IS NOT NULL;

CREATE INDEX ix_settlement_provider ON provider.provider_settlements(provider_id, created_at DESC);
CREATE INDEX ix_settlement_payout ON provider.provider_settlements(created_at)
    WHERE status = 'ready_for_payout';

-- ── settlement_adjustments (IMMUTABLE) ─────────────────────────────
CREATE TABLE provider.settlement_adjustments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id           UUID NOT NULL,
    adjustment_type         VARCHAR(20) NOT NULL
                            CHECK (adjustment_type IN (
                                'reversal', 'partial_reversal', 'compensation', 'correction'
                            )),
    amount                  NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    reason                  TEXT NOT NULL,
    performed_by            UUID,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── wallets ────────────────────────────────────────────────────────
CREATE TABLE provider.wallets (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL UNIQUE,
    balance                 NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    fencing_token           INTEGER NOT NULL DEFAULT 0,
    version                 INTEGER NOT NULL DEFAULT 1,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── wallet_transactions (IMMUTABLE, hash chain) ────────────────────
CREATE TABLE provider.wallet_transactions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    type                    VARCHAR(20) NOT NULL
                            CHECK (type IN (
                                'recharge', 'refund', 'credit', 'initial_credit',
                                'release', 'deduction', 'debit', 'hold',
                                'penalty', 'adjustment'
                            )),
    amount                  NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    balance_before          NUMERIC(12,2) NOT NULL,
    balance_after           NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    reference_type          VARCHAR(30) NOT NULL,
    reference_id            TEXT NOT NULL,
    description             TEXT NOT NULL,
    status                  VARCHAR(10) NOT NULL DEFAULT 'success'
                            CHECK (status IN ('pending', 'success', 'failed')),
    previous_hash           TEXT NOT NULL DEFAULT 'GENESIS_HASH',
    current_hash            TEXT NOT NULL,
    fencing_token           INTEGER NOT NULL CHECK (fencing_token > 0),
    trace_id                TEXT,
    correlation_id          TEXT,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- P0-6: fencing token uniqueness per provider
CREATE UNIQUE INDEX ux_wallet_tx_fencing ON provider.wallet_transactions(provider_id, fencing_token);
-- P0-4: composite reference uniqueness
CREATE UNIQUE INDEX ux_wallet_tx_ref ON provider.wallet_transactions(reference_type, reference_id);

CREATE INDEX ix_wallet_tx_provider ON provider.wallet_transactions(provider_id, created_at DESC);
CREATE INDEX ix_wallet_tx_fencing_desc ON provider.wallet_transactions(provider_id, fencing_token DESC);

-- ── wallet_audit_logs (IMMUTABLE, 2yr retention) ───────────────────
CREATE TABLE provider.wallet_audit_logs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    action                  TEXT NOT NULL,
    old_value               JSONB,
    new_value               JSONB,
    performed_by            UUID,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── wallet_reconciliation_logs (IMMUTABLE) ─────────────────────────
CREATE TABLE provider.wallet_reconciliation_logs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id                  TEXT NOT NULL,
    provider_id             UUID NOT NULL,
    cached_balance          NUMERIC(12,2) NOT NULL,
    computed_balance        NUMERIC(12,2) NOT NULL,
    diff                    NUMERIC(12,2) NOT NULL,
    status                  VARCHAR(10) NOT NULL DEFAULT 'ok'
                            CHECK (status IN ('ok', 'drift', 'error')),
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── wallet_outbox ──────────────────────────────────────────────────
CREATE TABLE provider.wallet_outbox (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                TEXT NOT NULL UNIQUE,
    provider_id             UUID NOT NULL,
    event_type              TEXT NOT NULL,
    payload                 JSONB NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'DLQ')),
    attempts                INTEGER NOT NULL DEFAULT 0,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── job_requests ───────────────────────────────────────────────────
CREATE TABLE provider.job_requests (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    booking_id              UUID NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
    offered_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at            TIMESTAMPTZ,
    response_time_seconds   INTEGER,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── provider_locations ─────────────────────────────────────────────
CREATE TABLE provider.provider_locations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    name                    TEXT,
    city                    TEXT,
    state                   TEXT,
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

CREATE INDEX ix_provider_loc_geo ON provider.provider_locations USING GIST(location);

-- ── provider_location_history (partitioned by month, 90d hot) ──────
CREATE TABLE provider.provider_location_history (
    id                      UUID DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    latitude                DOUBLE PRECISION NOT NULL,
    longitude               DOUBLE PRECISION NOT NULL,
    location                GEOGRAPHY(Point, 4326) NOT NULL,
    recorded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- ── provider_location_daily_stats ──────────────────────────────────
CREATE TABLE provider.provider_location_daily_stats (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    stats_date              DATE NOT NULL,
    total_updates           INTEGER DEFAULT 0,
    total_distance_meters   NUMERIC(12,2) DEFAULT 0,
    active_hours            NUMERIC(5,2) DEFAULT 0,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider_id, stats_date)
);

-- ── location_audit_logs ────────────────────────────────────────────
CREATE TABLE provider.location_audit_logs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    action                  TEXT NOT NULL,
    old_value               JSONB,
    new_value               JSONB,
    performed_by            UUID,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── location_change_requests ───────────────────────────────────────
CREATE TABLE provider.location_change_requests (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    old_location            JSONB,
    new_location            JSONB,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by             UUID,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── provider_calendar_blocks ───────────────────────────────────────
CREATE TABLE provider.provider_calendar_blocks (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    block_date              DATE NOT NULL,
    start_time              TEXT,
    end_time                TEXT,
    reason                  TEXT,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── provider_leaves ────────────────────────────────────────────────
CREATE TABLE provider.provider_leaves (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    start_date              DATE NOT NULL,
    end_date                DATE NOT NULL,
    reason                  TEXT,
    status                  VARCHAR(20) NOT NULL DEFAULT 'approved'
                            CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── provider_stats ─────────────────────────────────────────────────
CREATE TABLE provider.provider_stats (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    period                  TEXT NOT NULL,
    period_start            DATE NOT NULL,
    total_bookings          INTEGER DEFAULT 0,
    completed_bookings      INTEGER DEFAULT 0,
    cancelled_bookings      INTEGER DEFAULT 0,
    total_earnings          NUMERIC(12,2) DEFAULT 0,
    currency                CHAR(3) DEFAULT 'INR',
    average_rating          NUMERIC(3,2) DEFAULT 0,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider_id, period, period_start)
);

-- ── provider_scores ────────────────────────────────────────────────
CREATE TABLE provider.provider_scores (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL UNIQUE,
    acceptance_rate         NUMERIC(5,2) DEFAULT 0,
    completion_rate         NUMERIC(5,2) DEFAULT 0,
    cancellation_rate       NUMERIC(5,2) DEFAULT 0,
    average_response_time   INTEGER DEFAULT 0,
    overall_score           NUMERIC(5,2) DEFAULT 0,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── provider_counters ──────────────────────────────────────────────
CREATE TABLE provider.provider_counters (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL UNIQUE,
    total_jobs_offered      INTEGER DEFAULT 0,
    total_jobs_accepted     INTEGER DEFAULT 0,
    total_jobs_rejected     INTEGER DEFAULT 0,
    total_jobs_completed    INTEGER DEFAULT 0,
    total_jobs_cancelled    INTEGER DEFAULT 0,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── payouts ────────────────────────────────────────────────────────
CREATE TABLE provider.payouts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    settlement_id           UUID,
    amount                  NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'reversed')),
    utr                     TEXT,
    payout_reference        TEXT,
    failure_reason          TEXT,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── settlement_payout_attempts ─────────────────────────────────────
CREATE TABLE provider.settlement_payout_attempts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id           UUID NOT NULL,
    attempt_number          INTEGER NOT NULL,
    status                  VARCHAR(20) NOT NULL,
    gateway_response        JSONB,
    error_message           TEXT,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── compensation_outbox ────────────────────────────────────────────
CREATE TABLE provider.compensation_outbox (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                TEXT NOT NULL UNIQUE,
    booking_id              UUID NOT NULL,
    provider_id             UUID NOT NULL,
    compensation_type       TEXT NOT NULL,
    amount                  NUMERIC(12,2),
    currency                CHAR(3) DEFAULT 'INR',
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'DLQ')),
    attempts                INTEGER NOT NULL DEFAULT 0,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── lead marketplace ───────────────────────────────────────────────
CREATE TABLE provider.lead_packages (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    credits                 INTEGER NOT NULL,
    price                   NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    status                  VARCHAR(10) DEFAULT 'active',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE provider.lead_package_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    package_id              UUID NOT NULL,
    amount                  NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) DEFAULT 'INR',
    status                  VARCHAR(20) DEFAULT 'pending',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE provider.lead_transactions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    type                    VARCHAR(20) NOT NULL,
    amount                  INTEGER NOT NULL,
    balance_after           INTEGER NOT NULL,
    reference_type          TEXT,
    reference_id            TEXT,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE provider.lead_reservations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    booking_id              UUID NOT NULL,
    amount                  INTEGER NOT NULL,
    status                  VARCHAR(20) DEFAULT 'reserved',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE provider.lead_fee_configs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id             UUID,
    fee_amount              NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) DEFAULT 'INR',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── referrals ──────────────────────────────────────────────────────
CREATE TABLE provider.provider_referrals (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id             UUID NOT NULL,
    referred_id             UUID NOT NULL,
    status                  VARCHAR(20) DEFAULT 'pending',
    reward_amount           NUMERIC(12,2) DEFAULT 0,
    currency                CHAR(3) DEFAULT 'INR',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (referrer_id, referred_id)
);

CREATE TABLE provider.provider_referral_campaigns (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    referrer_reward         NUMERIC(12,2) DEFAULT 0,
    referred_reward         NUMERIC(12,2) DEFAULT 0,
    currency                CHAR(3) DEFAULT 'INR',
    status                  VARCHAR(10) DEFAULT 'active',
    start_date              TIMESTAMPTZ,
    end_date                TIMESTAMPTZ,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── onboarding commerce ────────────────────────────────────────────
CREATE TABLE provider.starter_kits (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    items                   JSONB DEFAULT '[]',
    price                   NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) DEFAULT 'INR',
    status                  VARCHAR(10) DEFAULT 'active',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE provider.kit_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    kit_id                  UUID NOT NULL,
    status                  VARCHAR(20) DEFAULT 'pending',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE provider.accessory_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    items                   JSONB DEFAULT '[]',
    total_amount            NUMERIC(12,2) DEFAULT 0,
    currency                CHAR(3) DEFAULT 'INR',
    status                  VARCHAR(20) DEFAULT 'pending',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE provider.provider_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    order_type              TEXT NOT NULL,
    items                   JSONB DEFAULT '[]',
    total_amount            NUMERIC(12,2) DEFAULT 0,
    currency                CHAR(3) DEFAULT 'INR',
    status                  VARCHAR(20) DEFAULT 'pending',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── dispatch config ────────────────────────────────────────────────
CREATE TABLE provider.dispatch_settings (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id             UUID,
    settings                JSONB NOT NULL DEFAULT '{}',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE provider.dispatch_configurations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config                  JSONB NOT NULL DEFAULT '{}',
    is_active               BOOLEAN DEFAULT TRUE,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE provider.category_dispatch_rules (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id             UUID NOT NULL,
    rules                   JSONB NOT NULL DEFAULT '{}',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE provider.category_snapshots (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id             UUID NOT NULL,
    snapshot_data           JSONB NOT NULL,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── subscription ───────────────────────────────────────────────────
CREATE TABLE provider.subscription_policies (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier                    TEXT NOT NULL,
    rules                   JSONB NOT NULL DEFAULT '{}',
    pricing                 JSONB NOT NULL DEFAULT '{}',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE provider.subscription_audit_logs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    action                  TEXT NOT NULL,
    old_value               JSONB,
    new_value               JSONB,
    performed_by            UUID,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── verification / waivers ─────────────────────────────────────────
CREATE TABLE provider.verification_actions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    action_type             TEXT NOT NULL,
    status                  VARCHAR(20) DEFAULT 'pending',
    details                 JSONB,
    performed_by            UUID,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE provider.waivers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    waiver_type             TEXT NOT NULL,
    amount                  NUMERIC(12,2) DEFAULT 0,
    currency                CHAR(3) DEFAULT 'INR',
    reason                  TEXT,
    approved_by             UUID,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── razorpay payout webhooks ───────────────────────────────────────
CREATE TABLE provider.razorpay_payout_webhooks (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                TEXT NOT NULL UNIQUE,
    payload                 JSONB NOT NULL,
    processed               BOOLEAN NOT NULL DEFAULT FALSE,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── reconciliation cursors ─────────────────────────────────────────
CREATE TABLE provider.reconcursors (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cursor_name             TEXT NOT NULL UNIQUE,
    last_processed_id       TEXT,
    legacy_mongo_id         TEXT,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── rating events ──────────────────────────────────────────────────
CREATE TABLE provider.rating_events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    booking_id              UUID NOT NULL,
    rating                  SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    processed               BOOLEAN NOT NULL DEFAULT FALSE,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
