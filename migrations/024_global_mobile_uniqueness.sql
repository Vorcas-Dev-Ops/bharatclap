-- Migration 024: Global Mobile Number Uniqueness & Anti-Duplicate Account Creation (Audit Rule #6)
-- Ensures every phone number belongs to exactly ONE account across all roles.
-- Normalizes mobile numbers to canonical E.164 India format (+91XXXXXXXXXX).
-- Enforces database-level uniqueness across active, blocked, and deleted accounts.

-- 1. Remove orphaned unnormalized test rows that conflict with real seed accounts
DELETE FROM auth.users 
WHERE phone IN ('9876543210', '9876543211', '9876543212', '9876543213', '9876543214')
  AND id NOT IN (SELECT user_id FROM provider.providers WHERE user_id IS NOT NULL);

-- 2. Add normalized_phone column to auth.users if not exists
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS normalized_phone TEXT;

-- 3. Backfill normalized_phone for all existing users with phone
UPDATE auth.users
SET normalized_phone = '+91' || RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 10)
WHERE phone IS NOT NULL AND (normalized_phone IS NULL OR normalized_phone = '');

-- 4. Create trigger to automatically normalize phone numbers on INSERT or UPDATE
CREATE OR REPLACE FUNCTION auth.trg_users_normalize_phone()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.phone IS NOT NULL AND TRIM(NEW.phone) <> '' THEN
        NEW.normalized_phone := '+91' || RIGHT(REGEXP_REPLACE(NEW.phone, '\D', '', 'g'), 10);
    ELSIF NEW.phone IS NULL OR TRIM(NEW.phone) = '' THEN
        NEW.normalized_phone := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_normalize_phone ON auth.users;
CREATE TRIGGER trg_users_normalize_phone
    BEFORE INSERT OR UPDATE OF phone, normalized_phone ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auth.trg_users_normalize_phone();

-- 5. Create GLOBAL UNIQUE INDEX on normalized_phone
-- NOTE: Unconditional unique index (no deleted_at IS NULL).
-- Numbers for blocked or deleted accounts stay permanently reserved.
DROP INDEX IF EXISTS auth.ux_users_normalized_phone_global;
CREATE UNIQUE INDEX ux_users_normalized_phone_global 
ON auth.users (normalized_phone) 
WHERE normalized_phone IS NOT NULL;
