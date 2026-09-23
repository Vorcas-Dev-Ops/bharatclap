import cors, { CorsOptions } from 'cors';

const isProd = process.env.NODE_ENV === 'production';

const DEV_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];

const PROD_DEFAULT_ORIGINS = [
  'https://bharatclap.in',
  'https://www.bharatclap.in',
  'https://admin.bharatclap.in',
  'https://partner.bharatclap.in',
];

export const getCorsOptions = (): CorsOptions => {
  const envOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean)
    : [];

  const frontendOrigin = process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL.trim().replace(/\/$/, '')]
    : [];

  const adminOrigin = process.env.ADMIN_URL
    ? [process.env.ADMIN_URL.trim().replace(/\/$/, '')]
    : [];

  const baseOrigins = isProd ? PROD_DEFAULT_ORIGINS : [...PROD_DEFAULT_ORIGINS, ...DEV_ALLOWED_ORIGINS];

  const allowedOriginsSet = new Set([
    ...baseOrigins.map((o) => o.replace(/\/$/, '')),
    ...envOrigins,
    ...frontendOrigin,
    ...adminOrigin,
  ]);

  return {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.trim().replace(/\/$/, '');
      if (allowedOriginsSet.has(cleanOrigin)) {
        return callback(null, true);
      }
      console.warn(`[CORS REJECT] Origin '${origin}' (normalized: '${cleanOrigin}') blocked.`);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cache-Control',
      'Pragma',
      'X-Requested-With',
      'Accept',
      'x-internal-service-key',
      'x-correlation-id',
      'x-idempotency-key',
    ],
  };
};

export const corsMiddleware = cors(getCorsOptions());
