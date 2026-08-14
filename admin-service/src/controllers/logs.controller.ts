import { Request, Response } from 'express';
import axios from 'axios';
import { AppConfig } from '../config/app.config';

// ponytail: all services that have /internal/logs mounted
const SERVICE_URLS = [
  { name: 'auth-service', url: AppConfig.AUTH_SERVICE_URL },
  { name: 'booking-service', url: AppConfig.BOOKING_SERVICE_URL },
  { name: 'provider-service', url: AppConfig.PROVIDER_SERVICE_URL },
  { name: 'payment-service', url: AppConfig.PAYMENT_SERVICE_URL },
  { name: 'notification-service', url: AppConfig.NOTIFICATION_SERVICE_URL },
  { name: 'refund-service', url: AppConfig.REFUND_SERVICE_URL },
  { name: 'catalog-service', url: AppConfig.CATALOG_SERVICE_URL },
];

async function fetchLogsFromServices(query: Record<string, any>): Promise<{ data: any[]; total: number }> {
  const headers = { 'x-internal-service-key': AppConfig.INTERNAL_SERVICE_KEY };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') params.append(k, String(v));
  }
  const qs = params.toString();

  const results = await Promise.allSettled(
    SERVICE_URLS.map(s =>
      axios.get(`${s.url}/internal/logs?${qs}`, { headers, timeout: 3000 })
    )
  );

  let allLogs: any[] = [];
  let totalCount = 0;

  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value.data?.success) {
      const serviceLogs = (r.value.data.data || []).map((log: any) => ({
        ...log,
        _source_service: SERVICE_URLS[i].name,
      }));
      allLogs = allLogs.concat(serviceLogs);
      totalCount += r.value.data.total || 0;
    }
  });

  // Sort merged results by created_at descending
  allLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return { data: allLogs, total: totalCount };
}

export class LogsController {
  static async getSystemLogs(req: Request, res: Response): Promise<void> {
    try {
      const result = await fetchLogsFromServices({ ...req.query, category: 'system' });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Failed to fetch system logs' });
    }
  }

  static async getProviderErrorLogs(req: Request, res: Response): Promise<void> {
    try {
      const result = await fetchLogsFromServices({ ...req.query, category: 'provider' });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Failed to fetch provider error logs' });
    }
  }

  static async getUserErrorLogs(req: Request, res: Response): Promise<void> {
    try {
      const result = await fetchLogsFromServices({ ...req.query, category: 'user' });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Failed to fetch user error logs' });
    }
  }
}
