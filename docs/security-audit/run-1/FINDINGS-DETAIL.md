# BharatClap Security Audit: Detailed Vulnerability Findings

---

### bc-auth-bypass-admin-service-hardcoded-superadmin
#### Complete Authentication Bypass & Full Super Admin Takeover in Admin Control Plane

- **Verdict**: Confirmed
- **Overall Severity**: **CRITICAL** (Likelihood: Critical, Impact: Critical)
- **Confidence**: High (Verified directly in source code across Gateway proxy rules and service middleware)
- **Impacted Subsystem**: `admin-service` / `api-gateway`
- **Trust Boundary**: Boundary 1 (External Public Internet -> Admin Control Plane)

##### 1. Description & Threat Model
The API Gateway exposes routes starting with `/api/v1/admin/*`, `/api/admin/*`, and `/api/v1/public/*` to external internet traffic and proxies them directly to `ADMIN_SERVICE` on port 5008. In `admin-service/src/middlewares/authMiddleware.ts`, the authentication middleware does not examine the HTTP Authorization header or verify a JWT. Instead, it hardcodes:
```typescript
(req as any).user = {
  id: 'admin_super_01',
  role: 'super_admin',
  name: 'Sumanth Super Admin'
};
```
Subsequently, `admin-service/src/middlewares/permissionMiddleware.ts` verifies permissions by checking if `userRole === 'super_admin'`, which evaluates to `true` for every single request. The caller is treated as a Super Administrator and can invoke all control plane endpoints. When `admin-service` processes requests (e.g. `/api/v1/admin/customers`), it uses its internal service key to query downstream microservices (`auth-service`, `booking-service`, `payment-service`), dumping full customer PII, provider KYC documents, and booking records to unauthenticated external actors.

##### 2. Complete Source Trace
```text
[entrypoint]  api-gateway/src/app.ts:169
              Proxy middleware matches '/api/v1/admin' and routes traffic to ADMIN_SERVICE without token verification.
    │
    ▼
[propagation] admin-service/src/middlewares/authMiddleware.ts:9
              authMiddleware unconditionally sets (req as any).user = { id: 'admin_super_01', role: 'super_admin' }.
    │
    ▼
[propagation] admin-service/src/middlewares/permissionMiddleware.ts:10
              requirePermission bypasses all granular permission checks because userRole === 'super_admin'.
    │
    ▼
[sink]        admin-service/src/clients/auth.client.ts:27
              AuthClient queries auth-service /api/users with internal service key and returns database records.
```

##### 3. Vulnerable vs. Fixed Code
**Vulnerable** (`admin-service/src/middlewares/authMiddleware.ts` lines 8–14):
```typescript
// Default admin payload for internal service routing
(req as any).user = {
  id: 'admin_super_01',
  role: 'super_admin',
  name: 'Sumanth Super Admin'
};

next();
```

**Fixed Code**:
```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication required: missing Bearer token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ success: false, message: 'Server configuration error: JWT_SECRET unset' });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as any;
    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
      return;
    }
    (req as any).user = decoded;
    (req as any).correlationId = (req.headers['x-correlation-id'] as string) || `corr_${Date.now()}`;
    next();
  } catch (err: any) {
    res.status(401).json({ success: false, message: 'Invalid or expired authentication token' });
  }
};
```

---

### bc-cred-hardcoded-internal-service-key-backdoor
#### Hardcoded Internal Service Key Fallback Enabling East-West RPC Forgery

- **Verdict**: Confirmed
- **Overall Severity**: **HIGH** (Likelihood: High, Impact: High)
- **Confidence**: High (Found in 25+ files across backend microservices and docker-compose.yml)
- **Impacted Subsystem**: `shared` / all microservices
- **Trust Boundary**: Boundary 4 (Inter-Service East-West Communication)

##### 1. Description & Threat Model
The static secret `'2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2'` is hardcoded as `DEFAULT_INTERNAL_KEY` in:
- `auth-service/src/middleware/internalAuth.ts:3`
- `booking-service/src/middleware/internalAuth.ts:3`
- `catalog-service/src/middleware/internalAuth.ts:3`
- `provider-service/src/middleware/internalAuth.ts:3`
- `shared/src/routes/logRoutes.ts:4`
- `docker-compose.yml:38, 55, 71, 87, 103, 121, 145`

