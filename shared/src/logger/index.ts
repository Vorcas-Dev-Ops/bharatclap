import { correlationStore } from '../middleware/correlationId';
import { redact } from '../utils/logRedaction';

export interface StructuredLogPayload {
  service?: string;
  event?: string;
  event_version?: number;
  event_category?: 'Booking' | 'Dispatch' | 'Payment' | 'Finance' | 'Security' | 'Admin' | 'Notification' | 'Audit' | 'Worker' | 'Performance' | string;
  action?: string;
  status?: string;
  correlation_id?: string;
  request_id?: string;
  booking_id?: string;
  payment_id?: string;
  settlement_id?: string;
  invoice_id?: string;
  journal_id?: string;
  provider_id?: string;
  customer_id?: string;
  userId?: string;
  user_role?: string;
  actor?: string;
  ip?: string;
  user_agent?: string;
  retry_attempt?: number;
  max_retry?: number;
  retry_reason?: string;
  idempotency_key?: string;
  is_duplicate?: boolean;
  duration_ms?: number;
  metadata?: any;
  [key: string]: any;
}

const serviceName = process.env.SERVICE_NAME || 'unknown-service';

export const logger = {
  info: (eventOrMessage: string, payload: StructuredLogPayload = {}): void => {
    log('INFO', eventOrMessage, payload);
  },
  warn: (eventOrMessage: string, payload: StructuredLogPayload = {}): void => {
    log('WARN', eventOrMessage, payload);
  },
  error: (eventOrMessage: string, errorOrPayload?: any, payload: StructuredLogPayload = {}): void => {
    let combinedPayload = { ...payload };
    if (errorOrPayload instanceof Error) {
      combinedPayload.metadata = {
        ...(combinedPayload.metadata || {}),
        errorName: errorOrPayload.name,
        errorMessage: errorOrPayload.message,
        stack: errorOrPayload.stack
      };
    } else if (typeof errorOrPayload === 'object') {
      combinedPayload = { ...errorOrPayload, ...combinedPayload };
    }
    log('ERROR', eventOrMessage, combinedPayload);
  },
  slow: (eventOrMessage: string, duration_ms: number, payload: StructuredLogPayload = {}): void => {
    log('WARN', `SLOW_REQUEST: ${eventOrMessage}`, { ...payload, duration_ms, event: 'SLOW_REQUEST', event_category: 'Performance' });
  }
};

function log(level: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL', eventOrMessage: string, payload: StructuredLogPayload): void {
  const store = correlationStore.getStore();
  const correlationId = payload.correlation_id || store?.correlationId || 'unknown';

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: payload.service || serviceName,
    event_version: payload.event_version || 1,
    event_source: payload.service || serviceName,
    event_category: payload.event_category || 'Audit',
    correlation_id: correlationId,
    request_id: payload.request_id || store?.requestId,
    booking_id: payload.booking_id || payload.bookingId || store?.bookingId,
    payment_id: payload.payment_id || payload.paymentId,
    settlement_id: payload.settlement_id || payload.settlementId,
    invoice_id: payload.invoice_id || payload.invoiceId,
    journal_id: payload.journal_id || payload.journalId,
    provider_id: payload.provider_id || payload.providerId || store?.providerId,
    customer_id: payload.customer_id || payload.userId || store?.userId,
    user_role: payload.user_role || 'user',
    actor: payload.actor || 'system',
    ip: payload.ip || '127.0.0.1',
    user_agent: payload.user_agent || 'internal',
    retry_attempt: payload.retry_attempt,
    max_retry: payload.max_retry,
    retry_reason: payload.retry_reason,
    idempotency_key: payload.idempotency_key,
    is_duplicate: payload.is_duplicate ?? false,
    event: payload.event || payload.action || eventOrMessage,
    status: payload.status || (level === 'ERROR' ? 'FAILED' : 'SUCCESS'),
    duration_ms: payload.duration_ms ?? 0,
    metadata: payload.metadata ? redact(payload.metadata) : undefined
  };

  const output = JSON.stringify(entry);
  if (level === 'ERROR' || level === 'FATAL') {
    console.error(output);
  } else if (level === 'WARN') {
    console.warn(output);
  } else {
    console.log(output);
  }
}
