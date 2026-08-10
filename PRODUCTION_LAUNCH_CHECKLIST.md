# BharatClap — Production Public Launch Runbook & Operational Checklist

> **Purpose:** Operational readiness guide covering Pre-Launch Checklist, Security Audit Verification, Disaster Recovery, Observability, CI/CD Quality Gates, and Standard Operating Procedures (SOPs).

---

## 1. Monorepo Build & Service Health Matrix

| Service | Port | Health Check Endpoint | Readiness Endpoint | Metrics Endpoint | Build Status |
|---|---|---|---|---|---|
| **API Gateway** | `5000` | `GET /health` | `GET /ready` | `GET /metrics` | ✅ **0 Errors** |
| **Auth Service** | `5001` | `GET /health` | `GET /ready` | `GET /metrics` | ✅ **0 Errors** |
| **Catalog Service** | `5002` | `GET /health` | `GET /ready` | `GET /metrics` | ✅ **0 Errors** |
| **Provider Service** | `5003` | `GET /health` | `GET /ready` | `GET /metrics` | ✅ **0 Errors** |
| **Booking Service** | `5004` | `GET /health` | `GET /ready` | `GET /metrics` | ✅ **0 Errors** |
| **Payment Service** | `5005` | `GET /health` | `GET /ready` | `GET /metrics` | ✅ **0 Errors** |
| **Notification Service** | `5006` | `GET /health` | `GET /ready` | `GET /metrics` | ✅ **0 Errors** |
| **Refund Service** | `5007` | `GET /health` | `GET /ready` | `GET /metrics` | ✅ **0 Errors** |
| **Frontend (Next.js)** | `3000` | `GET /api/health` | — | — | ✅ **0 Errors** |

---

## 2. Pre-Launch CI/CD Quality Verification Commands

```bash
# 1. Core Shared Package
cd shared && npm run build

# 2. Backend Services Compilation Verification
cd ../api-gateway && npx tsc
cd ../auth-service && npx tsc
cd ../catalog-service && npx tsc
cd ../provider-service && npx tsc
cd ../booking-service && npx tsc -p tsconfig.build.json
cd ../payment-service && npx tsc
cd ../refund-service && npx tsc
cd ../notification-service && npx tsc

# 3. Next.js Frontend Verification
cd ../frontend && npm run build
```

---

## 3. Operational Runbooks & Standard Operating Procedures (SOPs)

### SOP-01: Payment Gateway Outage / Webhook Delay
1. Incoming payment callbacks store raw payloads in [`WebhookLog`](file:///e:/vorcas/sumanth/bharatclap/payment-service/src/models/WebhookLog.ts).
2. If Razorpay is unresponsive, switch gateway traffic or fallback to Cash on Delivery (COD) / Wallet via `FEATURE_DISABLED` config flag in `@bharatclap/shared`.
3. Re-process delayed webhooks asynchronously using `POST /api/payments/webhook/retry-failed`.

### SOP-02: Monthly Finance Closing
1. Trigger monthly closing via `POST /api/payments/reconciliation/monthly-closing`.
2. Verify GST Summary, TDS Summary, Revenue, and COD Outstanding.
3. Lock period read-only; any subsequent adjustments must use `FinancialAdjustment` entries (`bonus`, `penalty`, `recovery`, `correction`).

### SOP-03: COD Recovery Escalation
1. Automatic 24h & 48h reminders dispatched to provider.
2. If unresolved after 7 days, system auto-freezes settlements and blocks new job dispatches.
3. Admin Operations inspects `GET /api/payments/cod/overview` and approves remittance or executes settlement deduction.

### SOP-04: Emergency Feature Kill-Switch
1. To disable a specific feature (e.g. UPI Links, Instant Settlements) in production without restarting services, set dynamic feature flag in Redis / Shared Config.

---

## 4. Production Launch Checklist

- [x] All 8 microservices and frontend compile with 0 errors.
- [x] AES-256-GCM encryption & PII redaction verified.
- [x] Optimistic concurrency control (`__v`) enabled on financial models.
- [x] Decoupled status architecture (`booking_status`, `dispatch_status`, `payment_status`, `settlement_status`, `paid_via`) active.
- [x] Double-entry journal equality equation (`Debit === Credit`) verified.
- [x] Daily reconciliation and monthly closing crons configured.
- [x] Disaster recovery idempotency keys (`idempotency_key`, `correlation_id`) active across all payment endpoints.
