# BharatClap PostgreSQL Index Review & Optimization Catalog

**Date:** October 10, 2026
**Target Database:** `bharatclap_migration_test` (PostgreSQL 18.1)
**Total Existing Indexes:** 348
**Total Foreign Key Constraints:** 58

## 1. Unindexed Foreign Keys (35 Missing Indexes Detected)

Foreign keys without supporting indexes result in sequential scans on child tables during parent deletes/updates (foreign key cascade lock checking) and slow JOIN lookups.

| Schema | Child Table | Foreign Key Column | Parent Table | Constraint Name | Recommended Index SQL |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `auth` | `account_deletion_outbox` | `user_id` | `auth.users` | `fk_deletion_outbox_user` | `CREATE INDEX ix_account_deletion_outbox_user_id ON auth.account_deletion_outbox (user_id);` |
| `auth` | `account_deletion_requests` | `user_id` | `auth.users` | `fk_deletion_user` | `CREATE INDEX ix_account_deletion_requests_user_id ON auth.account_deletion_requests (user_id);` |
| `auth` | `customer_referrals` | `referred_id` | `auth.users` | `fk_referral_referred` | `CREATE INDEX ix_customer_referrals_referred_id ON auth.customer_referrals (referred_id);` |
| `auth` | `pending_phone_changes` | `user_id` | `auth.users` | `fk_phone_change_user` | `CREATE INDEX ix_pending_phone_changes_user_id ON auth.pending_phone_changes (user_id);` |
| `auth` | `phone_change_history` | `user_id` | `auth.users` | `fk_phone_history_user` | `CREATE INDEX ix_phone_change_history_user_id ON auth.phone_change_history (user_id);` |
| `auth` | `referral_rewards` | `referral_id` | `auth.customer_referrals` | `fk_reward_referral` | `CREATE INDEX ix_referral_rewards_referral_id ON auth.referral_rewards (referral_id);` |
| `auth` | `referral_rewards` | `user_id` | `auth.users` | `fk_reward_user` | `CREATE INDEX ix_referral_rewards_user_id ON auth.referral_rewards (user_id);` |
| `booking` | `booking_admin_notes` | `booking_id` | `booking.bookings` | `fk_adminnote_booking` | `CREATE INDEX ix_booking_admin_notes_booking_id ON booking.booking_admin_notes (booking_id);` |
| `booking` | `booking_previous_providers` | `booking_id` | `booking.bookings` | `fk_prevprov_booking` | `CREATE INDEX ix_booking_previous_providers_booking_id ON booking.booking_previous_providers (booking_id);` |
| `booking` | `complaints` | `booking_id` | `booking.bookings` | `fk_complaint_booking` | `CREATE INDEX ix_complaints_booking_id ON booking.complaints (booking_id);` |
| `booking` | `conversations` | `booking_id` | `booking.bookings` | `fk_conv_booking` | `CREATE INDEX ix_conversations_booking_id ON booking.conversations (booking_id);` |
| `booking` | `coupon_redemptions` | `booking_id` | `booking.bookings` | `fk_redemption_booking` | `CREATE INDEX ix_coupon_redemptions_booking_id ON booking.coupon_redemptions (booking_id);` |
| `booking` | `payment_collection_audits` | `booking_id` | `booking.bookings` | `fk_pcaudit_booking` | `CREATE INDEX ix_payment_collection_audits_booking_id ON booking.payment_collection_audits (booking_id);` |
| `booking` | `payment_collection_links` | `collection_id` | `booking.booking_payment_collections` | `fk_link_collection` | `CREATE INDEX ix_payment_collection_links_collection_id ON booking.payment_collection_links (collection_id);` |
| `catalog` | `accessories` | `category_id` | `catalog.categories` | `fk_accessory_category` | `CREATE INDEX ix_accessories_category_id ON catalog.accessories (category_id);` |
| `catalog` | `commissions` | `category_id` | `catalog.categories` | `fk_commission_category` | `CREATE INDEX ix_commissions_category_id ON catalog.commissions (category_id);` |
| `catalog` | `coupon_allowed_categories` | `category_id` | `catalog.categories` | `fk_cac_category` | `CREATE INDEX ix_coupon_allowed_categories_category_id ON catalog.coupon_allowed_categories (category_id);` |
| `catalog` | `coupon_allowed_memberships` | `membership_id` | `catalog.memberships` | `fk_cam_membership` | `CREATE INDEX ix_coupon_allowed_memberships_membership_id ON catalog.coupon_allowed_memberships (membership_id);` |
| `catalog` | `coupon_allowed_services` | `service_id` | `catalog.services` | `fk_cas_service` | `CREATE INDEX ix_coupon_allowed_services_service_id ON catalog.coupon_allowed_services (service_id);` |
| `catalog` | `service_preparations` | `subservice_id` | `catalog.subservices` | `fk_prep_subservice` | `CREATE INDEX ix_service_preparations_subservice_id ON catalog.service_preparations (subservice_id);` |
| `catalog` | `services` | `category_id` | `catalog.categories` | `fk_service_category` | `CREATE INDEX ix_services_category_id ON catalog.services (category_id);` |
| `catalog` | `subservices` | `service_id` | `catalog.services` | `fk_subservice_service` | `CREATE INDEX ix_subservices_service_id ON catalog.subservices (service_id);` |
| `catalog` | `time_slot_pricing_audits` | `rule_id` | `catalog.time_slot_rules` | `fk_audit_rule` | `CREATE INDEX ix_time_slot_pricing_audits_rule_id ON catalog.time_slot_pricing_audits (rule_id);` |
| `catalog` | `time_slot_rules` | `category_id` | `catalog.categories` | `fk_timeslot_category` | `CREATE INDEX ix_time_slot_rules_category_id ON catalog.time_slot_rules (category_id);` |
| `payment` | `customer_wallet_transactions` | `wallet_id` | `payment.customer_wallets` | `fk_custwtx_wallet` | `CREATE INDEX ix_customer_wallet_transactions_wallet_id ON payment.customer_wallet_transactions (wallet_id);` |
| `payment` | `payment_attempts` | `payment_id` | `payment.payments` | `fk_attempt_payment` | `CREATE INDEX ix_payment_attempts_payment_id ON payment.payment_attempts (payment_id);` |
| `provider` | `job_requests` | `provider_id` | `provider.providers` | `fk_jobreq_provider` | `CREATE INDEX ix_job_requests_provider_id ON provider.job_requests (provider_id);` |
| `provider` | `payouts` | `provider_id` | `provider.providers` | `fk_payout_provider` | `CREATE INDEX ix_payouts_provider_id ON provider.payouts (provider_id);` |
| `provider` | `payouts` | `settlement_id` | `provider.provider_settlements` | `fk_payout_settlement` | `CREATE INDEX ix_payouts_settlement_id ON provider.payouts (settlement_id);` |
| `provider` | `provider_locations` | `provider_id` | `provider.providers` | `fk_provlocation_provider` | `CREATE INDEX ix_provider_locations_provider_id ON provider.provider_locations (provider_id);` |
| `provider` | `provider_service_documents` | `provider_service_id` | `provider.provider_services` | `fk_provdoc_service` | `CREATE INDEX ix_provider_service_documents_provider_service_id ON provider.provider_service_documents (provider_service_id);` |
| `provider` | `provider_service_locations` | `provider_service_id` | `provider.provider_services` | `fk_provloc_service` | `CREATE INDEX ix_provider_service_locations_provider_service_id ON provider.provider_service_locations (provider_service_id);` |
| `provider` | `provider_services` | `provider_id` | `provider.providers` | `fk_provservice_provider` | `CREATE INDEX ix_provider_services_provider_id ON provider.provider_services (provider_id);` |
| `provider` | `settlement_adjustments` | `settlement_id` | `provider.provider_settlements` | `fk_adj_settlement` | `CREATE INDEX ix_settlement_adjustments_settlement_id ON provider.settlement_adjustments (settlement_id);` |
| `provider` | `settlement_payout_attempts` | `settlement_id` | `provider.provider_settlements` | `fk_payoutattempt_settlement` | `CREATE INDEX ix_settlement_payout_attempts_settlement_id ON provider.settlement_payout_attempts (settlement_id);` |

