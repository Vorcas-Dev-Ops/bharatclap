import dotenv from 'dotenv';
import path from 'path';

// Load service-local .env first, then fallback to workspace root .env
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const requiredEnv = (key: string, defaultValue?: string): string => {
  const val = process.env[key] || defaultValue;
  if (!val) {
    console.error(`\n==================================================`);
    console.error(`FATAL: Missing required environment variable: ${key}`);
    console.error(`Please check your .env file or deployment secrets.`);
    console.error(`==================================================\n`);
    throw new Error(`FATAL: Missing required environment variable: ${key}`);
  }
  return val;
};

export const config = {
  app: {
    env: process.env.NODE_ENV || 'development',
    isProd: process.env.NODE_ENV === 'production',
    port: Number(process.env.PORT) || 5000,
    serviceName: process.env.SERVICE_NAME || 'bharatclap-service',
    corsOrigins: (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim())
  },
  mongo: {
    uri: requiredEnv('MONGO_URI', 'mongodb://127.0.0.1:27017/bharatclap')
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
  },
  jwt: {
    secret: requiredEnv('JWT_SECRET'),
    // ponytail: refreshSecret is only required by services issuing/rotating refresh tokens (auth-service)
    get refreshSecret(): string {
      return requiredEnv('JWT_REFRESH_SECRET');
    },
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },
  internal: {
    serviceKey: requiredEnv('INTERNAL_SERVICE_KEY')
  },
  encryption: {
    key: requiredEnv('ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')
  },
  msg91: {
    authKey: process.env.MSG91_AUTHKEY || '',
    templateId: process.env.MSG91_TEMPLATE_ID || ''
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || ''
  }
};

export * from './envValidator';

