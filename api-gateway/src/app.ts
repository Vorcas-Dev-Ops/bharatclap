import express, { Request, Response } from 'express';
import cors from 'cors';
import { createProxyMiddleware as rawCreateProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const serviceUnreadyUntil: Record<string, number> = {};

const createProxyMiddleware = (options: any) => {
  const { pathFilter, target, ...restOptions } = options;
  const filterFn = typeof pathFilter === 'string'
    ? (path: string) => path.startsWith(pathFilter)
    : pathFilter;

  return (req: any, res: any, next: any) => {
    if (filterFn(req.path || req.url)) {
      const unreadyUntil = serviceUnreadyUntil[target] || 0;
      if (Date.now() < unreadyUntil) {
        // Fast-fail short-circuit (< 1ms 503 response) when target service is unready
        res.writeHead(503, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Backend service is starting up or temporarily unavailable.',
          code: 503
        }));
      }
    }

    const proxy = rawCreateProxyMiddleware({
      pathFilter: filterFn,
      target,
      proxyTimeout: 2000, // 2s timeout to prevent socket exhaustion
      timeout: 2000,      // 2s connection timeout
      on: {
        error: (err: any, req: any, res: any) => {
          console.error(`[API-GATEWAY] Proxy Error: ${req.method} ${req.url} -> ${target}:`, err?.message || err);
          // Mark target service unready for 3 seconds on ECONNREFUSED / socket error
          serviceUnreadyUntil[target] = Date.now() + 3000;
          if (res && typeof res.writeHead === 'function' && !res.headersSent) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'SERVICE_UNAVAILABLE',
              message: 'Backend service is starting up or temporarily unavailable. Please try again in a few seconds.',
              code: 503
            }));
          }
        }
      },
      ...restOptions
    });

    return proxy(req, res, next);
  };
};

dotenv.config();

// Verify internal service key is loaded
if (!process.env.INTERNAL_SERVICE_KEY) {
  throw new Error('INTERNAL_SERVICE_KEY must be set in environment variables');
}
// CORS_ORIGINS must be set in .env to allow frontend origins

const app = express();

// Load security headers
app.use(helmet({ contentSecurityPolicy: false }));

const isProd = process.env.NODE_ENV === 'production';

import { correlationMiddleware, logger, sendSuccess, sendError, ErrorCodes } from '@bharatclap/shared';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

// Configure Redis Client for Rate Limiting Store
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisClient = createClient({ url: redisUrl });
redisClient.on('error', (err) => console.error('[GATEWAY-REDIS] Redis Client Error:', err?.message || err));
redisClient.connect().catch(() => console.warn('[GATEWAY-REDIS] Redis connection failed, falling back to memory store'));

const createRedisStore = () => {
  if (redisClient.isOpen) {
    return new RedisStore({
      // @ts-ignore
      sendCommand: (...args: string[]) => redisClient.sendCommand(args)
    });
  }
  return undefined; // fallback to express-rate-limit in-memory store
};

// Rate Limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProd ? 300 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: {
    success: false,
    error: 'TOO_MANY_REQUESTS',
    errorCode: ErrorCodes.RATE_LIMIT_EXCEEDED,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

const authOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProd ? 20 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: {
    success: false,
    error: 'TOO_MANY_REQUESTS',
    errorCode: ErrorCodes.RATE_LIMIT_EXCEEDED,
    message: 'Request rate limit reached. Please try again after a few minutes.'
  }
});

// Apply tighter rate limits to sensitive routes first
app.use('/api/users/login', authOtpLimiter);
app.use('/api/users/send-otp', authOtpLimiter);
app.use('/api/users/verify-otp', authOtpLimiter);
app.use('/api/users/forgot-password', authOtpLimiter);
app.use('/api/bookings/otp/verify-start', authOtpLimiter);

// Apply global rate limit to all API routes
app.use('/api', globalLimiter);

import { corsMiddleware } from './utils/corsConfig';

app.use(corsMiddleware);

// Security Middleware: Strip x-internal-service-key from external client requests
app.use((req, res, next) => {
  if (req.headers['x-internal-service-key']) {
    delete req.headers['x-internal-service-key'];
  }
  next();
});

// Global Correlation ID Middleware from @bharatclap/shared
app.use(correlationMiddleware);

// HTTP Request Logger & Response Time Tracking (Structured JSON Telemetry)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request Processed', {
      service: 'api-gateway',
      action: 'PROXY_HTTP_REQUEST',
      metadata: {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        durationMs: duration
      }
    });
  });
  next();
});