---

## 2. Redundant & Duplicate Indexes

PostgreSQL does not automatically prevent duplicate indexes with different names.

### Finding: Redundant Unique Indexes on `provider.providers`
- **Index 1:** `idx_providers_kit_collection_id` (CREATE UNIQUE INDEX idx_providers_kit_collection_id ON provider.providers USING btree (kit_collection_id) WHERE kit_collection_id IS NOT NULL)
- **Index 2:** `uq_providers_kit_collection_id` (CREATE UNIQUE INDEX uq_providers_kit_collection_id ON provider.providers USING btree (kit_collection_id) WHERE kit_collection_id IS NOT NULL)
- **Impact:** Both indexes are 100% identical partial unique indexes on the same column. Every insert/update incurs double B-tree write overhead and memory usage.
- **Recommendation:** `DROP INDEX provider.idx_providers_kit_collection_id;` (keep `uq_providers_kit_collection_id`).


---

## 3. High-Value Proposed Partial & Composite Indexes

Based on live EXPLAIN plans and production repository query patterns, the following indexes are proposed to eliminate Sequential Scans:

### A. Admin Dashboard & Booking Management
```sql
-- Eliminates Seq Scan on stuck booking counts in dashboardController.ts
CREATE INDEX ix_bookings_stuck_accepted ON booking.bookings (status, accepted_at) 
WHERE deleted_at IS NULL AND status = 'accepted';

CREATE INDEX ix_bookings_refund_status ON booking.bookings (refund_status) 
WHERE deleted_at IS NULL AND refund_status IN ('initiated', 'processing');

CREATE INDEX ix_bookings_settlement_status ON booking.bookings (settlement_status) 
WHERE deleted_at IS NULL AND settlement_status IN ('Queued', 'Created', 'Ready');

-- Composite index for order lookup in bookings
CREATE INDEX ix_bookings_order_id ON booking.bookings (order_id) 
WHERE order_id IS NOT NULL;
```

