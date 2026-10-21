-- Migration 016: Complete BharatClap Provider Lifecycle Flow
-- Adds explicit kit payment tracking and access plan columns

ALTER TABLE provider.providers 
  ADD COLUMN IF NOT EXISTS kit_payment_status VARCHAR(20) DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS kit_payment_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS kit_payment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS welcome_viewed BOOLEAN DEFAULT FALSE;

-- Backfill providers who have already paid for starter kit in provider_orders
UPDATE provider.providers p
SET kit_payment_status = 'PAID',
    kit_payment_id = o.id::text,
    kit_payment_date = o.updated_at
FROM provider.provider_orders o
WHERE o.provider_id = p.id 
  AND o.order_type = 'starter_kit' 
  AND o.status = 'paid';

-- Ensure demo provider has kit_payment_status = 'PAID'
UPDATE provider.providers
SET kit_payment_status = 'PAID',
    onboarding_status = 'APPROVED'
WHERE id = '50f68c4d-068d-48d8-a383-69450f533cd8';
