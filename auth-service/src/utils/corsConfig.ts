import cors, { CorsOptions } from 'cors';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'https://bharatclap.in',
];

export const getCorsOptions = (): CorsOptions => {
  const envOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean)
    : [];

  const adminOrigin = process.env.ADMIN_URL
    ? [process.env.ADMIN_URL.trim().replace(/\/$/, '')]
    : [];

  const allowedOriginsSet = new Set([
    ...DEFAULT_ALLOWED_ORIGINS.map((o) => o.replace(/\/$/, '')),
    ...envOrigins,
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