const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001';
const CATALOG_SERVICE = process.env.CATALOG_SERVICE_URL || 'http://127.0.0.1:5002';
const PROVIDER_SERVICE = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
const BOOKING_SERVICE = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
const PAYMENT_SERVICE = process.env.PAYMENT_SERVICE_URL || 'http://127.0.0.1:5005';
const NOTIFICATION_SERVICE = process.env.NOTIFICATION_SERVICE_URL || 'http://127.0.0.1:5006';
const REFUND_SERVICE = process.env.REFUND_SERVICE_URL || 'http://127.0.0.1:5007';
const ADMIN_SERVICE = process.env.ADMIN_SERVICE_URL || 'http://127.0.0.1:5008';

// Proxy /api/v1/admin, /api/v1/public, and /api/v1/platform to dedicated Admin Aggregation Service (BFF)
app.use(createProxyMiddleware({
  pathFilter: (path: string) => path.startsWith('/api/v1/admin') || path.startsWith('/api/admin') || path.startsWith('/api/v1/public') || path.startsWith('/api/v1/platform'),
  target: ADMIN_SERVICE,
  changeOrigin: true
}));

// ----------------------------------------------------
// 1. AUTH SERVICE & USER BOOKING ALIAS PROXIES
// ----------------------------------------------------
app.use(createProxyMiddleware({
  pathFilter: (path: string) => path === '/api/user/bookings' || path === '/api/users/bookings',
  target: BOOKING_SERVICE,
  changeOrigin: true,
  pathRewrite: {
    '^/api/user/bookings': '/api/bookings/my',
    '^/api/users/bookings': '/api/bookings/my'
  }
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/users',
  target: AUTH_SERVICE,
  changeOrigin: true
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
  }
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/address',
  target: AUTH_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/contact',
  target: AUTH_SERVICE,
  changeOrigin: true
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
  proxyTimeout: 10000
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/timeslot-rules',
  target: CATALOG_SERVICE,
  changeOrigin: true,
  proxyTimeout: 10000
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/accessories',
  target: CATALOG_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/uploads',
  target: CATALOG_SERVICE,
  changeOrigin: true
}));

// ----------------------------------------------------
// 3. PROVIDER SERVICE PROXIES (Port 5003)
// ----------------------------------------------------

app.use(createProxyMiddleware({
  pathFilter: '/api/providers',
  target: PROVIDER_SERVICE,
  changeOrigin: true,
  proxyTimeout: 30000,
  timeout: 30000
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

app.use(createProxyMiddleware({
  pathFilter: '/api/starter-kits',
  target: PROVIDER_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/kit-orders',
  target: PROVIDER_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/accessory-orders',
  target: PROVIDER_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/waivers',
  target: PROVIDER_SERVICE,
  changeOrigin: true
}));

// ----------------------------------------------------
// 4. BOOKING SERVICE PROXIES (Port 5004)
// ----------------------------------------------------
app.use(createProxyMiddleware({
  pathFilter: '/api/chat',
  target: BOOKING_SERVICE,
  changeOrigin: true
}));

app.use(createProxyMiddleware({
  pathFilter: '/api/bookings',
  target: BOOKING_SERVICE,
  changeOrigin: true,
  proxyTimeout: 30000,
  timeout: 30000
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

app.use(createProxyMiddleware({
  pathFilter: '/api/admin/provider-response-analytics',
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

// ----------------------------------------------------
// 6. REFUND SERVICE PROXIES (Port 5007 - Standalone Engine)
// ----------------------------------------------------
app.use(createProxyMiddleware({
  pathFilter: '/api/refunds',
  target: REFUND_SERVICE,
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

// Health & Readiness Endpoints
app.get(['/health', '/health/live', '/api/health'], (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    service: 'api-gateway',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get(['/ready', '/health/ready'], (req: Request, res: Response) => {
  const redisOk = redisClient.isOpen;
  res.status(200).json({
    status: redisOk ? 'READY' : 'DEGRADED',
    service: 'api-gateway',
    dependencies: {
      redis: redisOk ? 'UP' : 'DEGRADED'
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/metrics', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`# HELP gateway_uptime_seconds Process uptime in seconds\n# TYPE gateway_uptime_seconds gauge\ngateway_uptime_seconds ${process.uptime()}\n`);
});

export default app;

