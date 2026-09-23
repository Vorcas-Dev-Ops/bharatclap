-- 008b_legacy_indexes.sql
-- BharatClap PostgreSQL Migration — UNIQUE legacy_mongo_id per migrated table (P0-7)
-- Prevents duplicate migration of the same Mongo document

-- Auth
CREATE UNIQUE INDEX ux_users_legacy ON auth.users(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_otp_legacy ON auth.otp_challenges(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_addresses_legacy ON auth.addresses(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_refresh_tokens_legacy ON auth.refresh_tokens(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_admin_logs_legacy ON auth.admin_activity_logs(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_cust_referrals_legacy ON auth.customer_referrals(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_referral_rewards_legacy ON auth.referral_rewards(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_acct_deletion_legacy ON auth.account_deletion_requests(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_acct_del_outbox_legacy ON auth.account_deletion_outbox(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_pending_phone_legacy ON auth.pending_phone_changes(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_phone_history_legacy ON auth.phone_change_history(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_locations_legacy ON auth.locations(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_pincode_cache_legacy ON auth.pincode_cache(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_contact_inq_legacy ON auth.contact_inquiries(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;

-- Catalog
CREATE UNIQUE INDEX ux_categories_legacy ON catalog.categories(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_services_legacy ON catalog.services(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_subservices_legacy ON catalog.subservices(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_coupons_legacy ON catalog.coupons(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_commissions_legacy ON catalog.commissions(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_memberships_legacy ON catalog.memberships(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_offers_legacy ON catalog.offers(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_banners_legacy ON catalog.banners(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_platform_settings_legacy ON catalog.platform_settings(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_timeslot_rules_legacy ON catalog.time_slot_rules(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_timeslot_audits_legacy ON catalog.time_slot_pricing_audits(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_accessories_legacy ON catalog.accessories(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;

-- Booking
CREATE UNIQUE INDEX ux_bookings_legacy ON booking.bookings(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_fin_snapshots_legacy ON booking.booking_financial_snapshots(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_reviews_legacy ON booking.reviews(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_conversations_legacy ON booking.conversations(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_chat_messages_legacy ON booking.chat_messages(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_orders_legacy ON booking.orders(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_carts_legacy ON booking.carts(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_complaints_legacy ON booking.complaints(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_coupon_redemptions_legacy ON booking.coupon_redemptions(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_pricing_quotes_legacy ON booking.pricing_quotes(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_refund_policies_bk_legacy ON booking.refund_policies(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_waitlists_legacy ON booking.waitlists(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;

-- Provider
CREATE UNIQUE INDEX ux_providers_legacy ON provider.providers(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_provider_bank_legacy ON provider.provider_bank_details(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_provider_services_legacy ON provider.provider_services(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_settlements_legacy ON provider.provider_settlements(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_wallets_legacy ON provider.wallets(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_wallet_tx_legacy ON provider.wallet_transactions(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_wallet_audit_legacy ON provider.wallet_audit_logs(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_wallet_recon_legacy ON provider.wallet_reconciliation_logs(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_job_requests_legacy ON provider.job_requests(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_prov_locations_legacy ON provider.provider_locations(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_prov_loc_stats_legacy ON provider.provider_location_daily_stats(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_prov_stats_legacy ON provider.provider_stats(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_prov_scores_legacy ON provider.provider_scores(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_prov_counters_legacy ON provider.provider_counters(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_payouts_legacy ON provider.payouts(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_payout_attempts_legacy ON provider.settlement_payout_attempts(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;

-- Payment
CREATE UNIQUE INDEX ux_payments_legacy ON payment.payments(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_payment_attempts_legacy ON payment.payment_attempts(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_webhook_logs_legacy ON payment.webhook_logs(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_refunds_legacy ON payment.refunds(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_invoices_legacy ON payment.invoices(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_fin_adjustments_legacy ON payment.financial_adjustments(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_fin_audit_legacy ON payment.financial_audit_logs(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_payout_batches_legacy ON payment.payout_batches(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_cust_wallets_legacy ON payment.customer_wallets(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_cust_wallet_tx_legacy ON payment.customer_wallet_transactions(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_user_memberships_legacy ON payment.user_memberships(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_coupon_usages_legacy ON payment.coupon_usages(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_cash_remittances_legacy ON payment.cash_remittances(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;

-- Accounting
CREATE UNIQUE INDEX ux_journal_entries_legacy ON accounting.journal_entries(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;

-- Notification
CREATE UNIQUE INDEX ux_notifications_legacy ON notification.notifications(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_admin_reports_legacy ON notification.admin_reports(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_processed_events_legacy ON notification.processed_events(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_sys_settings_legacy ON notification.system_settings(legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
