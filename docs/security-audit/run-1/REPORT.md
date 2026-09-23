# BharatClap Security Audit Report

**Date**: 2026-09-21  
**Audit Standard**: Cloudflare `security-audit-skill` (Standard Profile)  
**Targets Evaluated**:
- Web & Microservices: `e:/vorcas/sumanth/bharatclap` (Commit `21bbaa0d7a51d68b2aac5a7d0cc80805db0fcd11`)
- Mobile Apps: `e:/vorcas/sumanth/bharatclapapp` (Commit `81890d46d3cb9c470bcac3e67dec2157e7bbcb68`)

---

## Executive Summary

A comprehensive source-grounded security audit was conducted across the **BharatClap** ecosystem, spanning the public API Gateway, 9 backend microservices (`auth-service`, `booking-service`, `catalog-service`, `payment-service`, `provider-service`, `refund-service`, `notification-service`, `admin-service`, and `shared`), the Next.js 15 web application, and both Flutter mobile applications (`customerapp` and `serviceapp`).

The review identified **1 Critical**, **3 High**, **3 Medium**, and **2 Low** confirmed vulnerabilities, alongside **2 architectural hypotheses** requiring external production environment verification.

The most severe finding (**bc-auth-bypass-admin-service-hardcoded-superadmin**) permits any anonymous user on the public internet to bypass authentication and gain full Super Admin privileges over the administrative control plane, exposing all customer profiles, service provider documents, booking histories, and financial metrics. Furthermore, hardcoded fallback keys and unthrottled password reset OTP verification pose immediate risks of account takeover and internal RPC forgery.

---

## Vulnerability Summary & Severity Metrics

| Severity | Count | Summary |
|---|:---:|---|
| **Critical** | 1 | Complete Admin Control Plane Authentication Bypass (Hardcoded Super Admin Context) |
| **High** | 3 | Hardcoded Internal Service Key Backdoor; Unthrottled Password Reset OTP Brute-Force; Razorpay Mock Bypass & Hardcoded Secret |
| **Medium** | 3 | Privilege Escalation via Support Admin Defaulting; Unencrypted Mobile Session Storage; Global Cleartext Mobile HTTP Transport |
| **Low** | 2 | Plaintext OTP Stored in MongoDB; Next.js Cookie Presence Route Guard Bypass |
| **Needs Validation** | 2 | Cloudflare Tunnel Ingress WAF Configuration; MongoDB/Redis Public Network Binding |

---

## Confirmed Findings Summary Table

