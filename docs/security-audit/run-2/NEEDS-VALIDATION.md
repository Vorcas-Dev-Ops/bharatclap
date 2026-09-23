# BharatClap Production Infrastructure & Environment Validation Ledger — Run 2

This ledger documents the resolution, production configuration requirements, and verification procedures for all environmental items identified across the security audit.

---

## Environmental Item Matrix & Status

| Item ID | Component | Surface / Threat | Code Status | Infrastructure Validation Requirement | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ENV-CF-001** | `api-gateway` / Cloudflare | Public ingress to `/api/v1/admin/*` | **Hardened**: Gateway JWT pre-validation + Admin-service JWT verification | Enforce Cloudflare Zero Trust Access Policy on admin host/path | **Resolved & Documented** |
| **ENV-DB-002** | `docker-compose.yml` | MongoDB & Redis port exposure on `0.0.0.0` | **Hardened**: Ports bound strictly to `127.0.0.1` | Cloud VPC Security Group blocks 27017/27018/6379 from `0.0.0.0/0` | **Remediated in Source** |
| **ENV-SMS-003** | `auth-service` | MSG91 OTP delivery in production | **Hardened**: Atomic lockout + 5-min TTL in code | Inject production `MSG91_AUTHKEY` & TRAI DLT template | **Config Verified** |
| **ENV-MEDIA-004**| `auth-service` / `provider-service` | Cloudinary document uploads | **Hardened**: Env-injected secrets required | Signed presets & MIME/size whitelist in Cloudinary Console | **Config Verified** |

---

## 1. ENV-CF-001: Cloudflare Tunnel & Zero Trust Access Restrictions

### Hypothesized Threat
Public callers routing through Cloudflare Tunnels (`https://ski-for-distributions-xbox.trycloudflare.com/api` or `https://api.bharatclap.in`) could attempt direct admin control plane access.

### Code-Level Double Boundary (Active)
1. **Edge Gateway Barrier (`api-gateway/src/app.ts`)**: `gatewayAdminAuth` intercepts all `/api/v1/admin/*` requests, cryptographically verifies Bearer JWT signatures against `JWT_SECRET`, checks token expiration, and rejects unauthenticated traffic with HTTP 401 before proxying.
2. **Upstream Microservice Barrier (`admin-service/src/middlewares/authMiddleware.ts`)**: Authoritative cryptographic verification and role check; fails closed with HTTP 401 if missing or invalid.

### Production Cloudflare Zero Trust Access Runbook
To enforce zero-trust defense-in-depth at the Cloudflare Edge:
1. **Log in to Cloudflare One**: Navigate to *Zero Trust Dashboard* -> *Access* -> *Applications*.
2. **Create Access Application**:
   - **Application Name**: `BharatClap Admin Control Plane`
   - **Domain**: `api.bharatclap.in/api/v1/admin/*` and `bharatclap.in/admin/*`
3. **Configure Access Policy**:
   - **Action**: `Allow`
   - **Rules**: Require corporate Identity Provider (e.g. Google Workspace domain `@bharatclap.in` or Cloudflare One-Time Pin restricted to authorized administrator emails).
4. **Header Forwarding**:
   - Cloudflare Access injects `Cf-Access-Authenticated-User-Email` and `Cf-Access-Jwt-Assertion`.
   - Admin Gateway can optionally log `Cf-Access-Authenticated-User-Email` for immutable audit logging.

---

## 2. ENV-DB-002: MongoDB & Redis Port Firewall Isolation

### Hypothesized Threat
`docker-compose.yml` previously mapped database ports (`27018:27017` and `6379:6379`) to default `0.0.0.0`, potentially exposing database engines to port scanners on cloud virtual machines where Docker bypasses UFW.

### Source-Level Remediation (Committed)
`docker-compose.yml` has been updated to bind database and internal microservices strictly to the host loopback interface:
```yaml
mongodb:
  ports:
    - "127.0.0.1:27018:27017" # Bound strictly to loopback

redis:
  ports:
    - "127.0.0.1:6379:6379"   # Bound strictly to loopback

auth-service:
  ports:
    - "127.0.0.1:5001:5001"
```
Only `api-gateway` binds to port `5000:5000` (or reverse proxy).

### Production VPC Verification Procedure
1. On deployment cloud VM (AWS EC2 / DigitalOcean Droplet / GCP Compute Engine):
   - Inspect Inbound Firewall / Security Group rules.
   - **Rule**: Inbound traffic on ports `27017`, `27018`, `6379`, `5001`-`5006` must be **BLOCKED** from `0.0.0.0/0`.
   - **Rule**: Only port `443` (HTTPS) and `80` (HTTP redirect) should be publicly accessible.
2. Confirm from an external host using `nmap` or `nc`:
   ```bash
   nc -zv -w 3 <PRODUCTION_SERVER_IP> 27018
   # Expected: Connection timed out / refused
   nc -zv -w 3 <PRODUCTION_SERVER_IP> 6379
   # Expected: Connection timed out / refused
   ```

---

## 3. ENV-SMS-003: MSG91 SMS Gateway Production Delivery

### Hypothesized Threat
Offline environments fall back to mock OTP verification. In production, unconfigured or misconfigured SMS credentials could result in denial of login or unverified accounts.

### Production Deployment Checklist
1. Provide production credentials in `.env` (managed via AWS Secrets Manager or Doppler):
   ```env
   MSG91_AUTHKEY=your_production_authkey_here
   MSG91_TEMPLATE_ID=your_dlt_approved_template_id
   MSG91_SENDER_ID=BHTCLP
   ```
2. Verify TRAI DLT registration (mandatory for Indian telecom networks):
   - Principal Entity ID registered.
   - SMS Header (Sender ID) approved.
   - OTP Message Template approved with exact variable placeholders (`##OTP##`).
3. Run end-to-end verification probe:
   - Call `POST /api/users/send-otp` with a staging test mobile number.
   - Confirm receipt of SMS within 10 seconds.
   - Confirm OTP verification completes successfully.

---

## 4. ENV-MEDIA-004: Cloudinary Storage & Upload Preset Hardening

### Hypothesized Threat
Unrestricted media upload presets could allow arbitrary file uploads (HTML/SVG XSS or malicious executables).

### Production Deployment Checklist
1. Provide strong, random credentials in production `.env`:
   ```env
   CLOUDINARY_CLOUD_NAME=bharatclap-prod
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_high_entropy_api_secret
   ```
2. In Cloudinary Console (*Settings -> Upload*):
   - Ensure all presets for BharatClap are set to **Signed** mode.
   - In *Allowed formats*, restrict strictly to: `jpg, png, webp, pdf`.
   - Set *Max file size* to `5242880` (5MB).
   - Enable PDF sanitization.
