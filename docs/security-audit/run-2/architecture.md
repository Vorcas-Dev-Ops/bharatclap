# BharatClap Architecture & Security Posture — Run 2 (Post-Remediation)

## Executive Summary

BharatClap is a multi-sided home services marketplace consisting of an API Gateway, 9 backend Node.js microservices, a Next.js 15 web frontend, and two Flutter mobile applications (`customerapp` and `serviceapp`).

Following the Run 1 security audit which identified 1 Critical, 3 High, 3 Medium, and 2 Low security vulnerabilities, all identified vulnerabilities have been remediated, verified, and re-audited in Run 2.

```
+----------------------------------------------------------------------------------------------------+
|                                    INTERNET (UNTRUSTED CLIENTS)                                    |
|   +--------------------------+  +--------------------------+  +--------------------------------+   |
|   |   Customer Mobile App    |  |    Partner Mobile App    |  |      Next.js Web Frontend      |   |
|   | (FlutterSecureStorage)   |  | (FlutterSecureStorage)   |  | (Edge JWT Verify & RBAC Guard) |   |
|   | (TLS Enforced: no plain) |  | (TLS Enforced: no plain) |  |                                |   |
|   +--------------------------+  +--------------------------+  +--------------------------------+   |
+----------------------------------------------------------------------------------------------------+
                                                |
                                                v HTTPS / TLS
+----------------------------------------------------------------------------------------------------+
|                                         API GATEWAY (Port 5000)                                    |
|  - Strict CORS Allowlist                                                                           |
|  - Strip incoming 'x-internal-service-key' headers from external traffic                          |
|  - Rate Limiting: authOtpLimiter on login, OTP, password reset; globalLimiter on all APIs          |
|  - Defense-in-depth gatewayAdminAuth: Pre-validates Admin JWT signature before proxying            |
|  - Reverse Proxies: /api/v1/admin -> admin-service; /api/users -> auth-service; etc.               |
+----------------------------------------------------------------------------------------------------+
                                                |
                                                v Internal Bridge
+----------------------------------------------------------------------------------------------------+
|                                      BACKEND MICROSERVICES CLUSTER                                 |
|                                                                                                    |
|  +-----------------------------------------------------------------------------------------------+ |
|  | admin-service (5008): Bearer JWT authentication required; role-based RBAC enforced            | |
|  | auth-service (5001): 5-min OTP TTL, 5-attempt lockout (429), plaintext OTP purged              | |
|  | payment-service (5005): Mandatory RAZORPAY_KEY_SECRET, timingSafeEqual HMAC, no mock bypass     | |
|  | provider-service (5003): RAZORPAY_KEY_SECRET required with timingSafeEqual signature check      | |
|  | booking-service (5004), catalog-service (5002), notification-service (5006), refund-service   | |
|  +-----------------------------------------------------------------------------------------------+ |
|                                                |                                                   |
|  All inter-service RPC authenticated via @bharatclap/shared:                                      |
|    - getInternalServiceKey() loaded strictly from runtime environment                              |
|    - ZERO hardcoded default fallback secrets                                                       |
|    - crypto.timingSafeEqual comparison to prevent side-channel leaks                               |
+----------------------------------------------------------------------------------------------------+
```

## Security Boundaries & Controls Established

1. **Administrative Control Plane**:
   - `admin-service/src/middlewares/authMiddleware.ts` extracts Bearer JWT tokens, validates against `JWT_SECRET`, checks token expiration, and populates `req.user`.
   - `admin-service/src/middlewares/permissionMiddleware.ts` verifies explicit roles against `PERMISSIONS_BY_ROLE` without any bypass.
   - `api-gateway/src/app.ts` pre-screens all `/api/v1/admin/*` calls with `gatewayAdminAuth`.

2. **Internal Service Authentication (East-West)**:
   - Centrally implemented in `@bharatclap/shared/src/middleware/internalAuth.ts`.
   - Compares request header against `process.env.INTERNAL_SERVICE_KEY` using `crypto.timingSafeEqual`.
   - `DEFAULT_INTERNAL_KEY` completely removed from all 25+ microservice files.

3. **Account Security**:
   - `auth-service/src/controllers/user/verificationController.ts` enforces 5-minute expiry and 5-attempt atomic lockout on all OTP flows.
   - Plaintext `otpCode` removed from MongoDB document storage.
   - `auth-service/src/middleware/authMiddleware.ts` sets `admin_role: undefined` for customers and providers, preventing privilege escalation.

4. **Payment Integrity**:
   - Mock order generation (`order_mock_...`, `plink_mock_...`) and signature bypasses (`mock_signature`) completely removed.
   - `RAZORPAY_KEY_SECRET` required; timing-safe HMAC validation enforced in `payment-service` and `provider-service`.

5. **Client Security**:
   - `customerapp` stores auth tokens in hardware-backed `FlutterSecureStorage`.
   - `customerapp` and `serviceapp` enforce `usesCleartextTraffic="false"`.
   - Next.js web frontend validates JWT structure, expiration, and role claims in edge middleware.
