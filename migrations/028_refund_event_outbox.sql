-- 028_refund_event_outbox.sql
-- Durable outbox for post-refund synchronization (Defect J fix)
-- Ensures refund events survive downstream failures and retry safely

-- Refund event outbox: one row per completed gateway refund
CREATE TABLE IF NOT EXISTS payment.refund_event_outbox (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_event_id         TEXT NOT NULL UNIQUE,     -- stable idempotency key
    refund_id               UUID NOT NULL,
    booking_id              UUID,
    payment_id              UUID,
    provider_id             UUID,
    gateway_refund_id       TEXT,
    refund_amount           NUMERIC(12,2) NOT NULL,
    refund_type             VARCHAR(20) NOT NULL DEFAULT 'full',
    event_type              VARCHAR(40) NOT NULL DEFAULT 'refund.completed',

    -- Downstream sync tracking
    booking_synced          BOOLEAN NOT NULL DEFAULT FALSE,
    payment_synced          BOOLEAN NOT NULL DEFAULT FALSE,
    provider_synced         BOOLEAN NOT NULL DEFAULT FALSE,

    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'DLQ')),
    attempts                INTEGER NOT NULL DEFAULT 0,
    last_error              TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_refund_outbox_status ON payment.refund_event_outbox(status)
    WHERE status IN ('PENDING', 'PROCESSING', 'PARTIAL');

-- Settlement: add refund tracking columns for race protection (Defect K)
ALTER TABLE provider.provider_settlements
    ADD COLUMN IF NOT EXISTS refund_event_id TEXT,
    ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS refund_processed_at TIMESTAMPTZ;

-- Unique: one refund event per settlement
CREATE UNIQUE INDEX IF NOT EXISTS ux_settlement_refund_event
    ON provider.provider_settlements(refund_event_id)
    WHERE refund_event_id IS NOT NULL;
