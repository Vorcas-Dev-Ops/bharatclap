-- ── 013_banner_management.sql ──────────────────────────────────────────
-- Enhances catalog.banners for comprehensive Admin Banner Management:
-- target audience (user/provider/both), dynamic placement, scheduling dates,
-- and subtitle/button_text.

ALTER TABLE catalog.banners
    ADD COLUMN IF NOT EXISTS subtitle TEXT,
    ADD COLUMN IF NOT EXISTS button_text TEXT,
    ADD COLUMN IF NOT EXISTS audience VARCHAR(20) NOT NULL DEFAULT 'both',
    ADD COLUMN IF NOT EXISTS placement VARCHAR(50) NOT NULL DEFAULT 'homepage_after_categories',
    ADD COLUMN IF NOT EXISTS redirect_type VARCHAR(20) DEFAULT 'url',
    ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_banners_placement_audience_status
    ON catalog.banners (placement, audience, status, position);
