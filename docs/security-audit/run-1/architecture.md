# System Architecture & Security Model: BharatClap

## 1. Product, Principals & Protected Resources
BharatClap is an on-demand home and local services marketplace operating in India.
- **Customer**: Registers via phone/email and OTP, browses catalogs, creates carts, books services, pays online via Razorpay or cash, verifies booking starts/finishes with OTP, reviews jobs.
- **Service Provider / Partner**: Registers and completes KYC verification, accepts dispatched job leads, marks job travel states (`on_the_way`, `arrived`), verifies customer OTPs to start and finish service, recharges prepay wallet, collects cash remittances, requests payouts.
- **Admin Roles**:
  - `super_admin`: Full system control plane authority.
  - `operations_admin`: Manages users, providers, booking dispatch, and cancellations.
  - `finance_admin`: Manages payments, settlements, wallet reconciliation, disputes, refunds.
  - `support_admin`: Read-only access to customer, provider, and booking records for ticket resolution.
- **Protected Resources**: Customer PII (phone, email, full address history), Provider KYC documents (Aadhaar/PAN, bank account numbers), Financial Ledgers (Razorpay transaction credentials, provider wallet balances, remittances, refund disbursements).

## 2. Comparable-Software Baseline
Comparable platforms include Urban Company and TaskRabbit. These systems isolate multi-tenant customer-provider workflows, enforce strict state machine transitions for service delivery (OTP at doorstep), and isolate internal service-to-service communication behind private VPC meshes or mTLS. BharatClap adopts an API Gateway reverse proxy pattern with distributed microservices communicating over HTTP with shared authorization keys.

## 3. Tech Stack & Deployment Architecture
- **Web Frontend**: Next.js 15, React 19, TailwindCSS, TypeScript (`bharatclap/frontend`).
- **Backend Microservices**: Node.js, Express, TypeScript, Mongoose/MongoDB, Redis (`bharatclap/`):
  - `api-gateway` (Port 5000)
  - `auth-service` (Port 5001)
  - `catalog-service` (Port 5002)
  - `provider-service` (Port 5003)
  - `booking-service` (Port 5004)
  - `payment-service` (Port 5005)
  - `notification-service` (Port 5006)
  - `refund-service` (Port 5007)
  - `admin-service` (Port 5008)
- **Mobile Clients**: Flutter 3.x, Dart (`bharatclapapp/customerapp`, `bharatclapapp/serviceapp`).
- **Data Persistence**: MongoDB 7.x, Redis 6.x.
- **Deployment Model**: Docker Compose orchestration with Cloudflare Tunnel edge ingress.

## 4. Entry Surfaces & Source-to-Sink Paths
1. **Public API Gateway (`:5000`)**:
   - Ingress point for mobile apps and web frontend. Routes `/api/users` -> `auth-service`, `/api/bookings` -> `booking-service`, `/api/payments` -> `payment-service`, `/api/v1/admin` -> `admin-service`.
   - Strips client-supplied `x-internal-service-key`.
2. **Admin Aggregation BFF (`:5008`)**:
   - Ingress for admin dashboard operations. Queries downstream services via Axios HTTP client using `x-internal-service-key`.
3. **External Payment Webhooks**:
   - `/api/payments/webhook` and `/api/payments/razorpay-qr/webhook`: Razorpay HMAC-SHA256 signature verified against webhook payload.
4. **Mobile App Clients**:
   - REST API invocations via Dart `http` / `dio` clients.

## 5. Trust Boundaries & Controls
- **Boundary 1: External Client to API Gateway**:
  - Controlled by Express Rate Limiter, Helmet headers, and CORS origin validation.
- **Boundary 2: Public User to Protected Services**:
  - Controlled by JWT Bearer token authentication in `authMiddleware.ts`.
- **Boundary 3: Tenant Isolation (Customer vs. Provider vs. Admin)**:
  - Controlled by resource ownership checks (`booking.user_id === req.user._id`) and role permission matrices (`PERMISSION_MATRIX`).
- **Boundary 4: Inter-Service Communication (East-West)**:
  - Controlled by `internalAuth` middleware checking `x-internal-service-key`.
- **Boundary 5: Client Storage (Mobile Device to Local System)**:
  - Secure storage for partner credentials (`FlutterSecureStorage`); standard preferences in customer app (`SharedPreferences`).

## 6. Repository-Relative Starting Paths
- `api-gateway/src/app.ts`: Ingress routing, middleware, rate-limiting.
- `auth-service/src/middleware/authMiddleware.ts`: Token verification, role resolution.
- `auth-service/src/controllers/user/verificationController.ts`: OTP lifecycle, password reset.
- `admin-service/src/middlewares/authMiddleware.ts`: Admin authentication.
- `booking-service/src/controllers/booking/`: Booking queries, dispatch, status transitions.
- `payment-service/src/controllers/paymentController.ts`: Payment verification, Razorpay integration.
- `provider-service/src/controllers/provider/walletController.ts`: Provider wallet ledger & recharges.
- `customerapp/lib/services/api_service.dart`: Mobile networking & token storage.
- `serviceapp/lib/services/token_storage.dart`: Partner secure storage.

## 7. Prior Runs & Exclusions
No prior audit ledgers exist for this repository (`prior_status: "none"` across all units). All identified attack surfaces represent first-pass review.

## 8. Companion Selection Rationale
- `WEB-PROTOCOL-AND-AUTH.md`: Required due to JWT authentication, OTP password reset, CORS policies, and cookie handling in Next.js.
- `PROTOCOLS-RPC-AND-MESSAGING.md`: Required due to microservice proxying, internal service headers, and event outbox messaging.
- `DATA-ISOLATION-AND-LIFECYCLE.md`: Required due to multi-tenant customer/provider isolation and booking/wallet balance authorization.
- `CLIENT-SIDE.md` & `DESKTOP-MOBILE-AND-LOCAL-IPC.md`: Required due to Flutter mobile apps, cleartext network traffic, and device token persistence.
- `RESOURCE-EXHAUSTION-AND-AVAILABILITY.md`: Required due to API Gateway rate limiting, regex search indexing, and MongoDB query execution paths.
