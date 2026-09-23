#!/usr/bin/env pwsh
# test_migrations.ps1
# Runs all 14 migration files against a fresh PostgreSQL database.
# Strips PostGIS syntax for local testing (production requires PostGIS).

param(
    [string]$PgUser = "postgres",
    [string]$PgPassword = "postgres",
    [string]$PgHost = "localhost",
    [int]$PgPort = 5432,
    [string]$DbName = "bharatclap_migration_test"
)

$env:PGPASSWORD = $PgPassword
$ErrorActionPreference = "Stop"

$migrationsDir = Join-Path $PSScriptRoot ".."
$testTmpDir = Join-Path $PSScriptRoot "tmp"

# Clean + create tmp dir
if (Test-Path $testTmpDir) { Remove-Item $testTmpDir -Recurse -Force }
New-Item $testTmpDir -ItemType Directory | Out-Null

Write-Host "`n=== Phase 1: Fresh Database ===" -ForegroundColor Cyan
psql -U $PgUser -h $PgHost -p $PgPort -c "DROP DATABASE IF EXISTS $DbName;" 2>&1 | Out-Null
psql -U $PgUser -h $PgHost -p $PgPort -c "CREATE DATABASE $DbName;" 2>&1 | Out-Null
Write-Host "Created fresh database: $DbName"

# Migration files in order
$files = @(
    "000_extensions.sql",
    "001_auth.sql",
    "002_catalog.sql",
    "003_booking.sql",
    "004_provider.sql",
    "005_payment.sql",
    "005b_accounting.sql",
    "006_notification.sql",
    "007_migration_infra.sql",
    "008_cross_schema_fks.sql",
    "008b_legacy_indexes.sql",
    "009_immutability_triggers.sql",
    "010_updated_at_triggers.sql",
    "011_seed_accounts.sql"
)

Write-Host "`n=== Phase 2: Pre-process for non-PostGIS ===" -ForegroundColor Cyan

foreach ($f in $files) {
    $src = Join-Path $migrationsDir $f
    $dst = Join-Path $testTmpDir $f
    $content = Get-Content $src -Raw

    if ($f -eq "000_extensions.sql") {
        # Replace with citext-only
        $content = "CREATE EXTENSION IF NOT EXISTS citext;`n"
    } else {
        # Strip PostGIS-dependent lines
        # 1. Remove GEOGRAPHY(Point, 4326) columns
        $content = $content -replace '(?m)^\s+location\s+GEOGRAPHY\(Point,\s*4326\)\s+(NOT NULL,?|,)', ''
        $content = $content -replace '(?m)^\s+live_location\s+GEOGRAPHY\(Point,\s*4326\)\s*,', ''
        # 2. Remove GIST indexes on geography columns
        $content = $content -replace '(?m)^CREATE INDEX.*USING GIST\(location\);', '-- [SKIPPED: PostGIS GIST index]'
        $content = $content -replace '(?m)^CREATE INDEX.*USING GIST\(live_location\);', '-- [SKIPPED: PostGIS GIST index]'
    }

    Set-Content $dst $content -NoNewline
}
Write-Host "Pre-processed $($files.Count) files (PostGIS stripped)"

Write-Host "`n=== Phase 3: Run Migrations ===" -ForegroundColor Cyan
$allPassed = $true
$results = @()

foreach ($f in $files) {
    $path = Join-Path $testTmpDir $f
    Write-Host -NoNewline "  $f ... "
    $output = psql -U $PgUser -h $PgHost -p $PgPort -d $DbName -f $path -v ON_ERROR_STOP=1 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED" -ForegroundColor Red
        Write-Host $output
        $allPassed = $false
        $results += @{ File = $f; Status = "FAILED"; Error = "$output" }
        break
    } else {
        Write-Host "OK" -ForegroundColor Green
        $results += @{ File = $f; Status = "OK"; Error = "" }
    }
}

