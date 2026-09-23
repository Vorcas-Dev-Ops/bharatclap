-- 005_payment.sql
-- BharatClap PostgreSQL Migration — Payment Schema
-- Owner: payment-service (also owns refund tables)
-- P0-1: customer_wallets + customer_wallet_transactions live here (single source of truth)

CREATE SCHEMA IF NOT EXISTS payment;

-- ── payments ───────────────────────────────────────────────────────
CREATE TABLE payment.payments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id              UUID NOT NULL,
    user_id                 UUID NOT NULL,
    amount                  NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    payment_method          VARCHAR(20),
    payment_status          VARCHAR(20) NOT NULL DEFAULT 'Created'
                            CHECK (payment_status IN (
                                'Created', 'Attempted', 'Authorized', 'Captured',
                                'Failed', 'Refunded', 'Partially_Refunded'
                            )),
    razorpay_order_id       TEXT,
    razorpay_payment_id     TEXT,
    razorpay_signature      TEXT,
    transaction_id          TEXT,
    correlation_id          TEXT,
    refund_metadata         JSONB,
    status_history          JSONB DEFAULT '[]',
    version                 INTEGER NOT NULL DEFAULT 1,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_payment_razorpay ON payment.payments(razorpay_payment_id)
    WHERE razorpay_payment_id IS NOT NULL;
CREATE UNIQUE INDEX ux_payment_txn ON payment.payments(transaction_id)
    WHERE transaction_id IS NOT NULL;
CREATE INDEX ix_payment_booking ON payment.payments(booking_id, payment_status);
CREATE INDEX ix_payment_user ON payment.payments(user_id, created_at DESC);

-- ── payment_attempts ───────────────────────────────────────────────
CREATE TABLE payment.payment_attempts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id              UUID NOT NULL,
    amount                  NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    status                  VARCHAR(20) NOT NULL,
    gateway_response        JSONB,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── payment_event_outbox ───────────────────────────────────────────
CREATE TABLE payment.payment_event_outbox (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                TEXT NOT NULL UNIQUE,
    event_type              TEXT NOT NULL,
    payload                 JSONB NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'DLQ')),
    attempts                INTEGER NOT NULL DEFAULT 0,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── payment_dlq ────────────────────────────────────────────────────
CREATE TABLE payment.payment_dlq (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                TEXT,
    error_message           TEXT,
    payload                 JSONB,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── webhook_logs (IMMUTABLE, P0-5: atomic idempotency) ─────────────
CREATE TABLE payment.webhook_logs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                TEXT NOT NULL,
    event_type              TEXT NOT NULL,
    signature_valid         BOOLEAN NOT NULL,
    received_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    result                  TEXT,
    payload                 JSONB,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_webhook_event ON payment.webhook_logs(event_id);

-- ── refunds ────────────────────────────────────────────────────────
CREATE TABLE payment.refunds (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id              UUID NOT NULL,
    customer_id             UUID NOT NULL,
    provider_id             UUID,
    refund_amount           NUMERIC(12,2) NOT NULL,
    refund_type             VARCHAR(20) NOT NULL
                            CHECK (refund_type IN (
                                'full', 'partial', 'lead_fee', 'cancellation',
                                'complaint', 'admin'
                            )),
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    reason                  TEXT,
    status                  VARCHAR(20) NOT NULL DEFAULT 'REQUESTED'
                            CHECK (status IN (
                                'REQUESTED', 'APPROVED', 'PROCESSING',
                                'COMPLETED', 'FAILED', 'REJECTED',
                                'PARTIALLY_COMPLETED', 'REVERSED', 'EXPIRED'
                            )),
    gateway_refund_id       TEXT,
    gateway_response        JSONB,
    idempotency_key         TEXT NOT NULL,
    processed_at            TIMESTAMPTZ,
    version                 INTEGER NOT NULL DEFAULT 1,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_refund_idempotency ON payment.refunds(booking_id, idempotency_key);

-- ── refund_outbox_events ───────────────────────────────────────────
CREATE TABLE payment.refund_outbox_events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                TEXT NOT NULL UNIQUE,
    event_type              TEXT NOT NULL,
    aggregate_type          TEXT,
    aggregate_id            TEXT,
    payload                 JSONB NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'DLQ')),
    attempts                INTEGER NOT NULL DEFAULT 0,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── refund_policies ────────────────────────────────────────────────
