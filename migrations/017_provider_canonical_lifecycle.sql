-- Migration 017: Canonical Provider Lifecycle Flow
-- Enforces separate state machines for:
-- 1. onboarding_status (DRAFT, UNDER_REVIEW, ACTION_REQUIRED, REJECTED, APPROVED)
-- 2. kit_payment_status (PENDING, PAID)
-- 3. access_status (PENDING, ACTIVE, EXPIRED)
-- 4. access_type (NONE, FREE, SUBSCRIPTION)
-- 5. availability_status (available, paused, suspended, blocked)

ALTER TABLE provider.providers
  ADD COLUMN IF NOT EXISTS kit_payment_status VARCHAR(20) DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS kit_payment_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS kit_payment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_status VARCHAR(20) DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS access_type VARCHAR(20) DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS welcome_notification_sent BOOLEAN DEFAULT FALSE;

-- Backfill kit_payment_status strictly from successful starter_kit orders
UPDATE provider.providers p
SET kit_payment_status = 'PAID',
    kit_payment_id = o.id::text,
    kit_payment_date = o.updated_at
FROM provider.provider_orders o
WHERE o.provider_id = p.id
  AND o.order_type = 'starter_kit'
  AND o.status = 'paid';

-- Backfill access_status for approved providers who already have active access
UPDATE provider.providers
SET access_status = 'ACTIVE',
    access_type = CASE 
      WHEN access_mode = 'subscription' OR subscription_status = 'active' THEN 'SUBSCRIPTION'
      ELSE 'FREE'
    END
WHERE onboarding_status = 'APPROVED'
  AND kit_payment_status = 'PAID'
  AND (access_mode IS NOT NULL OR subscription_status = 'active' OR is_online = TRUE);

-- Ensure all other providers have correct defaults
UPDATE provider.providers
SET kit_payment_status = 'PENDING'
WHERE kit_payment_status IS NULL;

UPDATE provider.providers
SET access_status = 'PENDING',
    access_type = 'NONE'
WHERE access_status IS NULL;
