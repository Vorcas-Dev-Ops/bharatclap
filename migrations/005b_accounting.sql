-- 005b_accounting.sql
-- BharatClap PostgreSQL Migration — Accounting Schema (P0-2: proper double-entry)
-- Owner: payment-service (settlements), provider-service (wallet journals)
-- Both services have INSERT on journal_entries + journal_lines; neither has UPDATE/DELETE

CREATE SCHEMA IF NOT EXISTS accounting;

-- ── chart_of_accounts ──────────────────────────────────────────────
CREATE TABLE accounting.chart_of_accounts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                    TEXT NOT NULL UNIQUE,
    name                    TEXT NOT NULL,
    account_type            VARCHAR(20) NOT NULL
                            CHECK (account_type IN (
                                'asset', 'liability', 'equity', 'revenue', 'expense'
                            )),
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── journal_entries (transaction header, IMMUTABLE) ────────────────
CREATE TABLE accounting.journal_entries (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id          TEXT NOT NULL UNIQUE,
    reference_type          VARCHAR(30) NOT NULL,
    reference_id            TEXT NOT NULL,
    description             TEXT NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    status                  VARCHAR(10) NOT NULL DEFAULT 'posted'
                            CHECK (status IN ('posted', 'reversed')),
    posted_by               TEXT,
    provider_id             UUID,
    booking_id              UUID,
    settlement_id           UUID,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_journal_ref ON accounting.journal_entries(reference_type, reference_id);
CREATE INDEX ix_journal_provider ON accounting.journal_entries(provider_id, created_at DESC)
    WHERE provider_id IS NOT NULL;
CREATE INDEX ix_journal_booking ON accounting.journal_entries(booking_id)
    WHERE booking_id IS NOT NULL;

-- ── journal_lines (individual legs, IMMUTABLE) ─────────────────────
CREATE TABLE accounting.journal_lines (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id        UUID NOT NULL,
    account_id              UUID NOT NULL,
    debit                   NUMERIC(12,2) NOT NULL DEFAULT 0
                            CHECK (debit >= 0),
    credit                  NUMERIC(12,2) NOT NULL DEFAULT 0
                            CHECK (credit >= 0),
    -- Exactly one side must be positive
    CHECK (
        (debit > 0 AND credit = 0) OR
        (debit = 0 AND credit > 0)
    ),
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_jl_entry ON accounting.journal_lines(journal_entry_id);
CREATE INDEX ix_jl_account ON accounting.journal_lines(account_id, created_at DESC);

-- FK (within same schema, safe to define inline)
ALTER TABLE accounting.journal_lines
    ADD CONSTRAINT fk_jl_entry
    FOREIGN KEY (journal_entry_id)
    REFERENCES accounting.journal_entries(id) ON DELETE RESTRICT;

ALTER TABLE accounting.journal_lines
    ADD CONSTRAINT fk_jl_account
    FOREIGN KEY (account_id)
    REFERENCES accounting.chart_of_accounts(id) ON DELETE RESTRICT;

-- ── Balanced-journal constraint trigger (P0-2) ─────────────────────
-- Fires at COMMIT time: allows multi-line inserts within a single transaction,
-- then validates SUM(debit) = SUM(credit) for the journal entry.
CREATE OR REPLACE FUNCTION accounting.verify_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
    total_debit  NUMERIC(12,2);
    total_credit NUMERIC(12,2);
BEGIN
    SELECT
        COALESCE(SUM(debit), 0),
        COALESCE(SUM(credit), 0)
    INTO total_debit, total_credit
    FROM accounting.journal_lines
    WHERE journal_entry_id = NEW.journal_entry_id;

    IF total_debit != total_credit THEN
        RAISE EXCEPTION
            'UNBALANCED JOURNAL: entry_id=%, total_debit=%, total_credit=%',
            NEW.journal_entry_id, total_debit, total_credit;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_verify_journal_balance
    AFTER INSERT ON accounting.journal_lines
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION accounting.verify_journal_balance();