### B. Outbox Polling Queues (Eliminates 1000ms Polling Seq Scans)
```sql
-- Lead Refund Outbox Poller
CREATE INDEX ix_lead_refund_outbox_pending ON booking.lead_refund_outbox (status, created_at) 
WHERE status = 'PENDING';

-- Rating Outbox Poller
CREATE INDEX ix_rating_outbox_pending ON booking.rating_outbox (status, created_at) 
WHERE status = 'PENDING';

-- Settlement Outbox Poller
CREATE INDEX ix_settlement_outbox_pending ON booking.settlement_outbox (status, created_at) 
WHERE status = 'PENDING';

-- Compensation Outbox Poller (provider-service)
CREATE INDEX ix_compensation_outbox_pending ON provider.compensation_outbox (status, created_at) 
WHERE status = 'PENDING';

-- Wallet Outbox Poller (provider-service)
CREATE INDEX ix_wallet_outbox_pending ON provider.wallet_outbox (status, created_at) 
WHERE status = 'PENDING';
```

### C. Provider Dispatch & Geospatial
```sql
-- Index on provider_locations for fast coordinate bounding-box filtering
CREATE INDEX ix_prov_loc_lat_lng ON provider.provider_locations (latitude, longitude) 
WHERE status = 'active';

-- Compound index on active provider services
CREATE INDEX ix_prov_services_provider_active ON provider.provider_services (provider_id, is_active);
CREATE INDEX ix_prov_subservices_subservice ON provider.provider_service_subservices (subservice_id, provider_service_id);
```

