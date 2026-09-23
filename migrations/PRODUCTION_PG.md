# BharatClap — PostgreSQL Production Configuration

## Target Version Decision

| Environment   | PostgreSQL | PostGIS | Status       |
| ------------- | ---------- | ------- | ------------ |
| Development   | 18.1       | N/A¹    | ✅ Validated  |
| Staging       | 18.x       | 3.5+    | ⬜ Setup     |
| Production    | 18.x       | 3.5+    | ⬜ Setup     |

> ¹ Local dev strips PostGIS for testing. All `GEOGRAPHY` columns and `GIST` indexes
> are present in the migration SQL but pre-processed out for local validation.

**Decision: PostgreSQL 18 across all environments.**

Do not run:
- local 18 + staging 16 + production 15
- any mixed-version deployment

## PostGIS Installation

### Ubuntu/Debian (production)
```bash
sudo apt-get install postgresql-18-postgis-3
sudo -u postgres psql -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### Docker
```dockerfile
FROM postgis/postgis:18-3.5
```

### Verify
```sql
SELECT PostGIS_Full_Version();
-- Expected: POSTGIS="3.5.x" ...
```

After PostGIS is installed, re-run `000_extensions.sql` **without** the PostGIS stripping:
```bash
psql -U bharatclap_admin -d bharatclap -f migrations/000_extensions.sql
```

## Connection Strings (per service)

```env
# auth-service
DATABASE_URL=postgresql://bharatclap_auth:<password>@<host>:5432/bharatclap

# booking-service
DATABASE_URL=postgresql://bharatclap_booking:<password>@<host>:5432/bharatclap

# provider-service
DATABASE_URL=postgresql://bharatclap_provider:<password>@<host>:5432/bharatclap

# payment-service
DATABASE_URL=postgresql://bharatclap_payment:<password>@<host>:5432/bharatclap

# catalog-service
DATABASE_URL=postgresql://bharatclap_catalog:<password>@<host>:5432/bharatclap

# notification-service
DATABASE_URL=postgresql://bharatclap_notification:<password>@<host>:5432/bharatclap

# migration runner (admin)
DATABASE_URL=postgresql://bharatclap_admin:<password>@<host>:5432/bharatclap

# data migration
DATABASE_URL=postgresql://bharatclap_migrator:<password>@<host>:5432/bharatclap
```

## Production pg_hba.conf

```
# TYPE  DATABASE    USER                  ADDRESS         METHOD
local   bharatclap  bharatclap_admin                      scram-sha-256
host    bharatclap  bharatclap_auth       10.0.0.0/8      scram-sha-256
host    bharatclap  bharatclap_booking    10.0.0.0/8      scram-sha-256
host    bharatclap  bharatclap_provider   10.0.0.0/8      scram-sha-256
host    bharatclap  bharatclap_payment    10.0.0.0/8      scram-sha-256
host    bharatclap  bharatclap_catalog    10.0.0.0/8      scram-sha-256
host    bharatclap  bharatclap_notification 10.0.0.0/8    scram-sha-256
host    bharatclap  bharatclap_migrator   10.0.0.0/8      scram-sha-256
# Deny all other connections
host    all         all                   0.0.0.0/0       reject
```

## Monitoring Queries (pg_stat_statements)

After enabling `pg_stat_statements` in `postgresql.conf`:

```sql
-- Slowest queries
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Most called queries
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;

-- Index usage
SELECT schemaname, relname, indexrelname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname IN ('auth','booking','provider','payment','accounting','catalog','notification')
ORDER BY idx_scan ASC
LIMIT 30;
```
