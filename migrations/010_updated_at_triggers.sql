-- 010_updated_at_triggers.sql
-- BharatClap PostgreSQL Migration — Automatic updated_at (P1-14)
-- Database trigger guarantees updated_at is always set, regardless of application code.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════════
-- AUTH (mutable tables with updated_at)
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_updated_users BEFORE UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_addresses BEFORE UPDATE ON auth.addresses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_refresh_tokens BEFORE UPDATE ON auth.refresh_tokens
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_cust_referrals BEFORE UPDATE ON auth.customer_referrals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_referral_rewards BEFORE UPDATE ON auth.referral_rewards
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_acct_deletion BEFORE UPDATE ON auth.account_deletion_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_acct_del_outbox BEFORE UPDATE ON auth.account_deletion_outbox
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_pending_phone BEFORE UPDATE ON auth.pending_phone_changes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_locations BEFORE UPDATE ON auth.locations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ══════════════════════════════════════════════════════════════════════
-- CATALOG
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_updated_categories BEFORE UPDATE ON catalog.categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_services BEFORE UPDATE ON catalog.services
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_subservices BEFORE UPDATE ON catalog.subservices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_coupons BEFORE UPDATE ON catalog.coupons
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_commissions BEFORE UPDATE ON catalog.commissions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_memberships BEFORE UPDATE ON catalog.memberships
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_offers BEFORE UPDATE ON catalog.offers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_banners BEFORE UPDATE ON catalog.banners
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_platform_settings BEFORE UPDATE ON catalog.platform_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_timeslot_rules BEFORE UPDATE ON catalog.time_slot_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_accessories BEFORE UPDATE ON catalog.accessories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ══════════════════════════════════════════════════════════════════════
-- BOOKING
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_updated_bookings BEFORE UPDATE ON booking.bookings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_bk_collections BEFORE UPDATE ON booking.booking_payment_collections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_slot_caps BEFORE UPDATE ON booking.slot_capacities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_reviews BEFORE UPDATE ON booking.reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_conversations BEFORE UPDATE ON booking.conversations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_orders BEFORE UPDATE ON booking.orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_carts BEFORE UPDATE ON booking.carts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_complaints BEFORE UPDATE ON booking.complaints
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_event_outbox BEFORE UPDATE ON booking.event_outbox
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_settlement_outbox BEFORE UPDATE ON booking.settlement_outbox
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_lead_refund_outbox BEFORE UPDATE ON booking.lead_refund_outbox
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_rating_outbox BEFORE UPDATE ON booking.rating_outbox
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_refund_policies_bk BEFORE UPDATE ON booking.refund_policies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_waitlists BEFORE UPDATE ON booking.waitlists
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ══════════════════════════════════════════════════════════════════════
-- PROVIDER
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_updated_providers BEFORE UPDATE ON provider.providers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_provider_bank BEFORE UPDATE ON provider.provider_bank_details
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_provider_services BEFORE UPDATE ON provider.provider_services
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_prov_svc_locations BEFORE UPDATE ON provider.provider_service_locations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_settlements BEFORE UPDATE ON provider.provider_settlements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_wallets BEFORE UPDATE ON provider.wallets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_wallet_outbox BEFORE UPDATE ON provider.wallet_outbox
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_job_requests BEFORE UPDATE ON provider.job_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_prov_locations BEFORE UPDATE ON provider.provider_locations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_prov_cal_blocks BEFORE UPDATE ON provider.provider_calendar_blocks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_prov_leaves BEFORE UPDATE ON provider.provider_leaves
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_prov_stats BEFORE UPDATE ON provider.provider_stats
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_prov_scores BEFORE UPDATE ON provider.provider_scores
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_prov_counters BEFORE UPDATE ON provider.provider_counters
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_payouts BEFORE UPDATE ON provider.payouts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_comp_outbox BEFORE UPDATE ON provider.compensation_outbox
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_lead_packages BEFORE UPDATE ON provider.lead_packages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_lead_pkg_orders BEFORE UPDATE ON provider.lead_package_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_lead_reservations BEFORE UPDATE ON provider.lead_reservations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_lead_fee_configs BEFORE UPDATE ON provider.lead_fee_configs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_prov_referrals BEFORE UPDATE ON provider.provider_referrals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_ref_campaigns BEFORE UPDATE ON provider.provider_referral_campaigns
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_starter_kits BEFORE UPDATE ON provider.starter_kits
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_kit_orders BEFORE UPDATE ON provider.kit_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_acc_orders BEFORE UPDATE ON provider.accessory_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_prov_orders BEFORE UPDATE ON provider.provider_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_dispatch_settings BEFORE UPDATE ON provider.dispatch_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_dispatch_config BEFORE UPDATE ON provider.dispatch_configurations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_cat_dispatch BEFORE UPDATE ON provider.category_dispatch_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_sub_policies BEFORE UPDATE ON provider.subscription_policies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_verify_actions BEFORE UPDATE ON provider.verification_actions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_loc_change_req BEFORE UPDATE ON provider.location_change_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_reconcursors BEFORE UPDATE ON provider.reconcursors
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ══════════════════════════════════════════════════════════════════════
-- PAYMENT
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_updated_payments BEFORE UPDATE ON payment.payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_pmt_event_outbox BEFORE UPDATE ON payment.payment_event_outbox
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_refunds BEFORE UPDATE ON payment.refunds
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_refund_outbox BEFORE UPDATE ON payment.refund_outbox_events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_refund_policies BEFORE UPDATE ON payment.refund_policies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_payout_batches BEFORE UPDATE ON payment.payout_batches
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_prov_collections BEFORE UPDATE ON payment.provider_collections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_razorpay_qrs BEFORE UPDATE ON payment.razorpay_payment_qrs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_user_memberships BEFORE UPDATE ON payment.user_memberships
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_cash_remittances BEFORE UPDATE ON payment.cash_remittances
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_cust_wallets BEFORE UPDATE ON payment.customer_wallets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ══════════════════════════════════════════════════════════════════════
-- NOTIFICATION
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_updated_sys_settings BEFORE UPDATE ON notification.system_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ══════════════════════════════════════════════════════════════════════
-- MIGRATION
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_updated_checkpoints BEFORE UPDATE ON migration.checkpoints
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
