-- concurrency_tests.sql
-- Two-connection booking race, cancellation race, and financial ACID tests.
-- These tests MUST be run via the test runner (test_concurrency.ps1) because
-- they require multiple simultaneous database connections.
-- This file sets up the test fixtures.

-- ══════════════════════════════════════════════════════════════════════
-- SETUP: Test fixtures for concurrency testing
-- ══════════════════════════════════════════════════════════════════════

-- Clean previous test data
DELETE FROM booking.slot_capacities WHERE slot_date = '2099-12-31';
DELETE FROM booking.bookings WHERE booking_id LIKE 'RACE-%';
DELETE FROM payment.customer_wallet_transactions WHERE reference_id LIKE 'RACE-%';

-- Test user + provider + address + subservice
INSERT INTO auth.users (id, name, role) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Race Test Customer', 'customer'),
    ('c0000000-0000-0000-0000-000000000002', 'Race Test Provider', 'provider')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.addresses (id, user_id, house_no_building, address_line_1, area_locality, city, district, state, pincode, latitude, longitude, formatted_address) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '1', 'Race St', 'Area', 'City', 'Dist', 'State', '500001', 17.385, 78.486, 'Race Addr')
ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog.categories (id, name, description) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'RaceCat', 'test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog.services (id, category_id, service_name, slug, description, base_price, duration) VALUES
    ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'RaceSvc', 'race-svc', 'test', 100, 60)
ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog.subservices (id, service_id, subservice_name, description) VALUES
    ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'RaceSub', 'test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO provider.providers (id, user_id) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- Slot with capacity = 1
INSERT INTO booking.slot_capacities (id, provider_id, slot_date, slot, booked_count, max_capacity) VALUES
    ('50000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2099-12-31', '10:00', 0, 1)
ON CONFLICT (provider_id, slot_date, slot) DO UPDATE SET booked_count = 0;

-- Slot with capacity = 5
INSERT INTO booking.slot_capacities (id, provider_id, slot_date, slot, booked_count, max_capacity) VALUES
    ('50000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', '2099-12-31', '11:00', 0, 5)
ON CONFLICT (provider_id, slot_date, slot) DO UPDATE SET booked_count = 0;

-- Customer wallet for reconciliation test
INSERT INTO payment.customer_wallets (id, user_id, balance, version) VALUES
    ('a1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1000.00, 1)
ON CONFLICT (user_id) DO UPDATE SET balance = 1000.00, version = 1;
