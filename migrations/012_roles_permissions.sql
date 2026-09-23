-- 012_roles_permissions.sql
-- BharatClap PostgreSQL Migration — Runtime roles & schema ownership
-- Run by: superuser / bharatclap_admin
-- Production: inject passwords via environment, not this file.

-- ══════════════════════════════════════════════════════════════════════
-- ADMIN ROLE (owns everything, runs migrations)
-- ══════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bharatclap_admin') THEN
        CREATE ROLE bharatclap_admin LOGIN PASSWORD 'CHANGE_ME_ADMIN';
    END IF;
END $$;

GRANT ALL ON DATABASE bharatclap_migration_test TO bharatclap_admin;

-- ══════════════════════════════════════════════════════════════════════
-- MIGRATOR ROLE (runs data migration scripts, stronger than service roles)
-- ══════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bharatclap_migrator') THEN
        CREATE ROLE bharatclap_migrator LOGIN PASSWORD 'CHANGE_ME_MIGRATOR';
    END IF;
END $$;

-- Migrator needs read/write on ALL schemas for cross-schema data migration
GRANT USAGE ON SCHEMA auth, catalog, booking, provider, payment, accounting, notification, migration TO bharatclap_migrator;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA auth, catalog, booking, provider, payment, accounting, notification, migration TO bharatclap_migrator;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth, catalog, booking, provider, payment, accounting, notification, migration TO bharatclap_migrator;
-- Migrator does NOT get CREATE, ALTER, DROP

-- ══════════════════════════════════════════════════════════════════════
-- SERVICE ROLES (runtime, least privilege)
-- ══════════════════════════════════════════════════════════════════════

-- Create all service roles
DO $$
DECLARE
    roles TEXT[] := ARRAY[
        'bharatclap_auth',
        'bharatclap_catalog',
        'bharatclap_booking',
        'bharatclap_provider',
        'bharatclap_payment',
        'bharatclap_notification'
    ];
    r TEXT;
BEGIN
    FOREACH r IN ARRAY roles LOOP
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', r, 'CHANGE_ME_' || upper(replace(r, 'bharatclap_', '')));
        END IF;
    END LOOP;
END $$;

-- ── auth-service ───────────────────────────────────────────────────
-- Owns: auth.*
GRANT USAGE ON SCHEMA auth TO bharatclap_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO bharatclap_auth;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO bharatclap_auth;
-- Future tables in auth
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bharatclap_auth;

-- ── catalog-service ────────────────────────────────────────────────
-- Owns: catalog.*
GRANT USAGE ON SCHEMA catalog TO bharatclap_catalog;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA catalog TO bharatclap_catalog;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA catalog TO bharatclap_catalog;
ALTER DEFAULT PRIVILEGES IN SCHEMA catalog GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bharatclap_catalog;

-- ── booking-service ────────────────────────────────────────────────
-- Owns: booking.*
-- Cross-schema SELECT: auth.users, auth.addresses, catalog.subservices
GRANT USAGE ON SCHEMA booking TO bharatclap_booking;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA booking TO bharatclap_booking;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA booking TO bharatclap_booking;
ALTER DEFAULT PRIVILEGES IN SCHEMA booking GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bharatclap_booking;

GRANT USAGE ON SCHEMA auth TO bharatclap_booking;
GRANT SELECT ON auth.users TO bharatclap_booking;
GRANT SELECT ON auth.addresses TO bharatclap_booking;
GRANT USAGE ON SCHEMA catalog TO bharatclap_booking;
GRANT SELECT ON catalog.subservices TO bharatclap_booking;
GRANT SELECT ON catalog.services TO bharatclap_booking;
GRANT SELECT ON catalog.categories TO bharatclap_booking;

-- ── provider-service ───────────────────────────────────────────────
-- Owns: provider.*
-- Cross-schema SELECT: auth.users, booking.bookings
-- Cross-schema INSERT: accounting.journal_entries, accounting.journal_lines (wallet journals)
GRANT USAGE ON SCHEMA provider TO bharatclap_provider;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA provider TO bharatclap_provider;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA provider TO bharatclap_provider;
ALTER DEFAULT PRIVILEGES IN SCHEMA provider GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bharatclap_provider;

