-- ── 030_banner_template_config.sql ───────────────────────────────────────
-- Adds template_config JSONB column to catalog.banners.
-- Backward-compatible: defaults to '{"template":"split"}'::jsonb
-- Supports templates: split, full_background, image_left, centered_promo, highlight_deal

ALTER TABLE catalog.banners
    ADD COLUMN IF NOT EXISTS template_config JSONB DEFAULT '{"template":"split"}'::jsonb;
