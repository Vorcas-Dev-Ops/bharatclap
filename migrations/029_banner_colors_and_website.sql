-- ── 029_banner_colors_and_website.sql ──────────────────────────────────
-- Adds background_color and text_color columns to catalog.banners.
-- Enables custom styling (color, gradients, text color) and website banner targeting.

ALTER TABLE catalog.banners
    ADD COLUMN IF NOT EXISTS background_color TEXT DEFAULT '#5E2FD9',
    ADD COLUMN IF NOT EXISTS text_color TEXT DEFAULT '#FFFFFF';

CREATE INDEX IF NOT EXISTS idx_banners_placement_audience_status_v2
    ON catalog.banners (placement, audience, status, position);
