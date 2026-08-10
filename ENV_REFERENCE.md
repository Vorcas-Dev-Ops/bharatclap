# BharatClap — Environment Variables Reference

This document lists all environment variables used by BharatClap microservices and API Gateway.

> [!IMPORTANT]
> Never commit actual secret values to version control. Copy `.env.example` to `.env` in each service directory for local development.

---

## Global Common Variables (All Services)

| Variable | Description | Default (Dev) | Required in Prod |
|---|---|---|---|
| `NODE_ENV` | Environment stage (`development`, `production`, `test`) | `development` | Yes |
| `PORT` | HTTP Port for the service | Service specific | Yes |
| `SERVICE_NAME` | Identifier used in structured JSON logs | Service specific | Yes |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/bharatclap` | Yes |
| `REDIS_URL` | Redis connection URL | `redis://127.0.0.1:6379` | Yes |
| `JWT_SECRET` | Secret key for signing JWT access tokens | `dev_jwt_secret_key` | **Yes (32+ chars)** |
| `JWT_REFRESH_SECRET` | Secret key for signing JWT refresh tokens | `dev_jwt_refresh_secret` | **Yes (32+ chars)** |
| `INTERNAL_SERVICE_KEY` | HMAC/API Key for service-to-service internal calls | `default_internal_secret_key` | **Yes** |
| `ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM data encryption | (dev default hex) | **Yes (64 hex chars)** |
| `CORS_ORIGINS` | Comma-separated allowed CORS origins | `*` | **Yes** |

---

## Service-Specific Port Mapping

| Service | Port | Base Proxy Route |
|---|---|---|
| **API Gateway** | `5000` | `/api/*` |
| **Auth Service** | `5001` | `/api/users`, `/api/address`, `/api/locations` |
| **Catalog Service** | `5002` | `/api/categories`, `/api/services`, `/api/coupons`, `/api/settings` |
| **Provider Service** | `5003` | `/api/providers`, `/api/payouts`, `/api/wallets` |
| **Booking Service** | `5004` | `/api/bookings`, `/api/cart`, `/api/admin/dashboard` |
| **Payment Service** | `5005` | `/api/payments` |
| **Notification Service** | `5006` | `/api/notifications`, `/api/reports` |
| **Refund Service** | `5007` | `/api/refunds` |

---

## Service Integrations

### Auth Service & Notification Service (SMS / OTP)
- `MSG91_AUTHKEY` — MSG91 SMS gateway auth key
- `MSG91_TEMPLATE_ID` — OTP SMS template ID

### Payment Service & Refund Service (Razorpay Gateway)
- `RAZORPAY_KEY_ID` — Razorpay API key ID
- `RAZORPAY_KEY_SECRET` — Razorpay API key secret
- `RAZORPAY_WEBHOOK_SECRET` — Secret for verifying Razorpay webhooks

---

## Deployment Secret Injection
When deploying via **Docker Compose** or **Kubernetes**:
1. Inject environment variables via deployment environment or Docker secrets.
2. Ensure `ENCRYPTION_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `INTERNAL_SERVICE_KEY`, and `RAZORPAY_KEY_SECRET` are stored securely.