CREATE TABLE payment.refund_policies (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id             UUID,
    rules                   JSONB NOT NULL DEFAULT '{}',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── invoices (IMMUTABLE) ───────────────────────────────────────────
CREATE TABLE payment.invoices (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number          TEXT NOT NULL,
    booking_id              UUID NOT NULL,
    user_id                 UUID NOT NULL,
    version                 INTEGER NOT NULL DEFAULT 1,
    service_amount          NUMERIC(12,2) NOT NULL,
    discount_amount         NUMERIC(12,2) DEFAULT 0,
    slot_charge             NUMERIC(12,2) DEFAULT 0,
    gst_amount              NUMERIC(12,2) DEFAULT 0,
    total_amount            NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    status                  VARCHAR(10) NOT NULL DEFAULT 'generated'
                            CHECK (status IN ('generated', 'sent', 'voided')),
    pdf_url                 TEXT,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global unique: invoice numbers never reused
CREATE UNIQUE INDEX ux_invoice_number ON payment.invoices(invoice_number);
CREATE UNIQUE INDEX ux_invoice_booking_ver ON payment.invoices(booking_id, version);

-- ── financial_adjustments ──────────────────────────────────────────
CREATE TABLE payment.financial_adjustments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id              UUID,
    adjustment_type         TEXT NOT NULL,
    amount                  NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    reason                  TEXT NOT NULL,
    performed_by            UUID,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── financial_audit_logs (IMMUTABLE, 7yr retention) ────────────────
CREATE TABLE payment.financial_audit_logs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action                  TEXT NOT NULL,
    actor                   TEXT,
    booking_id              UUID,
    details                 JSONB,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── payout_batches ─────────────────────────────────────────────────
CREATE TABLE payment.payout_batches (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id                TEXT NOT NULL UNIQUE,
    settlement_ids          UUID[] NOT NULL DEFAULT '{}',
    total_amount            NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'completed', 'partial', 'failed')),
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── provider_collections ───────────────────────────────────────────
CREATE TABLE payment.provider_collections (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    booking_id              UUID,
    collection_data         JSONB NOT NULL DEFAULT '{}',
    amount                  NUMERIC(12,2) DEFAULT 0,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    status                  VARCHAR(20) DEFAULT 'pending',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── razorpay_payment_qrs ───────────────────────────────────────────
CREATE TABLE payment.razorpay_payment_qrs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    qr_data                 JSONB NOT NULL DEFAULT '{}',
    status                  VARCHAR(20) DEFAULT 'active',
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── user_memberships ───────────────────────────────────────────────
CREATE TABLE payment.user_memberships (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL,
    membership_id           UUID NOT NULL,
    start_date              TIMESTAMPTZ NOT NULL,
    end_date                TIMESTAMPTZ NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'expired', 'cancelled')),
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── coupon_usages ──────────────────────────────────────────────────
CREATE TABLE payment.coupon_usages (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id               UUID NOT NULL,
    user_id                 UUID NOT NULL,
    booking_id              UUID NOT NULL,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── cash_remittances ───────────────────────────────────────────────
CREATE TABLE payment.cash_remittances (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             UUID NOT NULL,
    amount                  NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'collected', 'verified', 'disputed')),
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══ P0-1: Customer Wallet (single source of truth) ═════════════════

-- ── customer_wallets (materialized balance) ────────────────────────
CREATE TABLE payment.customer_wallets (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL UNIQUE,
    balance                 NUMERIC(12,2) NOT NULL DEFAULT 0
                            CHECK (balance >= 0),
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    version                 INTEGER NOT NULL DEFAULT 1,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── customer_wallet_transactions (IMMUTABLE ledger) ────────────────
CREATE TABLE payment.customer_wallet_transactions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL,
    wallet_id               UUID NOT NULL,
    type                    VARCHAR(20) NOT NULL
                            CHECK (type IN (
                                'referral_credit', 'promo_credit', 'cashback',
                                'booking_debit', 'expiry_debit', 'adjustment',
                                'refund_credit'
                            )),
    amount                  NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    balance_before          NUMERIC(12,2) NOT NULL,
    balance_after           NUMERIC(12,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    reference_type          VARCHAR(30) NOT NULL,
    reference_id            TEXT NOT NULL,
    description             TEXT NOT NULL,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_cust_wallet_tx_ref
    ON payment.customer_wallet_transactions(reference_type, reference_id);
CREATE INDEX ix_cust_wallet_tx_user
    ON payment.customer_wallet_transactions(user_id, created_at DESC);
