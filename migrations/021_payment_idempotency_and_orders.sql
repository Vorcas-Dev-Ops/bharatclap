-- Migration 021: Payment Idempotency & Order Hardening
ALTER TABLE provider.provider_orders
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255);

-- Ensure a single Razorpay payment cannot be captured more than once across orders
CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_orders_rzp_payment
  ON provider.provider_orders (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL AND status = 'paid';

-- Ensure idempotency key per provider prevents duplicate concurrent order generation
CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_orders_idempotency
  ON provider.provider_orders (provider_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Ensure a single kit payment ID cannot be mapped to multiple providers
CREATE UNIQUE INDEX IF NOT EXISTS uq_providers_kit_payment_id
  ON provider.providers (kit_payment_id)
  WHERE kit_payment_id IS NOT NULL;
