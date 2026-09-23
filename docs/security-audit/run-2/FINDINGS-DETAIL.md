# BharatClap Detailed Findings & Remediation Evidence — Run 2

This document provides trace-by-trace proof of remediation for all findings discovered in Run 1 and verified in Run 2.

---

## 1. Finding: bc-auth-bypass-admin-service-hardcoded-superadmin
- **Prior Severity**: CRITICAL
- **Run 2 Verdict**: REJECTED (REMEDIATED)
- **Component**: `admin-service`
- **Root Cause**: Unconditional injection of `req.user = { id: 'admin_super_01', role: 'super_admin' }` in `admin-service/src/middlewares/authMiddleware.ts`.
- **Code Change Evidence**:
  - `admin-service/src/middlewares/authMiddleware.ts`:
    ```typescript
    export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }
      const token = authHeader.split(' ')[1];
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        res.status(500).json({ message: 'Server configuration error: auth secret not configured' });
        return;
      }
      try {
        const decoded = jwt.verify(token, secret) as any;
        const role = (decoded.role || decoded.admin_role || '').toLowerCase();
        if (!['admin', 'super_admin', 'operations_admin', 'finance_admin', 'support_admin'].includes(role)) {
          res.status(403).json({ message: 'Forbidden: insufficient privileges' });
          return;
        }
        (req as any).user = {
          id: decoded.id || decoded._id || decoded.userId,
          role: role,
          admin_role: decoded.admin_role || role
        };
        next();
      } catch (err: any) {
        res.status(401).json({ message: 'Invalid or expired token' });
      }
    };
    ```
  - `admin-service/src/middlewares/permissionMiddleware.ts`:
    Removed `|| 'super_admin'` fallback; strictly checks permissions from configuration.
  - `api-gateway/src/app.ts`:
    Added `gatewayAdminAuth` middleware before the proxy route to `/api/v1/admin/*`.

---

## 2. Finding: bc-hardcoded-secret-internal-service-key
- **Prior Severity**: HIGH
- **Run 2 Verdict**: REJECTED (REMEDIATED)
- **Component**: `shared`, all microservices, `docker-compose.yml`
- **Root Cause**: Static string `'2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2'` hardcoded across microservices.
- **Code Change Evidence**:
  - `shared/src/middleware/internalAuth.ts`:
    ```typescript
    export const getInternalServiceKey = (): string => {
      return process.env.INTERNAL_SERVICE_KEY || '';
    };

    export const internalAuth = (req: Request, res: Response, next: NextFunction): void => {
      const expectedKey = getInternalServiceKey();
      if (!expectedKey) {
        res.status(500).json({ message: 'Server misconfiguration: internal service key not set' });
        return;
      }
      const providedKey = (req.headers['x-internal-service-key'] as string) || '';
      const expectedBuf = Buffer.from(expectedKey, 'utf8');
      const providedBuf = Buffer.from(providedKey, 'utf8');
      if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
        res.status(403).json({ message: 'Forbidden: invalid or missing internal service key' });
        return;
      }
      next();
    };
    ```
  - All 25+ files updated to import `internalAuth` and `getInternalServiceKey` from `@bharatclap/shared`.
  - `docker-compose.yml` updated to require `${INTERNAL_SERVICE_KEY}`.

---

## 3. Finding: bc-otp-brute-force-reset-password
- **Prior Severity**: HIGH
- **Run 2 Verdict**: REJECTED (REMEDIATED)
- **Component**: `auth-service`, `api-gateway`
- **Root Cause**: Missing attempt limits, expiry checks, and rate limits on password reset OTP verification.
- **Code Change Evidence**:
  - `auth-service/src/controllers/user/verificationController.ts`:
    - Enforced 5-minute expiry (`ageMs > 300000`).
    - Timing-safe HMAC comparison with `crypto.timingSafeEqual`.
    - Atomic attempt tracking pipeline updating `attempts` and marking `status: 'consumed'` when attempts >= 5, returning HTTP 429.
    - Plaintext `otpCode` removed from MongoDB document `$set` operations.
  - `api-gateway/src/app.ts`:
    - Added `/api/users/verify-reset-otp` and `/api/users/reset-password` to `authOtpLimiter`.

