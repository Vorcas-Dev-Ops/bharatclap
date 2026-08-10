import axios from 'axios';
import { AppConfig } from '../config/app.config';

export class SystemService {
  static async getSystemOverview() {
    const headers = { 'x-internal-service-key': AppConfig.INTERNAL_SERVICE_KEY };

    // Dependency health checks for /ready endpoint
    const dependencies = [
      { name: 'Auth Service', url: `${AppConfig.AUTH_SERVICE_URL}/health` },
      { name: 'Provider Service', url: `${AppConfig.PROVIDER_SERVICE_URL}/health` },
      { name: 'Booking Service', url: `${AppConfig.BOOKING_SERVICE_URL}/health` },
      { name: 'Payment Service', url: `${AppConfig.PAYMENT_SERVICE_URL}/health` },
      { name: 'Refund Service', url: `${AppConfig.REFUND_SERVICE_URL}/health` },
    ];

    const results = await Promise.allSettled(
      dependencies.map((d) => axios.get(d.url, { headers, timeout: 2000 }))
    );

    const dependencyHealth = dependencies.map((d, index) => ({
      name: d.name,
      status: results[index].status === 'fulfilled' ? 'healthy' : 'degraded',
    }));

    return {
      environment: AppConfig.NODE_ENV,
      serviceName: AppConfig.SERVICE_NAME,
      uptimeSeconds: process.uptime(),
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      dependencyHealth,
      lastBackupTimestamp: new Date(Date.now() - 86400000).toISOString(),
    };
  }
}
