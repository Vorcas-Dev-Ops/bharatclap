-- Migration 014: Enrich provider.starter_kits schema and seed default kit
ALTER TABLE provider.starter_kits
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT 'Complete onboarding kit for service professionals',
  ADD COLUMN IF NOT EXISTS sizes JSONB DEFAULT '[{"size":"S","active":true,"stock":50},{"size":"M","active":true,"stock":100},{"size":"L","active":true,"stock":150},{"size":"XL","active":true,"stock":100},{"size":"XXL","active":true,"stock":50},{"size":"XXXL","active":true,"stock":25}]',
  ADD COLUMN IF NOT EXISTS gst NUMERIC(5,2) DEFAULT 18,
  ADD COLUMN IF NOT EXISTS delivery NUMERIC(12,2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS convenience NUMERIC(12,2) DEFAULT 20,
  ADD COLUMN IF NOT EXISTS estimated_days INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS shipping_partner TEXT DEFAULT 'Delhivery',
  ADD COLUMN IF NOT EXISTS enable_live_tracking BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_mandatory BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_registration_without_payment BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_activate_after_payment BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_admin_approval BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '{}';

-- Seed default starter kit if no active kit exists
INSERT INTO provider.starter_kits (
  name,
  description,
  items,
  sizes,
  price,
  gst,
  delivery,
  convenience,
  estimated_days,
  shipping_partner,
  enable_live_tracking,
  payment_mandatory,
  allow_registration_without_payment,
  auto_activate_after_payment,
  require_admin_approval,
  images,
  currency,
  status
)
SELECT
  'BharatClap Professional Starter Kit',
  'Complete onboarding kit for service professionals including branded uniform and official badge',
  '[{"name":"BharatClap Uniform T-Shirt","description":"High-quality branded polo uniform","stock":500,"key":"tshirt"},{"name":"Equipment & Tool Carry Bag","description":"Durable multi-compartment kit bag","stock":450,"key":"bag"},{"name":"Official Partner ID Card","description":"Verified provider credential badge","stock":1000,"key":"idcard"}]'::jsonb,
  '[{"size":"S","active":true,"stock":50},{"size":"M","active":true,"stock":100},{"size":"L","active":true,"stock":150},{"size":"XL","active":true,"stock":100},{"size":"XXL","active":true,"stock":50},{"size":"XXXL","active":true,"stock":25}]'::jsonb,
  639,
  18,
  50,
  20,
  3,
  'Delhivery',
  true,
  true,
  false,
  true,
  false,
  '{}'::jsonb,
  'INR',
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM provider.starter_kits WHERE status = 'active'
);
