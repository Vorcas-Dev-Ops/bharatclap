-- 009_immutability_triggers.sql
-- BharatClap PostgreSQL Migration — Immutability enforcement
-- Tables that represent financial history, audit logs, or ledger entries
-- must never be modified or deleted.

-- ── Generic immutability function ──────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'IMMUTABLE RECORD: % rows cannot be modified or deleted. table=%',
        TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════════
-- AUTH
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_immutable_admin_logs
    BEFORE UPDATE OR DELETE ON auth.admin_activity_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_immutable_phone_history
    BEFORE UPDATE OR DELETE ON auth.phone_change_history
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

-- ══════════════════════════════════════════════════════════════════════
-- CATALOG
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_immutable_timeslot_audit
    BEFORE UPDATE OR DELETE ON catalog.time_slot_pricing_audits
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

-- ══════════════════════════════════════════════════════════════════════
-- BOOKING
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_immutable_fin_snapshot
    BEFORE UPDATE OR DELETE ON booking.booking_financial_snapshots
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_immutable_admin_note
    BEFORE UPDATE OR DELETE ON booking.booking_admin_notes
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_immutable_pc_audit
    BEFORE UPDATE OR DELETE ON booking.payment_collection_audits
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

-- ══════════════════════════════════════════════════════════════════════
-- PROVIDER
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_immutable_wallet_tx
    BEFORE UPDATE OR DELETE ON provider.wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_immutable_wallet_audit
    BEFORE UPDATE OR DELETE ON provider.wallet_audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_immutable_wallet_recon
    BEFORE UPDATE OR DELETE ON provider.wallet_reconciliation_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_immutable_settlement_adj
    BEFORE UPDATE OR DELETE ON provider.settlement_adjustments
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_immutable_location_audit
    BEFORE UPDATE OR DELETE ON provider.location_audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_immutable_subscription_audit
    BEFORE UPDATE OR DELETE ON provider.subscription_audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_immutable_category_snapshot
    BEFORE UPDATE OR DELETE ON provider.category_snapshots
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

-- ══════════════════════════════════════════════════════════════════════
-- PAYMENT
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_immutable_webhook
    BEFORE UPDATE OR DELETE ON payment.webhook_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_immutable_invoice
    BEFORE UPDATE OR DELETE ON payment.invoices
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_immutable_fin_audit
    BEFORE UPDATE OR DELETE ON payment.financial_audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_immutable_fin_adj
    BEFORE UPDATE OR DELETE ON payment.financial_adjustments
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_immutable_cust_wallet_tx
    BEFORE UPDATE OR DELETE ON payment.customer_wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

-- ══════════════════════════════════════════════════════════════════════
-- ACCOUNTING
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_immutable_journal_entry
    BEFORE UPDATE OR DELETE ON accounting.journal_entries
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_immutable_journal_line
    BEFORE UPDATE OR DELETE ON accounting.journal_lines
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();
