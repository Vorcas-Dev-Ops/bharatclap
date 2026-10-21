-- 031_notification_management.sql
-- BharatClap Notification Management (Campaigns, Templates, Auditing)
-- Owner: notification-service / admin-service

CREATE TABLE IF NOT EXISTS notification.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    app VARCHAR(50) NOT NULL DEFAULT 'customer' CHECK (app IN ('customer', 'provider', 'both')),
    audience_type VARCHAR(50) NOT NULL DEFAULT 'all' CHECK (audience_type IN ('all', 'specific', 'filter')),
    audience_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
    type VARCHAR(50) NOT NULL DEFAULT 'PROMOTIONAL',
    action_type VARCHAR(50) NOT NULL DEFAULT 'open_home',
    action_value VARCHAR(255),
    image_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    recipients_count INT NOT NULL DEFAULT 0,
    delivered_count INT NOT NULL DEFAULT 0,
    opened_count INT NOT NULL DEFAULT 0,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_notification_campaigns_status ON notification.campaigns(status, scheduled_at, created_at DESC);

CREATE TABLE IF NOT EXISTS notification.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    app VARCHAR(50) NOT NULL DEFAULT 'customer' CHECK (app IN ('customer', 'provider', 'both')),
    type VARCHAR(50) NOT NULL DEFAULT 'PROMOTIONAL',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    image_url TEXT,
    action_type VARCHAR(50) NOT NULL DEFAULT 'open_home',
    action_value VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed predefined templates for Customer & Partner apps
INSERT INTO notification.templates (name, app, type, title, message, action_type, action_value)
VALUES
    ('AC Service Offer', 'customer', 'PROMOTIONAL', 'AC Service Offer 🔥', 'Book your AC repair or deep service today and enjoy flat 25% off!', 'open_service', 'ac-service'),
    ('Salon at Home Special', 'customer', 'MARKETING', 'Salon at Home 💅', 'Pamper yourself this weekend! Expert beauty professionals arriving at your doorstep.', 'open_category', 'salon'),
    ('Booking Confirmed', 'customer', 'TRANSACTIONAL', 'Booking Confirmed ✅', 'Your service booking has been confirmed. A trusted professional will be assigned shortly.', 'open_booking', 'my_bookings'),
    ('Payment Successful', 'customer', 'PAYMENT', 'Payment Received 💳', 'Your payment has been successfully processed. Thank you for choosing BharatClap!', 'open_wallet', 'transactions'),
    ('New High-Value Job Alert', 'provider', 'JOB', 'New Job Available ⚡', 'A new high-priority booking is available near your location. Accept now to maximize earnings!', 'open_home', 'job_requests'),
    ('Weekly Settlement Completed', 'provider', 'PAYMENT', 'Payout Credited 💰', 'Your weekly service payout has been transferred to your registered bank account.', 'open_wallet', 'payouts'),
    ('Starter Kit Collection Reminder', 'provider', 'ANNOUNCEMENT', 'Collect Your Starter Kit 🎒', 'Your branded BharatClap safety kit is ready for pickup at the nearest hub.', 'open_home', 'kit_collection'),
    ('Platform Feature Update', 'both', 'SYSTEM', 'Important App Update 🚀', 'New performance features and instant booking improvements are now live.', 'open_home', '')
ON CONFLICT DO NOTHING;