---

## 4. Finding: bc-payment-mock-signature-bypass
- **Prior Severity**: HIGH
- **Run 2 Verdict**: REJECTED (REMEDIATED)
- **Component**: `payment-service`, `provider-service`
- **Root Cause**: `isMock` signature bypass and hardcoded fallback secret in payment verification.
- **Code Change Evidence**:
  - `payment-service/src/controllers/paymentController.ts`:
    - Removed `isMock` bypass and mock order creation fallbacks.
    - Removed `'BEx2OBXwYoQI4YHuVIYh7cSB'` fallback; required `process.env.RAZORPAY_KEY_SECRET`.
    - Enforced `crypto.timingSafeEqual` HMAC-SHA256 signature verification.
  - `provider-service/src/controllers/provider/walletController.ts`:
    - Required `process.env.RAZORPAY_KEY_SECRET` and enforced `crypto.timingSafeEqual`.

---

## 5. Finding: bc-privesc-default-support-admin-role
- **Prior Severity**: MEDIUM
- **Run 2 Verdict**: REJECTED (REMEDIATED)
- **Component**: `auth-service`
- **Root Cause**: Defaulting non-admin users to `support_admin` in `req.user.admin_role`.
- **Code Change Evidence**:
  - `auth-service/src/middleware/authMiddleware.ts`:
    ```typescript
    const uRole = user.role as string;
    const isAdmin = uRole === 'admin' || uRole === 'super_admin';
    req.user = {
      _id: user._id.toString(),
      role: user.role,
      admin_role: isAdmin ? (user.admin_role || (uRole === 'super_admin' ? 'super_admin' : 'operations_admin')) : undefined,
      permissions: user.permissions || [],
      name: user.name,
      profile_image: user.profile_image
    };
    ```

---

## 6. Finding: bc-frontend-route-guard-unverified-cookie
- **Prior Severity**: MEDIUM
- **Run 2 Verdict**: REJECTED (REMEDIATED)
- **Component**: `frontend`
- **Root Cause**: Route guard in `frontend/middleware.ts` checked cookie presence without decoding or signature verification.
- **Code Change Evidence**:
  - `frontend/middleware.ts`:
    - Added `parseJwtPayload` and `verifyJwtSignature`.
    - Validates structure, `exp` expiration, and cryptographic signature.
    - Strictly checks `tokenRole` against permitted admin and provider roles.
    - Clears invalid cookies and redirects unauthorized callers.

---

## 7. Finding: bc-mobile-customer-insecure-token-storage
- **Prior Severity**: MEDIUM
- **Run 2 Verdict**: REJECTED (REMEDIATED)
- **Component**: `bharatclapapp/customerapp`
- **Root Cause**: Auth tokens stored in cleartext Android `SharedPreferences`.
- **Code Change Evidence**:
  - `customerapp/pubspec.yaml`: Added `flutter_secure_storage: ^10.3.1`.
  - `customerapp/lib/services/api_service.dart`: Replaced `SharedPreferences` token handling with `FlutterSecureStorage` with automated migration fallback.

---

## 8. Finding: bc-mobile-cleartext-traffic-allowed
- **Prior Severity**: LOW
- **Run 2 Verdict**: REJECTED (REMEDIATED)
- **Component**: `customerapp`, `serviceapp`
- **Root Cause**: `android:usesCleartextTraffic="true"` in Android manifests.
- **Code Change Evidence**:
  - `customerapp/android/app/src/main/AndroidManifest.xml`: Set `android:usesCleartextTraffic="false"`.
  - `serviceapp/android/app/src/main/AndroidManifest.xml`: Set `android:usesCleartextTraffic="false"`.
