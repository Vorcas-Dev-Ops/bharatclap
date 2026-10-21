-- Migration 032: Recipient-Level Delivery Audit, Idempotency & Deduplication

CREATE TABLE IF NOT EXISTS notification.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES notification.campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL,
  recipient_role VARCHAR(20) NOT NULL DEFAULT 'customer',
  fcm_token TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'sent', -- 'queued', 'sent', 'delivered', 'opened', 'failed'
  provider_message_id TEXT,
  failure_reason TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index to strictly enforce idempotency: 1 delivery per campaign per recipient
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_deliveries_idempotency 
  ON notification.notification_deliveries (campaign_id, recipient_id);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_recipient 
  ON notification.notification_deliveries (recipient_id, recipient_role);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_campaign 
  ON notification.notification_deliveries (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_notification_campaigns_scheduled 
  ON notification.campaigns (status, scheduled_at) 
  WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS notification.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'customer',
  token TEXT NOT NULL,
  device_type VARCHAR(20) DEFAULT 'android',
  is_active BOOLEAN DEFAULT true,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_device_token UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user 
  ON notification.device_tokens (user_id, role, is_active);

