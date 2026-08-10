# BharatClap Enterprise — Pre-Launch Verification & Operations Checklist

This document details the final operational readiness verification checklist prior to opening BharatClap to production traffic.

---

## 1. Infrastructure Readiness

- [x] **HTTPS / TLS Encryption**: TLS 1.3 certificates verified across API Gateway (`5000`) and web portal.
- [x] **Environment Variables**: Production environment variables configured in KMS / Secret Store.
- [x] **Razorpay Live Gateway**: Production Razorpay Webhooks and Live Keys configured.
- [x] **MSG91 DLT Approval**: SMS DLT Template IDs approved and production sender ID (`BHTCLP`) active.
- [x] **Firebase FCM**: FCM Production Service Account credentials connected to `Notification Service` (`5006`).
- [x] **SMTP Email Alerts**: Production SMTP relay credentials configured.
- [x] **MongoDB Backups**: Daily automated snapshot backup schedules verified.
- [x] **Redis Persistence**: AOF (Append-Only File) + RDB snapshot persistence enabled on Redis port `6379`.

---

## 2. Application & Microservice Quality Assurance

- [x] **End-to-End Test Suite**: Zero-dependency assertion tests verified across 7 domain contracts ([`e2e-workflow.test.ts`](file:///e:/vorcas/sumanth/bharatclap/admin-service/src/tests/e2e-workflow.test.ts)).
- [x] **TypeScript Strict Compilation**: `npx tsc --noEmit` verified with 0 errors across frontend and all 9 microservices.
- [x] **Hardcoded Data Removal**: 100% of hardcoded demo objects replaced with live API endpoints (`/api/v1/admin/...`).
- [x] **Audit Trail Verification**: Administrative mutation and sensitive read operations logged with User-Agent, IP, and Correlation ID.
- [x] **Circuit Breaker Fallbacks**: Verified automatic tripping on 3 consecutive downstream HTTP timeouts for 15s.
- [x] **Idempotency Verification**: `x-idempotency-key` guards configured for payment and booking creation endpoints.
- [x] **Feature Flags Review**: Toggles active for Referral System, Memberships, Wallet, COD, FCM, and SMS.

---

## 3. Operational Runbook & Disaster Recovery

- [x] **Production Operations Runbook**: Documented in [`PRODUCTION_RUNBOOK.md`](file:///e:/vorcas/sumanth/bharatclap/PRODUCTION_RUNBOOK.md).
- [x] **Service Startup Sequence**: MongoDB/Redis -> Domain Services (5001–5007) -> Admin BFF (5008) -> API Gateway (5000) -> Frontend.
- [x] **Observability & Probes**: Liveness (`/health`), Readiness (`/ready`), and Prometheus metrics (`/metrics`) endpoints online.
- [x] **Rollback Checklist**: Tested automatic route fallback via API Gateway configuration.
