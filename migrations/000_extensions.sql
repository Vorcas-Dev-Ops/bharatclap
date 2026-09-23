-- 000_extensions.sql
-- BharatClap PostgreSQL Migration
-- Extensions required before schema creation

-- gen_random_uuid() is built-in on PG 14+, no uuid-ossp needed
CREATE EXTENSION IF NOT EXISTS postgis;   -- geospatial (provider locations, addresses)
CREATE EXTENSION IF NOT EXISTS citext;    -- case-insensitive email