GRANT USAGE ON SCHEMA auth TO bharatclap_provider;
GRANT SELECT ON auth.users TO bharatclap_provider;
GRANT USAGE ON SCHEMA booking TO bharatclap_provider;
GRANT SELECT ON booking.bookings TO bharatclap_provider;
GRANT USAGE ON SCHEMA accounting TO bharatclap_provider;
GRANT SELECT ON accounting.chart_of_accounts TO bharatclap_provider;
GRANT SELECT, INSERT ON accounting.journal_entries TO bharatclap_provider;
GRANT SELECT, INSERT ON accounting.journal_lines TO bharatclap_provider;

-- ── payment-service ────────────────────────────────────────────────
-- Owns: payment.*, accounting.*
-- Cross-schema SELECT: auth.users, booking.bookings
GRANT USAGE ON SCHEMA payment TO bharatclap_payment;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA payment TO bharatclap_payment;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA payment TO bharatclap_payment;
ALTER DEFAULT PRIVILEGES IN SCHEMA payment GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bharatclap_payment;

GRANT USAGE ON SCHEMA accounting TO bharatclap_payment;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA accounting TO bharatclap_payment;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA accounting TO bharatclap_payment;
ALTER DEFAULT PRIVILEGES IN SCHEMA accounting GRANT SELECT, INSERT ON TABLES TO bharatclap_payment;

GRANT USAGE ON SCHEMA auth TO bharatclap_payment;
GRANT SELECT ON auth.users TO bharatclap_payment;
GRANT USAGE ON SCHEMA booking TO bharatclap_payment;
GRANT SELECT ON booking.bookings TO bharatclap_payment;
GRANT USAGE ON SCHEMA provider TO bharatclap_payment;
GRANT SELECT ON provider.providers TO bharatclap_payment;
GRANT SELECT ON provider.provider_settlements TO bharatclap_payment;

-- ── notification-service ───────────────────────────────────────────
-- Owns: notification.*
-- Cross-schema SELECT: auth.users (name/phone for sending)
GRANT USAGE ON SCHEMA notification TO bharatclap_notification;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA notification TO bharatclap_notification;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA notification TO bharatclap_notification;
ALTER DEFAULT PRIVILEGES IN SCHEMA notification GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bharatclap_notification;

GRANT USAGE ON SCHEMA auth TO bharatclap_notification;
GRANT SELECT ON auth.users TO bharatclap_notification;

-- ══════════════════════════════════════════════════════════════════════
-- EXPLICITLY DENY dangerous privileges to service roles
-- ══════════════════════════════════════════════════════════════════════
-- Service roles cannot CREATE/ALTER/DROP in any schema.
-- They inherit only what is explicitly granted above.
-- ponytail: PG roles have no privileges by default — no explicit REVOKE needed
-- unless CREATE ON SCHEMA was previously granted. Being explicit for safety:

REVOKE CREATE ON SCHEMA auth FROM bharatclap_auth;
REVOKE CREATE ON SCHEMA catalog FROM bharatclap_catalog;
REVOKE CREATE ON SCHEMA booking FROM bharatclap_booking;
REVOKE CREATE ON SCHEMA provider FROM bharatclap_provider;
REVOKE CREATE ON SCHEMA payment FROM bharatclap_payment;
REVOKE CREATE ON SCHEMA accounting FROM bharatclap_payment;
REVOKE CREATE ON SCHEMA notification FROM bharatclap_notification;

-- ══════════════════════════════════════════════════════════════════════
-- ACCOUNTING: NO UPDATE/DELETE for anyone except admin
-- ══════════════════════════════════════════════════════════════════════
-- Immutability is enforced by triggers, but belt-and-suspenders:
REVOKE UPDATE, DELETE ON accounting.journal_entries FROM bharatclap_payment, bharatclap_provider;
REVOKE UPDATE, DELETE ON accounting.journal_lines FROM bharatclap_payment, bharatclap_provider;
REVOKE UPDATE, DELETE ON accounting.chart_of_accounts FROM bharatclap_payment, bharatclap_provider;
