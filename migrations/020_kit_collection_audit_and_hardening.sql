-- ==============================================================================
-- Migration 020: Kit Collection Audit, Hub Snapshot & Schema Hardening
-- ==============================================================================

-- 1. Snapshot column on provider.providers so assigned hub address is immutable per payment
ALTER TABLE provider.providers
  ADD COLUMN IF NOT EXISTS kit_collection_hub_snapshot JSONB;

-- 2. Audit log table for kit collections
CREATE TABLE IF NOT EXISTS provider.kit_collection_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL,
    collection_id VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL DEFAULT 'COLLECTED',
    admin_id UUID,
    admin_name VARCHAR(150),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kit_collection_audit_provider 
  ON provider.kit_collection_audit_logs(provider_id);

CREATE INDEX IF NOT EXISTS idx_kit_collection_audit_collection_id 
  ON provider.kit_collection_audit_logs(collection_id);

-- 3. Hardened unique index on non-null collection IDs
DROP INDEX IF EXISTS idx_providers_kit_collection_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_providers_kit_collection_id 
  ON provider.providers(kit_collection_id) 
  WHERE kit_collection_id IS NOT NULL;
