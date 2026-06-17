import express, { Request, Response } from 'express';
import cors from 'cors';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Build allowed origin set from CORS_ORIGINS env var (comma-separated).
// Example: CORS_ORIGINS=http://localhost:3000,https://bharatclap.in
const rawOrigins = process.env.CORS_ORIGINS || '';
if (!rawOrigins) {
  console.warn('[CORS] ⚠️  CORS_ORIGINS is not set — all cross-origin requests will be blocked. Set CORS_ORIGINS in your environment.');
}
const allowedOrigins = new Set(
  rawOrigins.split(',').map((o) => o.trim()).filter(Boolean)
);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no Origin header (server-to-server, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin '${origin}' is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Increase body size limit for large payloads like base64 logo images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP Request Logger
app.use((req, res, next) => {
  console.log(`[API-GATEWAY] ${req.method} ${req.url}`);
  next();
});

const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
const CATALOG_SERVICE = process.env.CATALOG_SERVICE_URL || 'http://localhost:5002';
const PROVIDER_SERVICE = process.env.PROVIDER_SERVICE_URL || 'http://localhost:5003';
const BOOKING_SERVICE = process.env.BOOKING_SERVICE_URL || 'http://localhost:5004';
const PAYMENT_SERVICE = process.env.PAYMENT_SERVICE_URL || 'http://localhost:5005';
const NOTIFICATION_SERVICE = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5006';

// ----------------------------------------------------
// 1. AUTH SERVICE PROXIES (Port 5001)
// ----------------------------------------------------
app.use(createProxyMiddleware({
  pathFilter: '/api/users',
  target: AUTH_SERVICE,
  changeOrigin: true,
  on: {
    proxyReq: fixRequestBody
  }
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/locations',
  target: AUTH_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/addresses',
  target: AUTH_SERVICE,
  changeOrigin: true,
  proxyTimeout: 30000, // 30s timeout to prevent indefinite proxy hang
  pathRewrite: {
    '^/api/addresses': '/api/address'
  },
  on: {
    proxyReq: fixRequestBody
  }
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/address',
  target: AUTH_SERVICE,
  changeOrigin: true,
  on: {
    proxyReq: fixRequestBody
  }
}));

// ----------------------------------------------------
// 2. CATALOG SERVICE PROXIES (Port 5002)
// ----------------------------------------------------
app.use(createProxyMiddleware({
  pathFilter: '/api/categories',
  target: CATALOG_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/services',
  target: CATALOG_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/sub-services',
  target: CATALOG_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/banners',
  target: CATALOG_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/offers',
  target: CATALOG_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/admin/coupons',
  target: CATALOG_SERVICE,
  changeOrigin: true,
  pathRewrite: {
    '^/api/admin/coupons': '/api/coupons'
  }
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/coupons',
  target: CATALOG_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/memberships',
  target: CATALOG_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/commissions',
  target: CATALOG_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/settings',
  target: CATALOG_SERVICE,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq: any, req: any) => {
      if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    }
  }
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/timeslot-rules',
  target: CATALOG_SERVICE,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq: any, req: any) => {
      if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    }
  }
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/accessories',
  target: CATALOG_SERVICE,
  changeOrigin: true,
  on: {
    proxyReq: fixRequestBody
  }
}));

// ----------------------------------------------------
// 3. PROVIDER SERVICE PROXIES (Port 5003)
// ----------------------------------------------------
app.use(createProxyMiddleware({
  pathFilter: '/api/providers',
  target: PROVIDER_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/payouts',
  target: PROVIDER_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/provider-services',
  target: PROVIDER_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/wallets',
  target: PROVIDER_SERVICE,
  changeOrigin: true
}));

// ----------------------------------------------------
// 4. BOOKING SERVICE PROXIES (Port 5004)
// ----------------------------------------------------
app.use(createProxyMiddleware({
  pathFilter: '/api/bookings',
  target: BOOKING_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/cart',
  target: BOOKING_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/reviews',
  target: BOOKING_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/complaints',
  target: BOOKING_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/admin/dashboard',
  target: BOOKING_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/admin/charts',
  target: BOOKING_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/admin/reports',
  target: BOOKING_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/admin/refund-policy',
  target: BOOKING_SERVICE,
  changeOrigin: true
}));

// ----------------------------------------------------
// 5. PAYMENT SERVICE PROXIES (Port 5005)
// ----------------------------------------------------
app.use(createProxyMiddleware({
  pathFilter: '/api/payments',
  target: PAYMENT_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/refunds',
  target: PAYMENT_SERVICE,
  changeOrigin: true
}));

// ----------------------------------------------------
// 6. NOTIFICATION SERVICE PROXIES (Port 5006)
// ----------------------------------------------------
app.use(createProxyMiddleware({
  pathFilter: '/api/reports',
  target: NOTIFICATION_SERVICE,
  changeOrigin: true,
  pathRewrite: {
    '^/api/reports': '/api/notifications/reports'
  }
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/notifications',
  target: NOTIFICATION_SERVICE,
  changeOrigin: true
}));

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'API Gateway is active and routing requests'
  });
});

export default app;

