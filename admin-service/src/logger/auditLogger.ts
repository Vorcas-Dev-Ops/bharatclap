import { Logger } from './logger';

export interface AuditRecord {
  adminId: string;
  adminName?: string;
  action: string;
  resource: string;
  oldValue?: any;
  newValue?: any;
  ip: string;
  browser: string;
  correlationId: string;
}

export class AuditLogger {
  static log(record: AuditRecord) {
    Logger.info('ADMIN_AUDIT_EVENT', {
      ...record,
      timestamp: new Date().toISOString(),
    });
  }
}
