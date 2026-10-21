-- ==============================================================================
-- Migration 018: Provider Kit Collection Flow
-- Adds Kit Collection Tracking (Collection ID, Status, Timestamps, Confirmed By)
-- and Kit Collection Center Settings (Address, Contact Person, Instructions)
-- ==============================================================================

-- 1. Add Kit Collection fields to provider.providers
ALTER TABLE provider.providers
  ADD COLUMN IF NOT EXISTS kit_collection_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS kit_collection_status VARCHAR(30) DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN IF NOT EXISTS kit_collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kit_collected_by UUID,
  ADD COLUMN IF NOT EXISTS kit_collected_by_name VARCHAR(150);

-- Unique constraint on kit_collection_id when not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_providers_kit_collection_id 
  ON provider.providers(kit_collection_id) 
  WHERE kit_collection_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_providers_kit_collection_status 
  ON provider.providers(kit_collection_status);

-- 2. Create Kit Collection Hub / Settings Table
CREATE TABLE IF NOT EXISTS provider.kit_collection_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_name VARCHAR(255) NOT NULL DEFAULT 'BharatClap Bengaluru Central Hub',
  collection_address TEXT NOT NULL DEFAULT 'BharatClap Regional Center, 4th Floor, 80 Feet Road, Koramangala 4th Block, Bengaluru, Karnataka 560034',
  contact_person VARCHAR(100) NOT NULL DEFAULT 'Kit Distribution & Ops Team',
  contact_number VARCHAR(50) NOT NULL DEFAULT '+91 98765 43210',
  collection_instructions TEXT NOT NULL DEFAULT 'Please carry your original Aadhaar card / Government ID and present your Unique Collection ID at the reception counter. Kit verification and handover takes approximately 5-10 minutes.',
  operating_hours VARCHAR(100) DEFAULT 'Mon - Sat: 10:00 AM - 6:00 PM',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID
);

-- Seed default collection hub settings if table is empty
INSERT INTO provider.kit_collection_settings (
  location_name,
  collection_address,
  contact_person,
  contact_number,
  collection_instructions,
  operating_hours
)
SELECT
  'BharatClap Bengaluru Central Hub',
  'BharatClap Regional Center, 4th Floor, 80 Feet Road, Koramangala 4th Block, Bengaluru, Karnataka 560034',
  'Kit Distribution & Ops Team',
  '+91 98765 43210',
  'Please carry your original Aadhaar card / Government ID and present your Unique Collection ID at the reception counter. Kit verification and handover takes approximately 5-10 minutes.',
  'Mon - Sat: 10:00 AM - 6:00 PM'
WHERE NOT EXISTS (SELECT 1 FROM provider.kit_collection_settings);

-- 3. Synchronize existing providers
-- Providers with PAID kit and ACTIVE access are marked as COLLECTED with a generated kit_collection_id
UPDATE provider.providers
SET 
  kit_collection_id = COALESCE(kit_collection_id, 'BC-KIT-' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 6))),
  kit_collection_status = 'COLLECTED',
  kit_collected_at = COALESCE(kit_collected_at, updated_at, NOW()),
  kit_collected_by_name = COALESCE(kit_collected_by_name, 'Admin System Auto-Migration')
WHERE kit_payment_status = 'PAID' 
  AND access_status = 'ACTIVE' 
  AND (kit_collection_status IS NULL OR kit_collection_status = 'NOT_APPLICABLE');

-- Providers with PAID kit but pending access are marked as PENDING collection
UPDATE provider.providers
SET 
  kit_collection_id = COALESCE(kit_collection_id, 'BC-KIT-' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 6))),
  kit_collection_status = 'PENDING'
WHERE kit_payment_status = 'PAID' 
  AND (access_status IS NULL OR access_status != 'ACTIVE')
  AND (kit_collection_status IS NULL OR kit_collection_status = 'NOT_APPLICABLE');
