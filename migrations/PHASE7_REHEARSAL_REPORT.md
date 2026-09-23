# Phase 7 — Rehearsal Report

> **Schema version:** `schema-v1-frozen` (tag `4dfdc3d`)
> **Date:** ___________
> **Operator:** ___________

---

## Gate Results

| # | Gate | Result | Evidence |
|:--|:-----|:-------|:---------|
| 1 | Migration rehearsal | ⬜ PASS / FAIL | |
| 2 | Kill/resume | ⬜ PASS / FAIL | |
| 3 | Retry/idempotency | ⬜ PASS / FAIL | |
| 4 | Redis + fencing | ⬜ PASS / FAIL | |
| 5 | Money audit | ⬜ PASS / FAIL | |
| 6 | EXPLAIN ANALYZE | ⬜ PASS / FAIL | |
| 7 | Backup/restore | ⬜ PASS / FAIL | |
| 8 | Load/pooling | ⬜ PASS / FAIL | |
| 9 | Cutover rehearsal | ⬜ PASS / FAIL | |
| 10 | Rollback rehearsal | ⬜ PASS / FAIL | |

**Overall:** ⬜ READY FOR PRODUCTION / NOT READY

---

## 1. Migration Rehearsal

**Source:** MongoDB snapshot (production-sized)
**Target:** Fresh PostgreSQL 18

| Collection | Mongo Count | PG Count | Match |
|:---|---:|---:|:---:|
| users | | | |
| bookings | | | |
| payments | | | |
| providers | | | |
| settlements | | | |
| wallet_transactions | | | |
| notifications | | | |

| Financial Check | Mongo Total | PG Total | Match |
|:---|---:|---:|:---:|
| Payment gross | | | |
| Payment completed | | | |
| Payment refunded | | | |
| Settlement gross | | | |
| Settlement net | | | |
| Customer wallet balance | | | |
| Provider wallet balance | | | |

| Integrity Check | Expected | Actual |
|:---|:---|:---|
| Wallet balance vs ledger mismatch (query 8) | 0 rows | |
| Unbalanced journals (query 10) | 0 rows | |
| FK violations | 0 | |
| Unexplained failed records | 0 | |

---

## 2. Kill/Resume

**Method:** Kill migration process during batch N

| Step | Expected | Actual |
|:---|:---|:---|
| Batches 1–(N-1) not duplicated | ✅ | |
| Batch N resumes from checkpoint | ✅ | |
| Remaining batches execute | ✅ | |
| Final count matches source | ✅ | |

---

## 3. Retry/Idempotency

| Scenario | Retry Count | Final Effects | Correct |
|:---|---:|---:|:---:|
| Payment + serialization_failure | | 1 | |
| Wallet credit + deadlock | | 1 | |
| Settlement + connection drop | | 1 | |
| Refund + serialization_failure | | 1 | |
| Booking transition + deadlock | | 1 | |

**Confirmed:** `withPgRetry()` retries the whole transaction, not individual statements.

---

## 4. Redis + Fencing

| Step | Expected | Actual |
|:---|:---|:---|
| Worker A acquires lock, token = 10 | ✅ | |
| Redis lease expires | ✅ | |
| Worker B acquires lock, token = 11 | ✅ | |
| Worker B performs operation | ✅ | |
| Worker A wakes, release → Lua returns 0 | ✅ | |
| Worker A write → PG rejects (token 10 < 11) | ✅ | |

---

## 5. Money Audit

**Search results for dangerous patterns:**

```bash
grep -rn "Number(.*amount\|parseFloat(.*amount\|parseInt(.*amount\|\.toFixed(" \
  auth-service/src/ booking-service/src/ payment-service/src/ provider-service/src/
```

| File | Line | Pattern | Risk | Remediation |
|:---|---:|:---|:---|:---|
| | | | | |

---

## 6. EXPLAIN ANALYZE

**Dataset size:** _______ (must be production-scale)

| Query | Plan | Index Used | Rows Estimated vs Actual | Issue |
|:---|:---|:---|:---|:---|
| Customer phone lookup | | | | |
| Provider search | | | | |
| Slot availability | | | | |
| Active bookings | | | | |
| Payment history | | | | |
| Wallet transactions | | | | |
| Settlements | | | | |
| Customer360 | | | | |
| Finance explorer | | | | |

---

## 7. Backup/Restore

| Step | Result |
|:---|:---|
| `pg_dump` completed | |
| Backup size | |
| Destroy test DB | |
| `pg_restore` into fresh DB | |
| Application starts | |
| Smoke tests pass | |
| Financial reconciliation passes | |

---

## 8. Load/Pooling

**Tool:** ___________
**Duration:** ___________
**Concurrent connections:** ___________

| Metric | Value | Threshold | Pass |
|:---|---:|:---|:---:|
| Pool exhaustion events | | 0 | |
| Max waiting connections | | < 10 | |
| Longest transaction (ms) | | < 5000 | |
| Idle-in-transaction count | | 0 | |
| Deadlocks detected | | 0 | |
| CPU peak (%) | | < 80 | |
| Memory peak (%) | | < 80 | |

---

## 9. Cutover Rehearsal

| Step | Result |
|:---|:---|
| Mongo writes frozen | |
| Final delta migration | |
| Count reconciliation | |
| Financial reconciliation | |
| Application switched to PG | |
| Payment smoke test | |
| Refund smoke test | |
| Wallet smoke test | |
| Booking smoke test | |
| Provider payout smoke test | |
| Admin smoke test | |
| Notification smoke test | |

---

## 10. Rollback Rehearsal

| Step | Result |
|:---|:---|
| PG cutover simulated | |
| Problem injected | |
| Writes stopped | |
| PG state preserved (not dropped) | |
| Application rolled back | |
| Mongo failback confirmed | |
| PG writes during cutover reconciled to Mongo | |
| Application operational on Mongo | |

---

## Defects Found

| # | Gate | Description | Severity | Resolution |
|:--|:-----|:-----------|:---------|:-----------|
| | | | | |

---

## Sign-off

| Role | Name | Date | Approved |
|:---|:---|:---|:---:|
| Engineering | | | ⬜ |
| Operations | | | ⬜ |
| Finance | | | ⬜ |