| Fingerprint | Severity | Subsystem | Vulnerability Title | Primary Location |
|---|:---:|---|---|---|
| [`bc-auth-bypass-admin-service-hardcoded-superadmin`](FINDINGS-DETAIL.md#bc-auth-bypass-admin-service-hardcoded-superadmin) | **CRITICAL** | `admin-service` | Complete Authentication Bypass & Full Super Admin Takeover | `admin-service/src/middlewares/authMiddleware.ts:9` |
| [`bc-cred-hardcoded-internal-service-key-backdoor`](FINDINGS-DETAIL.md#bc-cred-hardcoded-internal-service-key-backdoor) | **HIGH** | `microservices` | Hardcoded Internal Service Key Fallback Enabling RPC Forgery | `auth-service/src/middleware/internalAuth.ts:3` |
| [`bc-auth-otp-unthrottled-password-reset-bruteforce`](FINDINGS-DETAIL.md#bc-auth-otp-unthrottled-password-reset-bruteforce) | **HIGH** | `auth-service` | Account Takeover via Unthrottled Password Reset OTP Verification | `auth-service/src/controllers/user/verificationController.ts:380` |
| [`bc-crypto-razorpay-mock-signature-and-hardcoded-secret`](FINDINGS-DETAIL.md#bc-crypto-razorpay-mock-signature-and-hardcoded-secret) | **HIGH** | `payment-service` | Razorpay Mock Signature Bypass & Hardcoded Secret Key Fallback | `payment-service/src/controllers/paymentController.ts:193` |
| [`bc-authz-admin-role-default-support-admin-escalation`](FINDINGS-DETAIL.md#bc-authz-admin-role-default-support-admin-escalation) | **MEDIUM** | `auth-service` | Privilege Escalation via Default support_admin Role Assignment | `auth-service/src/middleware/authMiddleware.ts:117` |
| [`bc-mobile-customerapp-unencrypted-token-shared-preferences`](FINDINGS-DETAIL.md#bc-mobile-customerapp-unencrypted-token-shared-preferences) | **MEDIUM** | `customerapp` | Cleartext Authentication Token Storage in Customer Mobile App | `customerapp/lib/services/api_service.dart:95` |
| [`bc-mobile-global-cleartext-traffic-enabled`](FINDINGS-DETAIL.md#bc-mobile-global-cleartext-traffic-enabled) | **MEDIUM** | `mobile` | Global Insecure Cleartext HTTP Traffic Enabled on Android | `customerapp/android/app/src/main/AndroidManifest.xml:8` |
| [`bc-web-nextjs-cookie-presence-route-guard-bypass`](FINDINGS-DETAIL.md#bc-web-nextjs-cookie-presence-route-guard-bypass) | **LOW** | `frontend` | Next.js Route Middleware Bypassed via Dummy Cookie Presence | `frontend/middleware.ts:36` |
| [`bc-db-plaintext-otp-storage-mongodb`](FINDINGS-DETAIL.md#bc-db-plaintext-otp-storage-mongodb) | **LOW** | `auth-service` | Storage of Plaintext OTP Codes in MongoDB Collection | `auth-service/src/controllers/user/verificationController.ts:98` |

---

## Coverage Statement

- **Deterministic Units Audited**: 12 units mapped across 5 trust boundaries, 11 subsystems, and 7 attack classes.
- **Coverage Status**: 100% of planned units reviewed and closed (9 candidate units confirmed, 3 core units validated as cleanly covered with robust defenses).
- **Subsystems Reviewed**:
  - `api-gateway`: Route proxying, request header stripping, rate limiting, and CORS configuration.
  - `auth-service`: OTP generation, hashing, verification pipelines, password reset workflows, and RBAC matrix.
  - `admin-service`: Aggregation endpoints, middleware authentication, downstream RPC clients.
  - `booking-service`: State transition validation, customer/provider ownership gates, internal batch endpoints.
  - `payment-service`: Razorpay order generation, HMAC verification, webhook timing-safe signature checking.
  - `provider-service`: Wallet ledger mutations, recharge verification, cash collection remittances.
  - `frontend`: Next.js edge route guards, cookie extraction, client-side session handlers.
  - `customerapp` & `serviceapp`: Mobile storage, Dart HTTP clients, Android manifests.

---

## Priority Remediation Roadmap

### Immediate Priority (P0 — Within 24 Hours)
1. **Fix Admin Control Plane Authentication**:
   Remove hardcoded `super_admin` injection in `admin-service/src/middlewares/authMiddleware.ts`. Enforce JWT token verification against `JWT_SECRET` and require admin role checks on all routes.
2. **Purge Hardcoded Internal Key Backdoor**:
   Remove `DEFAULT_INTERNAL_KEY = '2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2'` across all 25+ microservice files. Require `INTERNAL_SERVICE_KEY` from environment variables, and fail closed if missing.
3. **Lock Down Password Reset OTP Verification**:
   Add atomic attempt counting (max 5 attempts) to `POST /api/users/verify-reset-otp` in `auth-service`, and add the route to `authOtpLimiter` in `api-gateway`.

### High Priority (P1 — Within 7 Days)
4. **Enforce Payment Secrets & Remove Mock Bypass**:
   Remove `order_mock_` / `mock_signature` bypasses from `paymentController.ts`. Require `RAZORPAY_KEY_SECRET` at server boot without fallback to hardcoded keys.
5. **Secure Customer Mobile Storage**:
   Migrate `customerapp` from `SharedPreferences` to `FlutterSecureStorage` (Android Keystore / iOS Keychain).
6. **Disable Cleartext Traffic on Mobile**:
   Set `android:usesCleartextTraffic="false"` in both Android application manifests.
7. **Correct Admin Role Defaulting**:
   Ensure `auth-service/src/middleware/authMiddleware.ts` leaves `admin_role` undefined for `customer` and `provider` users.

### Hardening (P2 — Next Sprint)
8. **Remove Plaintext OTP Database Fields**:
   Delete `otpCode` persistence from MongoDB update queries in `auth-service`.
9. **Upgrade Web Edge Route Guards**:
   Verify cryptographic JWT signatures in Next.js middleware using `jose` or web crypto.
