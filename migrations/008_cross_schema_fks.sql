-- 008_cross_schema_fks.sql
-- BharatClap PostgreSQL Migration — All Cross-Schema Foreign Keys
-- Separated from table creation to eliminate circular dependency issues
--
-- ON DELETE rules:
--   RESTRICT  = financial records (never silently cascade-delete)
--   CASCADE   = child data that is meaningless without parent
--   SET NULL  = audit logs (survive actor deletion)

-- ══════════════════════════════════════════════════════════════════════
-- AUTH INTERNAL
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE auth.addresses
    ADD CONSTRAINT fk_address_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE auth.refresh_tokens
    ADD CONSTRAINT fk_token_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE auth.admin_activity_logs
    ADD CONSTRAINT fk_audit_admin
    FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE auth.customer_referrals
    ADD CONSTRAINT fk_referral_referrer
    FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE auth.customer_referrals
    ADD CONSTRAINT fk_referral_referred
    FOREIGN KEY (referred_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE auth.referral_rewards
    ADD CONSTRAINT fk_reward_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE auth.referral_rewards
    ADD CONSTRAINT fk_reward_referral
    FOREIGN KEY (referral_id) REFERENCES auth.customer_referrals(id) ON DELETE RESTRICT;

ALTER TABLE auth.account_deletion_requests
    ADD CONSTRAINT fk_deletion_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE auth.account_deletion_outbox
    ADD CONSTRAINT fk_deletion_outbox_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE auth.pending_phone_changes
    ADD CONSTRAINT fk_phone_change_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE auth.phone_change_history
    ADD CONSTRAINT fk_phone_history_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- ══════════════════════════════════════════════════════════════════════
-- CATALOG INTERNAL
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE catalog.services
    ADD CONSTRAINT fk_service_category
    FOREIGN KEY (category_id) REFERENCES catalog.categories(id) ON DELETE RESTRICT;

ALTER TABLE catalog.subservices
    ADD CONSTRAINT fk_subservice_service
    FOREIGN KEY (service_id) REFERENCES catalog.services(id) ON DELETE RESTRICT;

ALTER TABLE catalog.subservice_variants
    ADD CONSTRAINT fk_variant_subservice
    FOREIGN KEY (subservice_id) REFERENCES catalog.subservices(id) ON DELETE CASCADE;

ALTER TABLE catalog.subservice_packages
    ADD CONSTRAINT fk_package_subservice
    FOREIGN KEY (subservice_id) REFERENCES catalog.subservices(id) ON DELETE CASCADE;

ALTER TABLE catalog.package_variants
    ADD CONSTRAINT fk_pkgvariant_package
    FOREIGN KEY (package_id) REFERENCES catalog.subservice_packages(id) ON DELETE CASCADE;

ALTER TABLE catalog.service_preparations
    ADD CONSTRAINT fk_prep_subservice
    FOREIGN KEY (subservice_id) REFERENCES catalog.subservices(id) ON DELETE CASCADE;

ALTER TABLE catalog.coupon_allowed_services
    ADD CONSTRAINT fk_cas_coupon
    FOREIGN KEY (coupon_id) REFERENCES catalog.coupons(id) ON DELETE CASCADE;

ALTER TABLE catalog.coupon_allowed_services
    ADD CONSTRAINT fk_cas_service
    FOREIGN KEY (service_id) REFERENCES catalog.services(id) ON DELETE CASCADE;

ALTER TABLE catalog.coupon_allowed_categories
    ADD CONSTRAINT fk_cac_coupon
    FOREIGN KEY (coupon_id) REFERENCES catalog.coupons(id) ON DELETE CASCADE;

ALTER TABLE catalog.coupon_allowed_categories
    ADD CONSTRAINT fk_cac_category
    FOREIGN KEY (category_id) REFERENCES catalog.categories(id) ON DELETE CASCADE;

ALTER TABLE catalog.coupon_allowed_memberships
    ADD CONSTRAINT fk_cam_coupon
    FOREIGN KEY (coupon_id) REFERENCES catalog.coupons(id) ON DELETE CASCADE;

ALTER TABLE catalog.coupon_allowed_memberships
    ADD CONSTRAINT fk_cam_membership
    FOREIGN KEY (membership_id) REFERENCES catalog.memberships(id) ON DELETE CASCADE;

ALTER TABLE catalog.commissions
    ADD CONSTRAINT fk_commission_category
    FOREIGN KEY (category_id) REFERENCES catalog.categories(id) ON DELETE RESTRICT;

ALTER TABLE catalog.time_slot_rules
    ADD CONSTRAINT fk_timeslot_category
    FOREIGN KEY (category_id) REFERENCES catalog.categories(id) ON DELETE SET NULL;

ALTER TABLE catalog.time_slot_pricing_audits
    ADD CONSTRAINT fk_audit_rule
    FOREIGN KEY (rule_id) REFERENCES catalog.time_slot_rules(id) ON DELETE RESTRICT;

ALTER TABLE catalog.accessories
    ADD CONSTRAINT fk_accessory_category
    FOREIGN KEY (category_id) REFERENCES catalog.categories(id) ON DELETE SET NULL;

-- ══════════════════════════════════════════════════════════════════════
-- BOOKING CROSS-SCHEMA
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE booking.bookings
    ADD CONSTRAINT fk_booking_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE booking.bookings
    ADD CONSTRAINT fk_booking_subservice
    FOREIGN KEY (subservice_id) REFERENCES catalog.subservices(id) ON DELETE RESTRICT;

ALTER TABLE booking.bookings
    ADD CONSTRAINT fk_booking_address
    FOREIGN KEY (address_id) REFERENCES auth.addresses(id) ON DELETE RESTRICT;

-- BOOKING INTERNAL
ALTER TABLE booking.booking_financial_snapshots
    ADD CONSTRAINT fk_snapshot_booking
    FOREIGN KEY (booking_id) REFERENCES booking.bookings(id) ON DELETE RESTRICT;

ALTER TABLE booking.booking_payment_collections
    ADD CONSTRAINT fk_collection_booking
    FOREIGN KEY (booking_id) REFERENCES booking.bookings(id) ON DELETE RESTRICT;

ALTER TABLE booking.payment_collection_links
    ADD CONSTRAINT fk_link_collection
    FOREIGN KEY (collection_id) REFERENCES booking.booking_payment_collections(id) ON DELETE CASCADE;

ALTER TABLE booking.booking_previous_providers
    ADD CONSTRAINT fk_prevprov_booking
    FOREIGN KEY (booking_id) REFERENCES booking.bookings(id) ON DELETE RESTRICT;

ALTER TABLE booking.booking_admin_notes
    ADD CONSTRAINT fk_adminnote_booking
    FOREIGN KEY (booking_id) REFERENCES booking.bookings(id) ON DELETE RESTRICT;

ALTER TABLE booking.booking_activities
    ADD CONSTRAINT fk_activity_booking
    FOREIGN KEY (booking_id) REFERENCES booking.bookings(id) ON DELETE RESTRICT;

ALTER TABLE booking.reviews
    ADD CONSTRAINT fk_review_booking
    FOREIGN KEY (booking_id) REFERENCES booking.bookings(id) ON DELETE RESTRICT;

ALTER TABLE booking.conversations
    ADD CONSTRAINT fk_conv_booking
    FOREIGN KEY (booking_id) REFERENCES booking.bookings(id) ON DELETE SET NULL;

ALTER TABLE booking.conversation_participants
    ADD CONSTRAINT fk_participant_conv
    FOREIGN KEY (conversation_id) REFERENCES booking.conversations(id) ON DELETE CASCADE;

ALTER TABLE booking.chat_messages
    ADD CONSTRAINT fk_msg_conv
    FOREIGN KEY (conversation_id) REFERENCES booking.conversations(id) ON DELETE CASCADE;

ALTER TABLE booking.complaints
    ADD CONSTRAINT fk_complaint_booking
    FOREIGN KEY (booking_id) REFERENCES booking.bookings(id) ON DELETE RESTRICT;

ALTER TABLE booking.coupon_redemptions
    ADD CONSTRAINT fk_redemption_booking
    FOREIGN KEY (booking_id) REFERENCES booking.bookings(id) ON DELETE RESTRICT;

ALTER TABLE booking.payment_collection_audits
    ADD CONSTRAINT fk_pcaudit_booking
    FOREIGN KEY (booking_id) REFERENCES booking.bookings(id) ON DELETE RESTRICT;

-- ══════════════════════════════════════════════════════════════════════
-- PROVIDER CROSS-SCHEMA
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE provider.providers
    ADD CONSTRAINT fk_provider_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- PROVIDER INTERNAL
ALTER TABLE provider.provider_bank_details
    ADD CONSTRAINT fk_bankdetails_provider
    FOREIGN KEY (provider_id) REFERENCES provider.providers(id) ON DELETE RESTRICT;

ALTER TABLE provider.provider_services
    ADD CONSTRAINT fk_provservice_provider
    FOREIGN KEY (provider_id) REFERENCES provider.providers(id) ON DELETE RESTRICT;

ALTER TABLE provider.provider_service_locations
    ADD CONSTRAINT fk_provloc_service
    FOREIGN KEY (provider_service_id) REFERENCES provider.provider_services(id) ON DELETE CASCADE;

ALTER TABLE provider.provider_service_documents
    ADD CONSTRAINT fk_provdoc_service
    FOREIGN KEY (provider_service_id) REFERENCES provider.provider_services(id) ON DELETE CASCADE;

ALTER TABLE provider.provider_settlements
    ADD CONSTRAINT fk_settlement_provider
    FOREIGN KEY (provider_id) REFERENCES provider.providers(id) ON DELETE RESTRICT;

ALTER TABLE provider.provider_settlements
    ADD CONSTRAINT fk_settlement_booking
    FOREIGN KEY (booking_id) REFERENCES booking.bookings(id) ON DELETE RESTRICT;

ALTER TABLE provider.settlement_adjustments
    ADD CONSTRAINT fk_adj_settlement
    FOREIGN KEY (settlement_id) REFERENCES provider.provider_settlements(id) ON DELETE RESTRICT;

ALTER TABLE provider.wallets
    ADD CONSTRAINT fk_wallet_provider
    FOREIGN KEY (provider_id) REFERENCES provider.providers(id) ON DELETE RESTRICT;

ALTER TABLE provider.wallet_transactions
    ADD CONSTRAINT fk_wallettx_provider
    FOREIGN KEY (provider_id) REFERENCES provider.providers(id) ON DELETE RESTRICT;

ALTER TABLE provider.job_requests
    ADD CONSTRAINT fk_jobreq_provider
    FOREIGN KEY (provider_id) REFERENCES provider.providers(id) ON DELETE RESTRICT;

ALTER TABLE provider.job_requests
    ADD CONSTRAINT fk_jobreq_booking
    FOREIGN KEY (booking_id) REFERENCES booking.bookings(id) ON DELETE RESTRICT;

ALTER TABLE provider.provider_locations
    ADD CONSTRAINT fk_provlocation_provider
    FOREIGN KEY (provider_id) REFERENCES provider.providers(id) ON DELETE RESTRICT;

ALTER TABLE provider.payouts
    ADD CONSTRAINT fk_payout_provider
    FOREIGN KEY (provider_id) REFERENCES provider.providers(id) ON DELETE RESTRICT;

ALTER TABLE provider.payouts
    ADD CONSTRAINT fk_payout_settlement
    FOREIGN KEY (settlement_id) REFERENCES provider.provider_settlements(id) ON DELETE SET NULL;

ALTER TABLE provider.settlement_payout_attempts
    ADD CONSTRAINT fk_payoutattempt_settlement
    FOREIGN KEY (settlement_id) REFERENCES provider.provider_settlements(id) ON DELETE RESTRICT;

-- ══════════════════════════════════════════════════════════════════════
-- PAYMENT CROSS-SCHEMA
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE payment.payments
    ADD CONSTRAINT fk_payment_booking
    FOREIGN KEY (booking_id) REFERENCES booking.bookings(id) ON DELETE RESTRICT;

ALTER TABLE payment.payments
    ADD CONSTRAINT fk_payment_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE payment.payment_attempts
    ADD CONSTRAINT fk_attempt_payment
    FOREIGN KEY (payment_id) REFERENCES payment.payments(id) ON DELETE RESTRICT;

ALTER TABLE payment.refunds
    ADD CONSTRAINT fk_refund_booking
    FOREIGN KEY (booking_id) REFERENCES booking.bookings(id) ON DELETE RESTRICT;

ALTER TABLE payment.refunds
    ADD CONSTRAINT fk_refund_customer
    FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE payment.invoices
    ADD CONSTRAINT fk_invoice_booking
    FOREIGN KEY (booking_id) REFERENCES booking.bookings(id) ON DELETE RESTRICT;

ALTER TABLE payment.invoices
    ADD CONSTRAINT fk_invoice_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE payment.customer_wallets
    ADD CONSTRAINT fk_custwallet_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE payment.customer_wallet_transactions
    ADD CONSTRAINT fk_custwtx_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE payment.customer_wallet_transactions
    ADD CONSTRAINT fk_custwtx_wallet
    FOREIGN KEY (wallet_id) REFERENCES payment.customer_wallets(id) ON DELETE RESTRICT;

ALTER TABLE payment.user_memberships
    ADD CONSTRAINT fk_usermembership_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE payment.user_memberships
    ADD CONSTRAINT fk_usermembership_membership
    FOREIGN KEY (membership_id) REFERENCES catalog.memberships(id) ON DELETE RESTRICT;
