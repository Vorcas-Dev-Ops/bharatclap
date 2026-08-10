import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 5008,
  NODE_ENV: process.env.NODE_ENV || 'development',
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  INTERNAL_SERVICE_KEY: process.env.INTERNAL_SERVICE_KEY || 'default-internal-key-change-me',
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001',
  CATALOG_SERVICE_URL: process.env.CATALOG_SERVICE_URL || 'http://127.0.0.1:5002',
  PROVIDER_SERVICE_URL: process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003',
  BOOKING_SERVICE_URL: process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004',
  PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL || 'http://127.0.0.1:5005',
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://127.0.0.1:5006',
  REFUND_SERVICE_URL: process.env.REFUND_SERVICE_URL || 'http://127.0.0.1:5007',
};
