# BharatClap Enterprise — Production Operations & Reliability Runbook

## 1. System Architecture Overview

```
Frontend (Next.js)
        │
        ▼
API Gateway (Port 5000)
(Authentication, Authorization, Rate Limiting, Proxy)
        │
        ▼
Admin Aggregation Service (BFF / Control Plane) (Port 5008)
  ├── clients/         (auth, provider, booking, payment, refund)
  ├── contracts/       (Customer360, Provider360, Dashboard, Finance, Chat)
  ├── services/        (customer360, provider360, dashboard, noc, finance, chat, reports, search)
  ├── controllers/     (customer360, provider360, dashboard, noc, finance, chat, reports, search)
  ├── middlewares/     (requestContext, auth, rbac, auditLogger, rateLimiter, errorHandler)
  └── cache/           (Redis + Memory Store fallback)
```

---

## 2. Microservice Ports Reference

| Microservice | Port | Primary Responsibility |
| :--- | :--- | :--- |
| **API Gateway** | `5000` | Reverse proxy, authentication, rate limiting, route dispatch |
| **Auth Service** | `5001` | User registration, authentication, addresses, customer profiles |
| **Catalog Service** | `5002` | Categories, services, subservices, banners, offers, coupons |
| **Provider Service** | `5003` | Provider profiles, KYC verification, lead packages, wallets |
| **Booking Service** | `5004` | Booking lifecycle, cart, complaints, reviews |
| **Payment Service** | `5005` | Payment gateway integration, transactions, financial adjustments |
| **Notification Service** | `5006` | Push notifications (FCM), SMS (DLT MSG91), email alerts (SMTP) |
| **Refund Service** | `5007` | Refund lifecycle, policy engine, audit logs |
| **Admin Service (BFF)** | `5008` | Admin portal aggregation DTOs, settings, feature flags, NOC telemetry |

---

## 3. Circuit Breaker & Retry Configuration

- **Max Retries**: 2
- **Timeout**: 3000ms
- **Tripping Threshold**: 3 consecutive failures
- **Circuit Open Duration**: 15 seconds
- **Fallback**: Cached DTO / Default Response Envelope

---

## 4. Distributed Tracing & Correlation Header Propagation

Every HTTP request originating from the browser or internal services propagates the following headers:
- `x-correlation-id`: Unique identifier across request call chains (`corr_<timestamp>_<hash>`)
- `x-request-id`: Per-request unique ID (`req_<timestamp>`)
- `x-idempotency-key`: Key for avoiding duplicate mutations during client retries

---

## 5. Health & Observability Probes

- **Liveness Probe**: `GET /health` or `GET /api/v1/admin/health`
- **Readiness Probe**: `GET /ready` or `GET /api/v1/admin/ready` (Performs active health check on Auth, Provider, Booking, Payment, and Refund microservices)
- **Prometheus Metrics**: `GET /metrics` or `GET /api/v1/admin/metrics`

---

## 6. Disaster Recovery & Rollback Procedure

1. **Service Restart Order**:
   - Primary DBs & Cache: MongoDB Primary -> Redis Cluster
   - Core Domain Services: Auth (5001) -> Catalog (5002) -> Provider (5003) -> Booking (5004) -> Payment (5005) -> Notification (5006) -> Refund (5007)
   - BFF Control Plane: Admin Service (5008)
   - Gateway & Frontend: API Gateway (5000) -> Next.js Frontend

2. **Rollback Checklist**:
   - Revert API Gateway proxy routes to stable target version
   - Verify `/ready` probe returns HTTP 200 across all microservices