In `internalAuth.ts`, the authorization logic evaluates:
```typescript
if (!providedKey || (providedKey !== internalKey && providedKey !== DEFAULT_INTERNAL_KEY))
```
Because the condition explicitly checks `&& providedKey !== DEFAULT_INTERNAL_KEY`, supplying this static key bypasses internal authentication even if the system administrator sets a new `INTERNAL_SERVICE_KEY` in production environment variables. Combined with `docker-compose.yml` exposing ports 5001–5008 to `0.0.0.0`, any party on the network or capable of triggering an HTTP request can call internal endpoints (such as `/api/bookings/internal/:id/assign`, `/api/bookings/batch`, or `/api/providers/internal/*`).

##### 2. Complete Source Trace
```text
[entrypoint]  auth-service/src/middleware/internalAuth.ts:12
              Middleware extracts x-internal-service-key header.
    │
    ▼
[propagation] auth-service/src/middleware/internalAuth.ts:14
              Evaluates providedKey against DEFAULT_INTERNAL_KEY fallback constant.
    │
    ▼
[sink]        booking-service/src/routes/bookingRoutes.ts:71
              Accepts internal request and performs privileged database state mutation.
```

##### 3. Vulnerable vs. Fixed Code
**Vulnerable** (`auth-service/src/middleware/internalAuth.ts` lines 3–17):
```typescript
const DEFAULT_INTERNAL_KEY = '2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2';

export const internalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const internalKey = process.env.INTERNAL_SERVICE_KEY || DEFAULT_INTERNAL_KEY;
  const providedKey = req.headers['x-internal-service-key'];

  if (!providedKey || (providedKey !== internalKey && providedKey !== DEFAULT_INTERNAL_KEY)) {
    res.status(403).json({ message: 'Forbidden: invalid or missing internal service key' });
    return;
  }
  next();
};
```

**Fixed Code**:
```typescript
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const internalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const internalKey = process.env.INTERNAL_SERVICE_KEY;
  if (!internalKey || internalKey.length < 32) {
    res.status(500).json({ message: 'Server configuration error: INTERNAL_SERVICE_KEY missing or weak' });
    return;
  }

  const providedKey = req.headers['x-internal-service-key'];
  if (typeof providedKey !== 'string') {
    res.status(403).json({ message: 'Forbidden: missing x-internal-service-key header' });
    return;
  }

  const bufProvided = Buffer.from(providedKey, 'utf8');
  const bufExpected = Buffer.from(internalKey, 'utf8');

  if (bufProvided.length !== bufExpected.length || !crypto.timingSafeEqual(bufProvided, bufExpected)) {
    res.status(403).json({ message: 'Forbidden: invalid internal service key' });
    return;
  }

  next();
};
```

---

### bc-auth-otp-unthrottled-password-reset-bruteforce
#### Account Takeover via Unthrottled Password Reset OTP Verification

- **Verdict**: Confirmed
- **Overall Severity**: **HIGH** (Likelihood: High, Impact: High)
- **Confidence**: High (Source discrepancy between login OTP and reset OTP verified)
- **Impacted Subsystem**: `auth-service` / `api-gateway`
- **Trust Boundary**: Boundary 2 (Authentication / Password Recovery)

##### 1. Description & Threat Model
In `auth-service/src/controllers/user/verificationController.ts`, when a user logs in via OTP (`verifyOtp`), failed attempts are tracked atomically using MongoDB update pipelines and locked out after 5 failures. In contrast, `verifyResetOtp` (used in Step 2 of Password Reset) performs an HMAC check on line 398 but never updates the database on mismatch:
```typescript
if (expectedBuf.length !== submittedBuf.length || !crypto.timingSafeEqual(expectedBuf, submittedBuf)) {
  res.status(400).json({ message: 'Invalid OTP code.' });
  return;
}
```
Furthermore, `api-gateway/src/app.ts` attaches `authOtpLimiter` to `/api/users/login`, `/api/users/send-otp`, `/api/users/verify-otp`, and `/api/users/forgot-password`, but fails to include `/api/users/verify-reset-otp`. An attacker targeting a known user email can trigger a reset via `forgot-password`, then execute an automated brute-force attack against `/api/users/verify-reset-otp` to guess the 6-digit OTP code without triggering any lockout or rate limiting. Once verified, the attacker calls `/api/users/reset-password` with the discovered OTP and a new password, taking over the account.

