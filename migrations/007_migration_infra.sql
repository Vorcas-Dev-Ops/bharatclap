-- 007_migration_infra.sql
-- BharatClap PostgreSQL Migration — Migration Infrastructure
-- Used during Mongo→PG migration only; can be dropped after decommission

CREATE SCHEMA IF NOT EXISTS migration;

-- ── mongo_id_map (ObjectId → UUID mapping) ─────────────────────────
-- P0-7/P1-13: namespaced by source_db + collection to avoid cross-db ObjectId collisions
CREATE TABLE migration.mongo_id_map (
    source_db               TEXT NOT NULL,
    collection_name         TEXT NOT NULL,
    mongo_id                TEXT NOT NULL,
    pg_id                   UUID NOT NULL,
    mapped_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (source_db, collection_name, mongo_id),
    UNIQUE (pg_id)
);

-- ── checkpoints (resumable migration, P0-fix) ─────────────────────
CREATE TABLE migration.checkpoints (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_db               TEXT NOT NULL,
    collection_name         TEXT NOT NULL,
    last_mongo_id           TEXT,
    processed_count         BIGINT NOT NULL DEFAULT 0,
    inserted_count          BIGINT NOT NULL DEFAULT 0,
    failed_count            BIGINT NOT NULL DEFAULT 0,
    skipped_count           BIGINT NOT NULL DEFAULT 0,
    error_threshold         INTEGER NOT NULL DEFAULT 100,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'paused')),
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_db, collection_name)
);

-- ── failed_records (every conflict/error logged, never silently skipped) ──
CREATE TABLE migration.failed_records (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_db               TEXT NOT NULL,
    collection_name         TEXT NOT NULL,
    mongo_id                TEXT NOT NULL,
    error_message           TEXT NOT NULL,
    error_code              TEXT,
    source_document         JSONB,
    resolved                BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_failed_unresolved ON migration.failed_records(source_db, collection_name)
    WHERE resolved = FALSE;

-- ── reconciliation_runs (deterministic financial reconciliation) ────
CREATE TABLE migration.reconciliation_runs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type                TEXT NOT NULL,
    source_db               TEXT NOT NULL,
    collection_name         TEXT NOT NULL,
    mongo_value             TEXT NOT NULL,
    pg_value                TEXT NOT NULL,
    matches                 BOOLEAN NOT NULL,
    details                 JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
