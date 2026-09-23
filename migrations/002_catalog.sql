-- 002_catalog.sql
-- BharatClap PostgreSQL Migration — Catalog Schema
-- Owner: catalog-service

CREATE SCHEMA IF NOT EXISTS catalog;

-- ── categories ─────────────────────────────────────────────────────
CREATE TABLE catalog.categories (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code           TEXT,
    name                    TEXT NOT NULL,
    slug                    TEXT,
    icon                    TEXT,
    image                   TEXT,
    public_id               TEXT,
    resource_type           TEXT,
    description             TEXT NOT NULL,
    requires_gender_selection BOOLEAN NOT NULL DEFAULT FALSE,
    code_locked             BOOLEAN NOT NULL DEFAULT FALSE,
    status                  VARCHAR(10) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive')),
    legacy_mongo_id         TEXT,
    deleted_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global unique: slug never reused (URL routing / SEO)
CREATE UNIQUE INDEX ux_category_slug ON catalog.categories(slug)
    WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX ux_category_name ON catalog.categories(name)
    WHERE deleted_at IS NULL;

-- ── services ───────────────────────────────────────────────────────
CREATE TABLE catalog.services (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id             UUID NOT NULL,
    service_name            TEXT NOT NULL,
    slug                    TEXT NOT NULL,
    description             TEXT NOT NULL,
    base_price              NUMERIC(12,2) NOT NULL CHECK (base_price >= 0),
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    duration                INTEGER NOT NULL CHECK (duration >= 1),
    images                  TEXT[] DEFAULT '{}',
    is_featured             BOOLEAN NOT NULL DEFAULT FALSE,
    avg_rating              NUMERIC(3,2) NOT NULL DEFAULT 0
                            CHECK (avg_rating >= 0 AND avg_rating <= 5),
    total_reviews           INTEGER NOT NULL DEFAULT 0,
    gender_applicability    VARCHAR(10) NOT NULL DEFAULT 'men'
                            CHECK (gender_applicability IN ('men', 'women')),
    status                  VARCHAR(10) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive')),
    legacy_mongo_id         TEXT,
    deleted_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global unique: slug never reused
CREATE UNIQUE INDEX ux_service_slug ON catalog.services(slug);

-- ── subservices ────────────────────────────────────────────────────
CREATE TABLE catalog.subservices (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id              UUID NOT NULL,
    subservice_name         TEXT NOT NULL,
    description             TEXT NOT NULL,
    has_packages            BOOLEAN NOT NULL DEFAULT FALSE,
    base_price              NUMERIC(12,2) CHECK (base_price >= 0),
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    duration                INTEGER CHECK (duration >= 1),
    image                   TEXT,
    status                  VARCHAR(10) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive')),
    legacy_mongo_id         TEXT,
    deleted_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── subservice_variants (normalized from Mongo embedded array) ─────
CREATE TABLE catalog.subservice_variants (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subservice_id           UUID NOT NULL,
    name                    TEXT NOT NULL,
    price                   NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    duration                INTEGER NOT NULL CHECK (duration >= 1),
    UNIQUE (subservice_id, name)
);

-- ── subservice_packages (normalized from Mongo embedded array) ─────
CREATE TABLE catalog.subservice_packages (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subservice_id           UUID NOT NULL,
    name                    TEXT NOT NULL,
    base_price              NUMERIC(12,2) NOT NULL CHECK (base_price >= 0),
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    duration                INTEGER NOT NULL CHECK (duration >= 1),
    UNIQUE (subservice_id, name)
);

-- ── package_variants (normalized from Mongo nested array) ──────────
CREATE TABLE catalog.package_variants (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id              UUID NOT NULL,
    name                    TEXT NOT NULL,
    price                   NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    duration                INTEGER NOT NULL CHECK (duration >= 1),
    UNIQUE (package_id, name)
);

-- ── service_preparations (normalized from Mongo embedded array) ────
CREATE TABLE catalog.service_preparations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subservice_id           UUID NOT NULL,
    title                   TEXT NOT NULL,
    is_mandatory            BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── coupons ────────────────────────────────────────────────────────
CREATE TABLE catalog.coupons (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    code                    TEXT NOT NULL,
    description             TEXT NOT NULL,
    discount_type           VARCHAR(15) NOT NULL
                            CHECK (discount_type IN ('flat', 'percentage', 'cashback')),
    discount_value          NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    min_order_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    max_discount_limit      NUMERIC(12,2) NOT NULL DEFAULT 0,
    usage_limit             INTEGER NOT NULL DEFAULT 99999,
    per_user_limit          INTEGER NOT NULL DEFAULT 1,
    current_global_usage    INTEGER NOT NULL DEFAULT 0,
    total_budget            NUMERIC(12,2) NOT NULL DEFAULT 100000,
    current_budget_spent    NUMERIC(12,2) NOT NULL DEFAULT 0,
    auto_apply              BOOLEAN NOT NULL DEFAULT FALSE,
    is_featured             BOOLEAN NOT NULL DEFAULT FALSE,
    badge_label             TEXT,
    highlight_gradient      TEXT,
    start_date              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiry_date             TIMESTAMPTZ NOT NULL,
    status                  VARCHAR(10) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive', 'expired')),
    is_first_order_only     BOOLEAN NOT NULL DEFAULT FALSE,
    target_audience         TEXT[] DEFAULT '{all}',
    legacy_mongo_id         TEXT,
    deleted_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global unique: coupon code never reused (redemption history references codes)
CREATE UNIQUE INDEX ux_coupon_code ON catalog.coupons(code);

-- ── coupon join tables (M:N) ───────────────────────────────────────
CREATE TABLE catalog.coupon_allowed_services (
    coupon_id               UUID NOT NULL,
    service_id              UUID NOT NULL,
    PRIMARY KEY (coupon_id, service_id)
);

CREATE TABLE catalog.coupon_allowed_categories (
    coupon_id               UUID NOT NULL,
    category_id             UUID NOT NULL,
    PRIMARY KEY (coupon_id, category_id)
);

CREATE TABLE catalog.coupon_allowed_memberships (
    coupon_id               UUID NOT NULL,
    membership_id           UUID NOT NULL,
    PRIMARY KEY (coupon_id, membership_id)
);

-- ── commissions ────────────────────────────────────────────────────
CREATE TABLE catalog.commissions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id             UUID NOT NULL,
    percentage              NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── memberships ────────────────────────────────────────────────────
CREATE TABLE catalog.memberships (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    price                   NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    duration_days           INTEGER NOT NULL,
    benefits                JSONB NOT NULL DEFAULT '[]',
    status                  VARCHAR(10) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive')),
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── offers ─────────────────────────────────────────────────────────
CREATE TABLE catalog.offers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                   TEXT NOT NULL,
    description             TEXT,
    discount_value          NUMERIC(12,2),
    start_date              TIMESTAMPTZ,
    end_date                TIMESTAMPTZ,
    image                   TEXT,
    status                  VARCHAR(10) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive')),
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── banners ────────────────────────────────────────────────────────
CREATE TABLE catalog.banners (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                   TEXT NOT NULL,
    image                   TEXT,
    link                    TEXT,
    position                INTEGER DEFAULT 0,
    status                  VARCHAR(10) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive')),
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── platform_settings ──────────────────────────────────────────────
CREATE TABLE catalog.platform_settings (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key                     TEXT NOT NULL UNIQUE,
    value                   JSONB NOT NULL,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── time_slot_rules ────────────────────────────────────────────────
CREATE TABLE catalog.time_slot_rules (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id             UUID,
    day_of_week             INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    start_time              TEXT NOT NULL,
    end_time                TEXT NOT NULL,
    multiplier              NUMERIC(4,2) NOT NULL DEFAULT 1.00,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── time_slot_pricing_audits (IMMUTABLE) ───────────────────────────
CREATE TABLE catalog.time_slot_pricing_audits (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id                 UUID NOT NULL,
    field_changed           TEXT NOT NULL,
    old_value               TEXT,
    new_value               TEXT,
    changed_by              UUID,
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── accessories ────────────────────────────────────────────────────
CREATE TABLE catalog.accessories (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    description             TEXT,
    price                   NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    category_id             UUID,
    image                   TEXT,
    status                  VARCHAR(10) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive')),
    legacy_mongo_id         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
