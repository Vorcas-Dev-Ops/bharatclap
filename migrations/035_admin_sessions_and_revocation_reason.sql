-- 035_admin_sessions_and_revocation_reason.sql
-- 1. Creates auth.admins and auth.admin_permissions tables for dedicated admin identity.
-- 2. Migrates existing admin users into auth.admins.
-- 3. Adds revoked_reason column to auth.refresh_tokens for session limit eviction.
-- 4. Adds admin_id foreign key column to auth.refresh_tokens for separate admin session tracking.
-- 5. Makes user_id nullable and enforces chk_refresh_tokens_owner constraint (exactly one owner).
-- 6. Repoints auth.admin_activity_logs(admin_id) foreign key to auth.admins(id).
-- 7. Deletes migrated admin rows from auth.users.

BEGIN;

-- 1. Create auth.admins
CREATE TABLE IF NOT EXISTS auth.admins (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    phone               TEXT,
    password_hash       TEXT NOT NULL,
    totp_secret         TEXT,
    two_factor_recovery TEXT[] DEFAULT '{}',
    failed_otp_attempts INT DEFAULT 0,
    otp_locked_until    TIMESTAMPTZ,
    last_login          TIMESTAMPTZ,
    admin_role          TEXT NOT NULL DEFAULT 'super_admin' 
                        CHECK (admin_role IN ('super_admin', 'operations_admin', 'support_admin', 'finance_admin')),
    status              TEXT NOT NULL DEFAULT 'active' 
                        CHECK (status IN ('active', 'blocked')),
    token_version       INTEGER NOT NULL DEFAULT 0,
    created_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

ALTER TABLE auth.admins
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS two_factor_recovery TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS failed_otp_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Exactly one active super_admin index
CREATE UNIQUE INDEX IF NOT EXISTS ux_admins_one_super_admin 
ON auth.admins (admin_role) 
WHERE admin_role = 'super_admin' AND deleted_at IS NULL;

-- Create auth.admin_permissions
CREATE TABLE IF NOT EXISTS auth.admin_permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id    UUID NOT NULL REFERENCES auth.admins(id) ON DELETE CASCADE,
    permission  TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_admin_permissions_admin_id ON auth.admin_permissions(admin_id);

-- 2. Migrate existing admin users from auth.users into auth.admins
INSERT INTO auth.admins (
  id, email, name, phone, password_hash, totp_secret, admin_role, status, token_version,
  two_factor_recovery, failed_otp_attempts, otp_locked_until, last_login, created_at, updated_at
)
SELECT u.id, u.email, u.name, u.phone, u.password_hash, u.two_factor_secret, 
       COALESCE(u.admin_role::text, 'super_admin'),
       u.status, COALESCE(u.token_version, 0),
       COALESCE(u.two_factor_recovery, '{}'),
       COALESCE(u.failed_otp_attempts, 0),
       u.otp_locked_until, u.last_login,
       u.created_at, u.updated_at
FROM auth.users u
WHERE (u.role = 'admin' OR u.role = 'super_admin' OR u.admin_role IS NOT NULL)
ON CONFLICT (id) DO UPDATE SET
  totp_secret = COALESCE(auth.admins.totp_secret, EXCLUDED.totp_secret),
  password_hash = EXCLUDED.password_hash,
  phone = COALESCE(auth.admins.phone, EXCLUDED.phone),
  two_factor_recovery = COALESCE(auth.admins.two_factor_recovery, EXCLUDED.two_factor_recovery),
  updated_at = NOW();

-- 3. Add revoked_reason column to auth.refresh_tokens
ALTER TABLE auth.refresh_tokens
  ADD COLUMN IF NOT EXISTS revoked_reason TEXT;

-- 4. Add admin_id foreign key column to auth.refresh_tokens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'auth' AND table_name = 'refresh_tokens' AND column_name = 'admin_id'
  ) THEN
    ALTER TABLE auth.refresh_tokens
      ADD COLUMN admin_id UUID REFERENCES auth.admins(id) ON DELETE CASCADE;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema = 'auth' AND table_name = 'refresh_tokens' AND constraint_name = 'refresh_tokens_admin_id_fkey'
    ) THEN
      ALTER TABLE auth.refresh_tokens
        ADD CONSTRAINT refresh_tokens_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.admins(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 5. Repoint existing admin refresh tokens from user_id to admin_id
UPDATE auth.refresh_tokens
SET admin_id = user_id, user_id = NULL
WHERE user_id IN (SELECT id FROM auth.admins);

-- 6. Enforce exactly one owner on auth.refresh_tokens
ALTER TABLE auth.refresh_tokens
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE auth.refresh_tokens
  DROP CONSTRAINT IF EXISTS chk_refresh_tokens_owner;

ALTER TABLE auth.refresh_tokens
  ADD CONSTRAINT chk_refresh_tokens_owner CHECK (
    (user_id IS NOT NULL AND admin_id IS NULL) OR
    (user_id IS NULL AND admin_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS ix_token_admin ON auth.refresh_tokens(admin_id, revoked)
  WHERE admin_id IS NOT NULL;

-- 7. Repoint auth.admin_activity_logs(admin_id) to auth.admins(id)
ALTER TABLE auth.admin_activity_logs
  DROP CONSTRAINT IF EXISTS fk_audit_admin;

ALTER TABLE auth.admin_activity_logs
  ADD CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES auth.admins(id) ON DELETE SET NULL;

-- 8. Delete admin rows from auth.users (complete migration cutover)
DELETE FROM auth.users
WHERE (role = 'admin' OR role = 'super_admin' OR admin_role IS NOT NULL);

COMMIT;