##### 2. Complete Source Trace
```text
[entrypoint]  auth-service/src/controllers/user/verificationController.ts:380
              verifyResetOtp accepts email and candidate OTP guess.
    │
    ▼
[propagation] auth-service/src/controllers/user/verificationController.ts:398
              crypto.timingSafeEqual fails on wrong guess; returns HTTP 400 without incrementing attempts or burning the OTP.
    │
    ▼
[sink]        auth-service/src/controllers/user/verificationController.ts:412
              resetPassword consumes valid OTP and sets new password hash on User model.
```

##### 3. Vulnerable vs. Fixed Code
**Vulnerable** (`verificationController.ts` lines 398–402):
```typescript
if (expectedBuf.length !== submittedBuf.length || !crypto.timingSafeEqual(expectedBuf, submittedBuf)) {
  res.status(400).json({ message: 'Invalid OTP code.' });
  return;
}
```

**Fixed Code**:
```typescript
if (expectedBuf.length !== submittedBuf.length || !crypto.timingSafeEqual(expectedBuf, submittedBuf)) {
  // Atomically increment attempts and consume after 5 failures
  const updatedOtp = await Otp.findOneAndUpdate(
    { _id: otpRecord._id, status: 'active' },
    [
      { $set: { attempts: { $add: ['$attempts', 1] } } },
      {
        $set: {
          status: { $cond: [{ $gte: ['$attempts', 5] }, 'consumed', 'active'] },
          consumedAt: { $cond: [{ $gte: ['$attempts', 5] }, new Date(), '$$REMOVE'] }
        }
      }
    ],
    { new: true }
  );

  if (updatedOtp?.status === 'consumed') {
    res.status(429).json({ message: 'Too many failed attempts. Please request a new OTP.' });
    return;
  }

  const remaining = Math.max(0, 5 - (updatedOtp?.attempts || 0));
  res.status(400).json({ message: `Invalid OTP code. (${remaining} attempts remaining)` });
  return;
}
```

---

### bc-crypto-razorpay-mock-signature-and-hardcoded-secret
#### Razorpay Mock Signature Bypass & Hardcoded Secret Key Fallback

- **Verdict**: Confirmed
- **Overall Severity**: **HIGH** (Likelihood: Medium, Impact: High)
- **Confidence**: High (Source inspection of payment verification logic)
- **Impacted Subsystem**: `payment-service` / `provider-service`
- **Trust Boundary**: Boundary 3 (Financial Integrity / Payment Gateway Verification)

##### 1. Description & Threat Model
In `payment-service/src/controllers/paymentController.ts` lines 193–208, payment verification contains a mock bypass:
```typescript
const isMock = (razorpay_order_id.startsWith('order_mock_') || razorpay_signature === 'mock_signature')
  && process.env.NODE_ENV !== 'production';
```
In any deployment where `NODE_ENV` is unset or set to development/staging, clients can bypass Razorpay HMAC verification by supplying `mock_signature`. Additionally:
`process.env.RAZORPAY_KEY_SECRET || 'BEx2OBXwYoQI4YHuVIYh7cSB'`
If `RAZORPAY_KEY_SECRET` is unset, the system defaults to a committed key. In `provider-service/src/controllers/provider/walletController.ts:68`, `RAZORPAY_KEY_SECRET` defaults to an empty string `''`, and compares signatures using non-constant-time string inequality (`!==`).

##### 2. Proposed Fix
1. Remove all mock signature bypasses from production controller routes.
2. Require non-empty `RAZORPAY_KEY_SECRET` at server boot.
3. Enforce `crypto.timingSafeEqual` in `provider-service`.

---

### bc-authz-admin-role-default-support-admin-escalation
#### Privilege Escalation via Default support_admin Role Assignment

- **Verdict**: Confirmed
- **Overall Severity**: **MEDIUM** (Likelihood: Medium, Impact: Medium)
- **Confidence**: High (Logic flaw in ternary operator)
- **Impacted Subsystem**: `auth-service`
- **Trust Boundary**: Boundary 3 (Role-Based Authorization)

##### 1. Description
In `auth-service/src/middleware/authMiddleware.ts` line 117:
```typescript
admin_role: user.admin_role || (uRole === 'admin' || uRole === 'super_admin' ? 'super_admin' : 'support_admin')
```
For regular customers and providers, `user.admin_role` is null and `uRole` is `'customer'`. The ternary operator evaluates the false branch, populating `req.user.admin_role = 'support_admin'`. If an endpoint calls `protect` and `checkPermission` without preceding it with the `admin` middleware, `hasPermission` grants permissions assigned to `support_admin` in `PERMISSION_MATRIX`.

