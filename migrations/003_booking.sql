-- 003_booking.sql
-- BharatClap PostgreSQL Migration — Booking Schema
-- Owner: booking-service

CREATE SCHEMA IF NOT EXISTS booking;

-- ── bookings ───────────────────────────────────────────────────────
CREATE TABLE booking.bookings (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id                  TEXT NOT NULL,
    order_id                    UUID,
    user_id                     UUID NOT NULL,
    provider_id                 UUID,
    subservice_id               UUID NOT NULL,
    provider_service_id         UUID,
    address_id                  UUID NOT NULL,
    variant_name                TEXT,
    preferred_gender            VARCHAR(10)
                                CHECK (preferred_gender IN ('MALE', 'FEMALE', 'ANY')),

    status                      VARCHAR(40) NOT NULL DEFAULT 'pending'
                                CHECK (status IN (
                                    'pending', 'scheduled', 'provider_searching',
                                    'unassigned_timeout', 'HIGH_DEMAND_TIMEOUT',
                                    'assigned', 'provider_accepted', 'accepted',
                                    'confirmed', 'ready_confirmed',
                                    'cancellation_requested', 'delayed', 'expired',
                                    'rejected', 'on_the_way', 'arrived', 'reached',
                                    'otp_verified', 'in_progress', 'completed',
                                    'cancelled', 'refund_processing',
                                    'waiting_start_otp', 'waiting_end_otp',
                                    'reassigned', 'service_completed',
                                    'payment_pending'
                                )),
    dispatch_status             VARCHAR(30) DEFAULT 'Waiting',
    payment_status              VARCHAR(30) NOT NULL DEFAULT 'pending'
                                CHECK (payment_status IN (
                                    'pending', 'completed', 'failed', 'cancelled',
                                    'refunded', 'partially_refunded', 'paid'
                                )),
    settlement_status           VARCHAR(30) DEFAULT 'Not Created',
    finance_status              VARCHAR(30) NOT NULL DEFAULT 'pending'
                                CHECK (finance_status IN (
                                    'pending', 'collecting', 'payment_verified',
                                    'settlement_created', 'settlement_hold',
                                    'ready_for_payout', 'paid', 'disputed', 'expired'
                                )),
    paid_via                    VARCHAR(30),
    payment_method              VARCHAR(20),
    scheduled_at                TIMESTAMPTZ NOT NULL,
    booking_time                TEXT NOT NULL,
    provider_search_expires_at  TIMESTAMPTZ,

    -- Money (NUMERIC, never float)
    service_price               NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_amount             NUMERIC(12,2) NOT NULL DEFAULT 0,
    slot_charge                 NUMERIC(12,2) DEFAULT 0,
    payable_amount              NUMERIC(12,2) NOT NULL DEFAULT 0,
    commission_percentage       NUMERIC(5,2),
    commission_amount           NUMERIC(12,2),
    provider_payout             NUMERIC(12,2),
    cancellation_fee            NUMERIC(12,2) DEFAULT 0,
    refund_amount               NUMERIC(12,2),
    currency                    CHAR(3) NOT NULL DEFAULT 'INR',

    -- Pricing snapshots (JSONB — read/written as unit)
    slot_pricing_snapshot       JSONB,
    pricing_explainability      JSONB,

    -- Payment linkage
    payment_id                  UUID,
    payment_link_status         VARCHAR(10)
                                CHECK (payment_link_status IN ('linked', 'pending', 'failed')),
    idempotency_key             TEXT,
    correlation_id              TEXT,
    quote_id                    TEXT,
    invoice_id                  UUID,

    -- Refund
    refund_status               VARCHAR(20) DEFAULT 'none'
                                CHECK (refund_status IN (
                                    'none', 'initiated', 'processing', 'completed', 'failed'
                                )),
    refund_id                   TEXT,
    refund_processed_at         TIMESTAMPTZ,
    refund_reference_id         TEXT,

    -- Cancellation
    cancel_reason_category      VARCHAR(20)
                                CHECK (cancel_reason_category IN (
                                    'changed_mind', 'booked_by_mistake',
                                    'provider_issue', 'price_issue', 'other'
                                )),
    cancellation_reason         TEXT,
    cancelled_by                VARCHAR(10)
                                CHECK (cancelled_by IN ('customer', 'provider', 'admin')),
    cancelled_at                TIMESTAMPTZ,

    -- Timeline
    assigned_at                 TIMESTAMPTZ,
    accepted_at                 TIMESTAMPTZ,
    started_at                  TIMESTAMPTZ,
    completed_at                TIMESTAMPTZ,

    -- Start OTP
    start_otp                   TEXT,
    start_otp_verified          BOOLEAN DEFAULT FALSE,
    start_otp_verified_at       TIMESTAMPTZ,
    start_otp_generated_at      TIMESTAMPTZ,
    start_otp_expires_at        TIMESTAMPTZ,
    start_otp_attempts          INTEGER DEFAULT 0,
    service_started_at          TIMESTAMPTZ,

    -- End OTP
    end_otp                     TEXT,
    end_otp_verified            BOOLEAN DEFAULT FALSE,
    end_otp_verified_at         TIMESTAMPTZ,
    end_otp_generated_at        TIMESTAMPTZ,
    end_otp_expires_at          TIMESTAMPTZ,
    end_otp_attempts            INTEGER DEFAULT 0,
    service_ended_at            TIMESTAMPTZ,

    -- Provider logistics
    provider_response_time      INTEGER,
    provider_arrival_time       TIMESTAMPTZ,
    estimated_distance          NUMERIC(8,2),
    estimated_travel_minutes    INTEGER,
    estimated_arrival_time      TIMESTAMPTZ,
    navigation_url              TEXT,
    estimated_duration          INTEGER,
    actual_duration             INTEGER,
    planned_end_time            TIMESTAMPTZ,
    actual_end_time             TIMESTAMPTZ,
    reserved_travel_start       TIMESTAMPTZ,
    reserved_travel_end         TIMESTAMPTZ,

    -- Dispatch
    dispatch_state              JSONB,
    dispatch_lock_until         TIMESTAMPTZ,
    dispatch_worker_id          TEXT,
    redispatch_count            INTEGER NOT NULL DEFAULT 0,
    max_redispatch_attempts     INTEGER NOT NULL DEFAULT 3,
    last_redispatch_at          TIMESTAMPTZ,

    -- Media
    after_photos                TEXT[] DEFAULT '{}',
    invoice_url                 TEXT,

    is_reviewed                 BOOLEAN NOT NULL DEFAULT FALSE,
    legacy_mongo_id             TEXT,
    version                     INTEGER NOT NULL DEFAULT 1,
    deleted_at                  TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global unique: booking display ID never reused
CREATE UNIQUE INDEX ux_booking_display_id ON booking.bookings(booking_id);

-- Idempotency scoped to user (P0 fix: scoped, not global)
CREATE UNIQUE INDEX ux_booking_idempotency ON booking.bookings(user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Query indexes
CREATE INDEX ix_booking_user_created ON booking.bookings(user_id, created_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX ix_booking_provider_created ON booking.bookings(provider_id, created_at DESC)
    WHERE deleted_at IS NULL AND provider_id IS NOT NULL;
CREATE INDEX ix_booking_status_created ON booking.bookings(status, created_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX ix_booking_provider_status ON booking.bookings(provider_id, status, created_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX ix_booking_scheduled ON booking.bookings(scheduled_at)
    WHERE deleted_at IS NULL;
CREATE INDEX ix_booking_dispatch ON booking.bookings(dispatch_lock_until)
    WHERE dispatch_lock_until IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_booking_finance ON booking.bookings(finance_status, created_at DESC)
    WHERE deleted_at IS NULL;

-- Partial index for active bookings dashboard
CREATE INDEX ix_booking_active ON booking.bookings(provider_id, created_at DESC)
    WHERE deleted_at IS NULL
    AND status IN ('pending', 'assigned', 'accepted', 'in_progress',
                   'on_the_way', 'arrived', 'waiting_start_otp',
                   'waiting_end_otp');

-- ── booking_financial_snapshots (IMMUTABLE) ────────────────────────
CREATE TABLE booking.booking_financial_snapshots (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id              UUID NOT NULL,
    snapshot_version        INTEGER NOT NULL,
    base_price              NUMERIC(12,2) NOT NULL,
    slot_charge             NUMERIC(12,2) DEFAULT 0,
    surge                   NUMERIC(12,2) DEFAULT 0,
    coupon_code             TEXT,
    discount_amount         NUMERIC(12,2) DEFAULT 0,
    platform_fee            NUMERIC(12,2) DEFAULT 0,
    commission_amount       NUMERIC(12,2) DEFAULT 0,
    gst_amount              NUMERIC(12,2) DEFAULT 0,
    provider_share          NUMERIC(12,2) DEFAULT 0,
    customer_payable        NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    reason                  TEXT,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (booking_id, snapshot_version)
);

-- ── booking_payment_collections (1:1 with booking) ─────────────────
CREATE TABLE booking.booking_payment_collections (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id              UUID NOT NULL UNIQUE,
    status                  VARCHAR(20) NOT NULL DEFAULT 'none'
                            CHECK (status IN (
                                'none', 'pending', 'cash_collected', 'upi_pending',
                                'upi_completed', 'verified', 'disputed', 'partial',
                                'expired', 'admin_exception'
                            )),
    method                  VARCHAR(10)
                            CHECK (method IN ('cash', 'upi', 'prepaid')),
    final_amount            NUMERIC(12,2) NOT NULL DEFAULT 0,
    collected_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    remaining_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    confirmed_by            VARCHAR(10)
                            CHECK (confirmed_by IN ('provider', 'customer', 'system', 'admin')),
    confirmed_at            TIMESTAMPTZ,
    transaction_id          TEXT,
    expires_at              TIMESTAMPTZ,
    customer_confirmed      BOOLEAN,
    customer_confirmed_at   TIMESTAMPTZ,
    attempts                INTEGER NOT NULL DEFAULT 0,
    provider_confirmation   JSONB,
    financial_snapshot      JSONB,
    payout_status           VARCHAR(20)
                            CHECK (payout_status IN ('pending', 'processing', 'paid', 'failed')),
    payout_id               TEXT,
    payout_paid_at          TIMESTAMPTZ,
    version                 INTEGER NOT NULL DEFAULT 1,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── payment_collection_links ───────────────────────────────────────
CREATE TABLE booking.payment_collection_links (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id           UUID NOT NULL,
    link_id                 TEXT NOT NULL,
    url                     TEXT NOT NULL,
    amount                  NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    status                  VARCHAR(10) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'paid', 'expired', 'cancelled')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── booking_previous_providers ─────────────────────────────────────
CREATE TABLE booking.booking_previous_providers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id              UUID NOT NULL,
    provider_id             UUID,
    accepted_at             TIMESTAMPTZ,
    unassigned_at           TIMESTAMPTZ,
    reason                  TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── booking_admin_notes (IMMUTABLE, append-only) ───────────────────
CREATE TABLE booking.booking_admin_notes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id              UUID NOT NULL,
    note                    TEXT NOT NULL,
    added_by                TEXT NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── booking_activities ─────────────────────────────────────────────
CREATE TABLE booking.booking_activities (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id              UUID NOT NULL,
    action                  TEXT NOT NULL,
    actor                   VARCHAR(10) NOT NULL DEFAULT 'system'
                            CHECK (actor IN ('customer', 'provider', 'admin', 'system')),
    details                 JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_activity_booking ON booking.booking_activities(booking_id, created_at DESC);

-- ── slot_capacities ────────────────────────────────────────────────
CREATE TABLE booking.slot_capacities (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    slot_date               DATE NOT NULL,
    slot                    TEXT NOT NULL,
    booked_count            INTEGER NOT NULL DEFAULT 0
                            CHECK (booked_count >= 0),
    max_capacity            INTEGER NOT NULL DEFAULT 8
                            CHECK (max_capacity > 0),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider_id, slot_date, slot),
    CHECK (booked_count <= max_capacity)
);

-- ── reviews ────────────────────────────────────────────────────────
CREATE TABLE booking.reviews (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id              UUID NOT NULL UNIQUE,
    user_id                 UUID NOT NULL,
    provider_id             UUID NOT NULL,
    service_id              UUID NOT NULL,
    subservice_id           UUID NOT NULL,
    rating                  SMALLINT NOT NULL
                            CHECK (rating BETWEEN 1 AND 5),
    comment                 TEXT,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── conversations ──────────────────────────────────────────────────
CREATE TABLE booking.conversations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id              UUID,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'closed', 'archived')),
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── conversation_participants (normalized from JSONB, P1-fix) ──────
CREATE TABLE booking.conversation_participants (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id         UUID NOT NULL,
    user_id                 UUID NOT NULL,
    participant_type        VARCHAR(10) NOT NULL
                            CHECK (participant_type IN ('customer', 'provider', 'admin')),
    joined_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at                 TIMESTAMPTZ,
    UNIQUE (conversation_id, user_id)
);

CREATE INDEX ix_participant_user ON booking.conversation_participants(user_id, joined_at DESC);

-- ── chat_messages ──────────────────────────────────────────────────
CREATE TABLE booking.chat_messages (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id         UUID NOT NULL,
    sender_id               UUID NOT NULL,
    message                 TEXT NOT NULL,
    message_type            VARCHAR(20) NOT NULL DEFAULT 'text'
                            CHECK (message_type IN ('text', 'image', 'system', 'audio')),
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_chat_conversation ON booking.chat_messages(conversation_id, created_at);

-- ── orders ─────────────────────────────────────────────────────────
CREATE TABLE booking.orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL,
    items                   JSONB NOT NULL DEFAULT '[]',
    total_amount            NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── carts ──────────────────────────────────────────────────────────
CREATE TABLE booking.carts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL,
    items                   JSONB NOT NULL DEFAULT '[]',
    total                   NUMERIC(12,2) DEFAULT 0,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── complaints ─────────────────────────────────────────────────────
CREATE TABLE booking.complaints (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id              UUID NOT NULL,
    user_id                 UUID NOT NULL,
    description             TEXT NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── coupon_redemptions ─────────────────────────────────────────────
CREATE TABLE booking.coupon_redemptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id               UUID NOT NULL,
    user_id                 UUID NOT NULL,
    booking_id              UUID NOT NULL,
    discount_amount         NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── event_outbox ───────────────────────────────────────────────────
CREATE TABLE booking.event_outbox (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                TEXT NOT NULL UNIQUE,
    event_type              TEXT NOT NULL,
    payload                 TEXT NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'DLQ')),
    attempts                INTEGER NOT NULL DEFAULT 0,
    last_attempted_at       TIMESTAMPTZ,
    lease_expires_at        TIMESTAMPTZ,
    lease_owner             TEXT,
    error_message           TEXT,
    published_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_outbox_pending ON booking.event_outbox(status, created_at)
    WHERE status IN ('PENDING', 'PROCESSING');

-- ── settlement_outbox ──────────────────────────────────────────────
CREATE TABLE booking.settlement_outbox (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                TEXT NOT NULL UNIQUE,
    booking_id              UUID NOT NULL,
    provider_id             UUID NOT NULL,
    amount                  NUMERIC(12,2),
    currency                CHAR(3) DEFAULT 'INR',
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'DLQ')),
    attempts                INTEGER NOT NULL DEFAULT 0,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── lead_refund_outbox ─────────────────────────────────────────────
CREATE TABLE booking.lead_refund_outbox (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                TEXT NOT NULL UNIQUE,
    booking_id              UUID NOT NULL,
    provider_id             UUID NOT NULL,
    amount                  NUMERIC(12,2),
    currency                CHAR(3) DEFAULT 'INR',
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'DLQ')),
    attempts                INTEGER NOT NULL DEFAULT 0,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── rating_outbox ──────────────────────────────────────────────────
CREATE TABLE booking.rating_outbox (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                TEXT NOT NULL UNIQUE,
    booking_id              UUID NOT NULL,
    provider_id             UUID NOT NULL,
    rating                  SMALLINT NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'DLQ')),
    attempts                INTEGER NOT NULL DEFAULT 0,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── pricing_quotes ─────────────────────────────────────────────────
CREATE TABLE booking.pricing_quotes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id                TEXT NOT NULL UNIQUE,
    user_id                 UUID NOT NULL,
    subservice_id           UUID NOT NULL,
    variant_name            TEXT,
    pricing_breakdown       JSONB NOT NULL,
    final_amount            NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    expires_at              TIMESTAMPTZ NOT NULL,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── refund_policies ────────────────────────────────────────────────
CREATE TABLE booking.refund_policies (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id             UUID,
    hours_before_threshold  INTEGER NOT NULL DEFAULT 24,
    refund_percentage       NUMERIC(5,2) NOT NULL DEFAULT 100,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── waitlists ──────────────────────────────────────────────────────
CREATE TABLE booking.waitlists (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL,
    subservice_id           UUID NOT NULL,
    preferred_date          DATE NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'waiting'
                            CHECK (status IN ('waiting', 'notified', 'booked', 'expired')),
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── payment_collection_audits (IMMUTABLE) ──────────────────────────
CREATE TABLE booking.payment_collection_audits (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id              UUID NOT NULL,
    action                  TEXT NOT NULL,
    old_status              TEXT,
    new_status              TEXT,
    performed_by            TEXT,
    details                 JSONB,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
