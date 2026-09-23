-- 013_schema_migrations.sql
-- BharatClap PostgreSQL Migration — Migration version tracking
-- Prevents re-running or silently modifying applied migrations.
-- Key: filename (not version integer, since 005 and 005b collide)

CREATE TABLE IF NOT EXISTS migration.schema_migrations (
    filename            TEXT NOT NULL PRIMARY KEY,
    checksum            TEXT NOT NULL,
    applied_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    execution_time_ms   INTEGER
);