##### 2. Proposed Fix
```typescript
admin_role: (uRole === 'admin' || uRole === 'super_admin') ? (user.admin_role || 'super_admin') : undefined
```

---

### bc-mobile-customerapp-unencrypted-token-shared-preferences
#### Cleartext Authentication Token Storage in Customer Mobile App

- **Verdict**: Confirmed
- **Overall Severity**: **MEDIUM** (Likelihood: Low, Impact: Medium)
- **Confidence**: High (Source inspection of customerapp vs serviceapp)
- **Impacted Subsystem**: `customerapp` (Mobile)
- **Trust Boundary**: Boundary 5 (Client Device Data Storage)

##### 1. Description
`customerapp/lib/services/api_service.dart` stores JWT tokens in plain text using `SharedPreferences`:
```dart
static Future<void> saveToken(String token) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_tokenKey, token);
}
```
Tokens stored in `SharedPreferences` are written unencrypted to `/data/data/com.bharatclap.customer/shared_prefs/FlutterSharedPreferences.xml`. In contrast, `serviceapp/lib/services/token_storage.dart` correctly uses `FlutterSecureStorage`.

##### 2. Proposed Fix
Replace `SharedPreferences` with `FlutterSecureStorage` in `customerapp` to store authentication credentials in Android Keystore / iOS Keychain.

---

### bc-mobile-global-cleartext-traffic-enabled
#### Global Insecure Cleartext HTTP Traffic Enabled on Android

- **Verdict**: Confirmed
- **Overall Severity**: **MEDIUM** (Likelihood: Low, Impact: Medium)
- **Confidence**: High (Direct AndroidManifest inspection)
- **Impacted Subsystem**: `customerapp` & `serviceapp`
- **Trust Boundary**: Boundary 1 (Mobile Network Transport)

##### 1. Description
Both `customerapp/android/app/src/main/AndroidManifest.xml` (line 8) and `serviceapp/android/app/src/main/AndroidManifest.xml` (line 10) declare `android:usesCleartextTraffic="true"`. This globally permits unencrypted HTTP transmission, exposing customer addresses, partner live locations, and authorization tokens to MITM interception.

##### 2. Proposed Fix
Set `android:usesCleartextTraffic="false"`. If local development against `10.0.2.2` is required, scope exceptions via a debug-only `network_security_config.xml`.

---

### bc-web-nextjs-cookie-presence-route-guard-bypass
#### Next.js Route Middleware Bypassed via Dummy Cookie Presence

- **Verdict**: Confirmed
- **Overall Severity**: **LOW** (Likelihood: Medium, Impact: Low)
- **Confidence**: High (Next.js middleware code inspection)
- **Impacted Subsystem**: `frontend` (Web)
- **Trust Boundary**: Boundary 1 (Web Route Guards)

##### 1. Description
`frontend/middleware.ts` guards `/admin/*`, `/provider/*`, and `/user/*` by checking `if (isProtectedRoute && !token)`. It checks only for the presence of a non-empty string in the `token` cookie without cryptographic verification. Setting `document.cookie="token=dummy"` bypasses the redirect and renders administrative dashboard layouts.

##### 2. Proposed Fix
Verify JWT signatures in Edge Middleware using `jose.jwtVerify()` or enforce authentication guards inside server component page layouts.

---

### bc-db-plaintext-otp-storage-mongodb
#### Storage of Plaintext OTP Codes in MongoDB Collection

- **Verdict**: Confirmed
- **Overall Severity**: **LOW** (Likelihood: Low, Impact: Medium)
- **Confidence**: High (Mongoose update query inspection)
- **Impacted Subsystem**: `auth-service`
- **Trust Boundary**: Boundary 3 (Database Persistence)

##### 1. Description
In `auth-service/src/controllers/user/verificationController.ts` lines 98 and 338, OTP creation computes `otpHash = hashOtp(otpCode, identifier)` but persists both `otpHash` and plaintext `otpCode` to the MongoDB document. Storing the plaintext code negates the benefit of peppered HMAC hashing if the database is read or leaked.

##### 2. Proposed Fix
Remove `otpCode` from the update payload and model schema, persisting solely `otpHash`.
