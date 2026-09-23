-- 006_notification.sql
-- BharatClap PostgreSQL Migration — Notification Schema
-- Owner: notification-service

CREATE SCHEMA IF NOT EXISTS notification;

-- ── notifications ──────────────────────────────────────────────────
CREATE TABLE notification.notifications (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id            UUID NOT NULL,
    recipient_type          VARCHAR(10) NOT NULL DEFAULT 'customer'
                            CHECK (recipient_type IN ('customer', 'provider', 'admin')),
    title                   TEXT NOT NULL,
    message                 TEXT NOT NULL,
    type                    VARCHAR(30),
    is_read                 BOOLEAN NOT NULL DEFAULT FALSE,
    metadata                JSONB,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Retention: scheduled job deletes WHERE created_at < NOW() - INTERVAL '180 days'
CREATE INDEX ix_notification_recipient ON notification.notifications(recipient_id, is_read, created_at DESC);

-- ── admin_reports ──────────────────────────────────────────────────
CREATE TABLE notification.admin_reports (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type             TEXT NOT NULL,
    data                    JSONB NOT NULL,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── processed_events (idempotency guard) ───────────────────────────
CREATE TABLE notification.processed_events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                TEXT NOT NULL UNIQUE,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── system_settings ────────────────────────────────────────────────
CREATE TABLE notification.system_settings (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key                     TEXT NOT NULL UNIQUE,
    value                   JSONB NOT NULL,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