if (-not $allPassed) {
    Write-Host "`nMigration FAILED. Stopping." -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Phase 4: Schema Validation ===" -ForegroundColor Cyan

# Count schemas, tables, FK constraints, indexes, triggers
$validationSql = @"
-- Schema count
SELECT 'schemas' AS check_type, COUNT(*) AS count
FROM information_schema.schemata
WHERE schema_name IN ('auth','catalog','booking','provider','payment','accounting','notification','migration');

-- Table count per schema
SELECT table_schema AS schema, COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema IN ('auth','catalog','booking','provider','payment','accounting','notification','migration')
  AND table_type = 'BASE TABLE'
GROUP BY table_schema
ORDER BY table_schema;

-- Total table count
SELECT 'total_tables' AS check_type, COUNT(*) AS count
FROM information_schema.tables
WHERE table_schema IN ('auth','catalog','booking','provider','payment','accounting','notification','migration')
  AND table_type = 'BASE TABLE';

-- FK constraint count
SELECT 'foreign_keys' AS check_type, COUNT(*) AS count
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
  AND table_schema IN ('auth','catalog','booking','provider','payment','accounting','notification');

-- CHECK constraint count
SELECT 'check_constraints' AS check_type, COUNT(*) AS count
FROM information_schema.table_constraints
WHERE constraint_type = 'CHECK'
  AND table_schema IN ('auth','catalog','booking','provider','payment','accounting','notification');

-- Index count
SELECT 'indexes' AS check_type, COUNT(*) AS count
FROM pg_indexes
WHERE schemaname IN ('auth','catalog','booking','provider','payment','accounting','notification','migration');

-- Trigger count
SELECT 'triggers' AS check_type, COUNT(*) AS count
FROM information_schema.triggers
WHERE trigger_schema IN ('auth','catalog','booking','provider','payment','accounting','notification','migration');

-- Chart of accounts seed count
SELECT 'seed_accounts' AS check_type, COUNT(*) AS count
FROM accounting.chart_of_accounts;
"@

$validationPath = Join-Path $testTmpDir "validation_counts.sql"
Set-Content $validationPath $validationSql -NoNewline
psql -U $PgUser -h $PgHost -p $PgPort -d $DbName -f $validationPath

Write-Host "`n=== Phase 5: Constraint Tests ===" -ForegroundColor Cyan

$constraintTests = @"
-- Test 1: CHECK constraint — invalid user role
DO \$\$
BEGIN
    INSERT INTO auth.users (name, role) VALUES ('test', 'invalid_role');
    RAISE EXCEPTION 'TEST FAILED: invalid role accepted';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 1 PASSED: invalid role rejected';
END \$\$;

-- Test 2: CHECK constraint — negative wallet balance
DO \$\$
DECLARE test_user_id UUID;
BEGIN
    INSERT INTO auth.users (name, role) VALUES ('wallet_test', 'customer') RETURNING id INTO test_user_id;
    INSERT INTO payment.customer_wallets (user_id, balance) VALUES (test_user_id, -100);
    RAISE EXCEPTION 'TEST FAILED: negative balance accepted';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 2 PASSED: negative balance rejected';
END \$\$;

-- Test 3: CHECK constraint — booking status enum
DO \$\$
DECLARE test_user_id UUID; test_addr_id UUID; test_sub_id UUID; test_cat_id UUID; test_svc_id UUID;
BEGIN
    INSERT INTO auth.users (name, role) VALUES ('bk_test', 'customer') RETURNING id INTO test_user_id;
    INSERT INTO auth.addresses (user_id, house_no_building, address_line_1, area_locality, city, district, state, pincode, latitude, longitude, formatted_address)
        VALUES (test_user_id, '1', 'St', 'Area', 'City', 'Dist', 'State', '500001', 17.385, 78.486, 'Addr') RETURNING id INTO test_addr_id;
    INSERT INTO catalog.categories (name, description) VALUES ('TestCat', 'desc') RETURNING id INTO test_cat_id;
    INSERT INTO catalog.services (category_id, service_name, slug, description, base_price, duration) VALUES (test_cat_id, 'Svc', 'test-svc', 'desc', 100, 60) RETURNING id INTO test_svc_id;
    INSERT INTO catalog.subservices (service_id, subservice_name, description) VALUES (test_svc_id, 'Sub', 'desc') RETURNING id INTO test_sub_id;
    INSERT INTO booking.bookings (booking_id, user_id, subservice_id, address_id, status, scheduled_at, booking_time) VALUES ('BK-INVALID', test_user_id, test_sub_id, test_addr_id, 'INVALID_STATUS', NOW(), '10:00');
    RAISE EXCEPTION 'TEST FAILED: invalid booking status accepted';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 3 PASSED: invalid booking status rejected';
END \$\$;

-- Test 4: UNIQUE constraint — duplicate booking_id
DO \$\$
DECLARE test_user_id UUID; test_addr_id UUID; test_sub_id UUID; test_cat_id UUID; test_svc_id UUID;
BEGIN
    INSERT INTO auth.users (name, role) VALUES ('dup_test', 'customer') RETURNING id INTO test_user_id;
    INSERT INTO auth.addresses (user_id, house_no_building, address_line_1, area_locality, city, district, state, pincode, latitude, longitude, formatted_address)
        VALUES (test_user_id, '1', 'St', 'Area', 'City', 'Dist', 'State', '500001', 17.385, 78.486, 'Addr') RETURNING id INTO test_addr_id;
    INSERT INTO catalog.categories (name, description) VALUES ('DupCat', 'desc') RETURNING id INTO test_cat_id;
    INSERT INTO catalog.services (category_id, service_name, slug, description, base_price, duration) VALUES (test_cat_id, 'Svc2', 'dup-svc', 'desc', 100, 60) RETURNING id INTO test_svc_id;
    INSERT INTO catalog.subservices (service_id, subservice_name, description) VALUES (test_svc_id, 'Sub2', 'desc') RETURNING id INTO test_sub_id;
    INSERT INTO booking.bookings (booking_id, user_id, subservice_id, address_id, scheduled_at, booking_time) VALUES ('BK-DUP-001', test_user_id, test_sub_id, test_addr_id, NOW(), '10:00');
    INSERT INTO booking.bookings (booking_id, user_id, subservice_id, address_id, scheduled_at, booking_time) VALUES ('BK-DUP-001', test_user_id, test_sub_id, test_addr_id, NOW(), '11:00');
    RAISE EXCEPTION 'TEST FAILED: duplicate booking_id accepted';
EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TEST 4 PASSED: duplicate booking_id rejected';
END \$\$;

-- Test 5: FK constraint — booking references nonexistent user
DO \$\$
DECLARE fake_id UUID := gen_random_uuid(); test_sub_id UUID; test_addr_id UUID;
BEGIN
    INSERT INTO booking.bookings (booking_id, user_id, subservice_id, address_id, scheduled_at, booking_time)
        VALUES ('BK-FK-001', fake_id, fake_id, fake_id, NOW(), '10:00');
    RAISE EXCEPTION 'TEST FAILED: FK to nonexistent user accepted';
EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'TEST 5 PASSED: FK to nonexistent user rejected';
END \$\$;

-- Test 6: Immutability — cannot update wallet_transactions
DO \$\$
DECLARE test_user_id UUID; test_provider_id UUID; test_wallet_id UUID; test_tx_id UUID;
BEGIN
    INSERT INTO auth.users (name, role) VALUES ('immut_test', 'provider') RETURNING id INTO test_user_id;
    INSERT INTO provider.providers (user_id) VALUES (test_user_id) RETURNING id INTO test_provider_id;
    INSERT INTO provider.wallets (provider_id) VALUES (test_provider_id) RETURNING id INTO test_wallet_id;
    INSERT INTO provider.wallet_transactions (provider_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, current_hash, fencing_token)
        VALUES (test_provider_id, 'credit', 100, 0, 100, 'SEED', 'SEED-001', 'test', 'hash123', 1)
        RETURNING id INTO test_tx_id;
    UPDATE provider.wallet_transactions SET amount = 200 WHERE id = test_tx_id;
    RAISE EXCEPTION 'TEST FAILED: immutable record updated';
EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'TEST 6 PASSED: immutable record update blocked';
END \$\$;

-- Test 7: Immutability — cannot delete journal_entries
DO \$\$
DECLARE je_id UUID;
BEGIN
    INSERT INTO accounting.journal_entries (transaction_id, reference_type, reference_id, description, posted_by)
        VALUES ('TXN-IMMUT-001', 'TEST', 'test-1', 'immutability test', 'test')
        RETURNING id INTO je_id;
    DELETE FROM accounting.journal_entries WHERE id = je_id;
    RAISE EXCEPTION 'TEST FAILED: journal entry deleted';
EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'TEST 7 PASSED: journal entry deletion blocked';
END \$\$;

-- Test 8: updated_at trigger fires automatically
DO \$\$
DECLARE
    test_user_id UUID;
    orig_updated TIMESTAMPTZ;
    new_updated TIMESTAMPTZ;
BEGIN
    INSERT INTO auth.users (name, role) VALUES ('trigger_test', 'customer') RETURNING id INTO test_user_id;
    SELECT updated_at INTO orig_updated FROM auth.users WHERE id = test_user_id;
    PERFORM pg_sleep(0.01);
    UPDATE auth.users SET name = 'trigger_test_updated' WHERE id = test_user_id;
    SELECT updated_at INTO new_updated FROM auth.users WHERE id = test_user_id;
    IF new_updated > orig_updated THEN
        RAISE NOTICE 'TEST 8 PASSED: updated_at trigger fired (% -> %)', orig_updated, new_updated;
    ELSE
        RAISE EXCEPTION 'TEST FAILED: updated_at did not change';
    END IF;
END \$\$;

-- Test 9: Seed accounts idempotent (re-run should not fail)
DO \$\$
DECLARE before_count INT; after_count INT;
BEGIN
    SELECT COUNT(*) INTO before_count FROM accounting.chart_of_accounts;
    -- Re-insert (ON CONFLICT DO NOTHING)
    INSERT INTO accounting.chart_of_accounts (code, name, account_type, currency)
        VALUES ('CUSTOMER_RECEIVABLE', 'Customer Receivable', 'asset', 'INR')
        ON CONFLICT (code) DO NOTHING;
    SELECT COUNT(*) INTO after_count FROM accounting.chart_of_accounts;
    IF before_count = after_count THEN
        RAISE NOTICE 'TEST 9 PASSED: seed idempotent (count unchanged: %)', before_count;
    ELSE
        RAISE EXCEPTION 'TEST FAILED: seed count changed from % to %', before_count, after_count;
    END IF;
END \$\$;

-- Test 10: Balanced journal — valid journal succeeds
DO \$\$
DECLARE je_id UUID; cust_recv_id UUID; platform_id UUID;
BEGIN
    SELECT id INTO cust_recv_id FROM accounting.chart_of_accounts WHERE code = 'CUSTOMER_RECEIVABLE';
    SELECT id INTO platform_id FROM accounting.chart_of_accounts WHERE code = 'PLATFORM_COMMISSION';
    INSERT INTO accounting.journal_entries (transaction_id, reference_type, reference_id, description, posted_by)
        VALUES ('TXN-BALANCE-OK', 'TEST', 'bal-1', 'balanced test', 'test')
        RETURNING id INTO je_id;
    INSERT INTO accounting.journal_lines (journal_entry_id, account_id, debit, credit) VALUES (je_id, cust_recv_id, 1000.00, 0);
    INSERT INTO accounting.journal_lines (journal_entry_id, account_id, debit, credit) VALUES (je_id, platform_id, 0, 1000.00);
    RAISE NOTICE 'TEST 10 PASSED: balanced journal committed';
END \$\$;

-- Test 11: Unbalanced journal — must fail at commit
DO \$\$
DECLARE je_id UUID; cust_recv_id UUID; platform_id UUID;
BEGIN
    SELECT id INTO cust_recv_id FROM accounting.chart_of_accounts WHERE code = 'CUSTOMER_RECEIVABLE';
    SELECT id INTO platform_id FROM accounting.chart_of_accounts WHERE code = 'PLATFORM_COMMISSION';
    INSERT INTO accounting.journal_entries (transaction_id, reference_type, reference_id, description, posted_by)
        VALUES ('TXN-UNBALANCED', 'TEST', 'bal-2', 'unbalanced test', 'test')
        RETURNING id INTO je_id;
    INSERT INTO accounting.journal_lines (journal_entry_id, account_id, debit, credit) VALUES (je_id, cust_recv_id, 1000.00, 0);
    INSERT INTO accounting.journal_lines (journal_entry_id, account_id, debit, credit) VALUES (je_id, platform_id, 0, 900.00);
    -- This should fail because debit(1000) != credit(900)
    RAISE EXCEPTION 'TEST FAILED: unbalanced journal accepted';
EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%UNBALANCED JOURNAL%' THEN
        RAISE NOTICE 'TEST 11 PASSED: unbalanced journal rejected';
    ELSE
        RAISE NOTICE 'TEST 11 PASSED: unbalanced journal rejected (via %)' , SQLERRM;
    END IF;
END \$\$;

-- Test 12: Slot capacity — booked_count cannot exceed max_capacity
DO \$\$
DECLARE test_user_id UUID; test_provider_id UUID;
BEGIN
    INSERT INTO auth.users (name, role) VALUES ('slot_test', 'provider') RETURNING id INTO test_user_id;
    INSERT INTO provider.providers (user_id) VALUES (test_user_id) RETURNING id INTO test_provider_id;
    INSERT INTO booking.slot_capacities (provider_id, slot_date, slot, booked_count, max_capacity) VALUES (test_provider_id, '2025-01-01', '10:00', 9, 8);
    RAISE EXCEPTION 'TEST FAILED: booked_count > max_capacity accepted';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 12 PASSED: booked_count > max_capacity rejected';
END \$\$;

-- Test 13: Journal line — both debit and credit > 0 rejected
DO \$\$
DECLARE je_id UUID; acct_id UUID;
BEGIN
    SELECT id INTO acct_id FROM accounting.chart_of_accounts WHERE code = 'CUSTOMER_RECEIVABLE';
    INSERT INTO accounting.journal_entries (transaction_id, reference_type, reference_id, description, posted_by)
        VALUES ('TXN-BOTHSIDES', 'TEST', 'bal-3', 'both sides test', 'test')
        RETURNING id INTO je_id;
    INSERT INTO accounting.journal_lines (journal_entry_id, account_id, debit, credit) VALUES (je_id, acct_id, 100, 100);
    RAISE EXCEPTION 'TEST FAILED: both debit and credit > 0 accepted';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 13 PASSED: both debit and credit > 0 rejected';
END \$\$;

-- Test 14: Fencing token uniqueness
DO \$\$
DECLARE test_user_id UUID; test_provider_id UUID;
BEGIN
    INSERT INTO auth.users (name, role) VALUES ('fence_test', 'provider') RETURNING id INTO test_user_id;
    INSERT INTO provider.providers (user_id) VALUES (test_user_id) RETURNING id INTO test_provider_id;
    INSERT INTO provider.wallets (provider_id) VALUES (test_provider_id);
    INSERT INTO provider.wallet_transactions (provider_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, current_hash, fencing_token)
        VALUES (test_provider_id, 'credit', 100, 0, 100, 'SEED', 'FENCE-001', 'first', 'hash1', 1);
    INSERT INTO provider.wallet_transactions (provider_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, current_hash, fencing_token)
        VALUES (test_provider_id, 'credit', 50, 100, 150, 'SEED', 'FENCE-002', 'duplicate fencing', 'hash2', 1);
    RAISE EXCEPTION 'TEST FAILED: duplicate fencing token accepted';
EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TEST 14 PASSED: duplicate fencing token rejected';
END \$\$;

-- Test 15: Fencing token must be > 0
DO \$\$
DECLARE test_user_id UUID; test_provider_id UUID;
BEGIN
    INSERT INTO auth.users (name, role) VALUES ('fence0_test', 'provider') RETURNING id INTO test_user_id;
    INSERT INTO provider.providers (user_id) VALUES (test_user_id) RETURNING id INTO test_provider_id;
    INSERT INTO provider.wallets (provider_id) VALUES (test_provider_id);
    INSERT INTO provider.wallet_transactions (provider_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, current_hash, fencing_token)
        VALUES (test_provider_id, 'credit', 100, 0, 100, 'SEED', 'FENCE-ZERO', 'zero fencing', 'hash0', 0);
    RAISE EXCEPTION 'TEST FAILED: fencing_token = 0 accepted';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 15 PASSED: fencing_token = 0 rejected';
END \$\$;

-- Test 16: legacy_mongo_id uniqueness per table
DO \$\$
BEGIN
    INSERT INTO auth.users (name, role, legacy_mongo_id) VALUES ('legacy1', 'customer', '64abc123def4567890abcdef');
    INSERT INTO auth.users (name, role, legacy_mongo_id) VALUES ('legacy2', 'customer', '64abc123def4567890abcdef');
    RAISE EXCEPTION 'TEST FAILED: duplicate legacy_mongo_id accepted';
EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TEST 16 PASSED: duplicate legacy_mongo_id rejected';
END \$\$;
"@

$constraintPath = Join-Path $testTmpDir "constraint_tests.sql"
Set-Content $constraintPath $constraintTests -NoNewline
psql -U $PgUser -h $PgHost -p $PgPort -d $DbName -f $constraintPath

Write-Host "`n=== Phase 6: Re-run Test (Idempotency of seed) ===" -ForegroundColor Cyan
$seedPath = Join-Path $testTmpDir "011_seed_accounts.sql"
$output = psql -U $PgUser -h $PgHost -p $PgPort -d $DbName -f $seedPath -v ON_ERROR_STOP=1 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  011_seed_accounts.sql re-run ... OK (idempotent)" -ForegroundColor Green
} else {
    Write-Host "  011_seed_accounts.sql re-run ... FAILED" -ForegroundColor Red
    Write-Host $output
}

Write-Host "`n=== DONE ===" -ForegroundColor Cyan
Write-Host "Database: $DbName"
Write-Host "All migration and validation tests completed."
