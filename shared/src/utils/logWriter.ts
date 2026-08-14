import { SystemLog } from '../models/SystemLog';

const serviceName = process.env.SERVICE_NAME || 'unknown-service';

type LogCategory = 'system' | 'provider' | 'user';
type LogLevel = 'info' | 'warn' | 'error';

interface LogOpts {
  error_code?: string;
  stack?: string;
  path?: string;
  method?: string;
  correlation_id?: string;
  meta?: Record<string, any>;
}

/**
 * Fire-and-forget log writer. Never blocks the request, never throws.
 */
function writeLog(level: LogLevel, category: LogCategory, message: string, opts?: LogOpts): void {
  // ponytail: fire-and-forget — log loss on crash is acceptable, no await
  SystemLog.create({
    level,
    category,
    service: serviceName,
    message,
    ...opts,
  }).catch(() => {});
}

/** System-level events: service start/stop, cron, DB, internal API errors */
export const logSystem = (message: string, opts?: LogOpts) => writeLog('error', 'system', message, opts);
export const logSystemInfo = (message: string, opts?: LogOpts) => writeLog('info', 'system', message, opts);
export const logSystemWarn = (message: string, opts?: LogOpts) => writeLog('warn', 'system', message, opts);

/** Provider-side errors: dispatch, wallet, settlement, provider API failures */
export const logProviderError = (message: string, opts?: LogOpts) => writeLog('error', 'provider', message, opts);

/** User-side errors: login/OTP, booking, payment, validation failures */
export const logUserError = (message: string, opts?: LogOpts) => writeLog('error', 'user', message, opts);

export { writeLog };
