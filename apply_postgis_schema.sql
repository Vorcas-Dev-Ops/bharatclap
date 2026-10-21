-- 1. Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Verify PostGIS Version
SELECT PostGIS_Version();

-- 3. Add location column if not exists
ALTER TABLE auth.addresses ADD COLUMN IF NOT EXISTS location GEOGRAPHY(Point, 4326);

-- 4. Backfill location for existing rows using their latitude & longitude
UPDATE auth.addresses 
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography 
WHERE location IS NULL AND longitude IS NOT NULL AND latitude IS NOT NULL;

-- 5. Enforce NOT NULL constraint matching the migration
ALTER TABLE auth.addresses ALTER COLUMN location SET NOT NULL;

-- 6. Ensure spatial GiST index exists
CREATE INDEX IF NOT EXISTS idx_addresses_location ON auth.addresses USING GIST (location);

-- 7. Verify schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'addresses' AND column_name = 'location';
