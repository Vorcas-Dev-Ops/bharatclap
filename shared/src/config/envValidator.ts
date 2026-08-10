import { logger } from '../logger';

export interface EnvValidationOptions {
  serviceName: string;
  requiredVars?: string[];
}

const COMMON_REQUIRED_PROD_VARS = [
  'JWT_SECRET',
  'INTERNAL_SERVICE_KEY',
  'MONGO_URI',
];

export const validateEnv = (options: EnvValidationOptions): void => {
  const isProd = process.env.NODE_ENV === 'production';
  const required = [...COMMON_REQUIRED_PROD_VARS, ...(options.requiredVars || [])];

  const missing: string[] = [];

  for (const varName of required) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    const errorMsg = `[ENV VALIDATION ERROR] Missing required environment variables for ${options.serviceName}: ${missing.join(', ')}`;
    logger.error(errorMsg, new Error(errorMsg), {
      service: options.serviceName,
      event: 'ENV_VALIDATION_FAILURE',
      metadata: { missing, isProd },
    });

    if (isProd) {
      // In production, missing critical env vars must abort startup immediately
      throw new Error(errorMsg);
    } else {
      console.warn(`[ENV VALIDATION WARNING] Development mode fallback active for ${options.serviceName}. Missing: ${missing.join(', ')}`);
    }
  } else {
    logger.info(`Environment variables validated successfully for ${options.serviceName}`, {
      service: options.serviceName,
      event: 'ENV_VALIDATION_SUCCESS',
      metadata: { isProd },
    });
  }
};
