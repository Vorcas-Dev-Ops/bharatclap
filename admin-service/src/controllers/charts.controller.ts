import { Request, Response } from 'express';
import axios from 'axios';
import { ENV } from '../config/env';

// ponytail: proxy all chart requests to booking-service which has the real aggregation queries
const headers = { 'x-internal-service-key': ENV.INTERNAL_SERVICE_KEY };

async function proxyChart(endpoint: string, req: Request, res: Response) {
  try {
    const qs = new URLSearchParams(req.query as any).toString();
    const url = `${ENV.BOOKING_SERVICE_URL}/api/admin/charts/${endpoint}${qs ? `?${qs}` : ''}`;
    const result = await axios.get(url, { headers, timeout: 6000 });
    res.json(result.data);
  } catch (err: any) {
    const status = err?.response?.status || 500;
    const msg = err?.response?.data?.message || err?.message || 'Chart data unavailable';
    console.warn(`[ChartsController] proxy to booking-service /${endpoint} failed:`, msg);
    res.status(status).json({ success: false, message: msg });
  }
}

export class ChartsController {
  static getRevenueChart(req: Request, res: Response) { return proxyChart('revenue-chart', req, res); }
  static getBookingChart(req: Request, res: Response) { return proxyChart('booking-chart', req, res); }
  static getOrderStatusChart(req: Request, res: Response) { return proxyChart('order-status', req, res); }
  static getServiceDistributionChart(req: Request, res: Response) { return proxyChart('service-distribution', req, res); }
  static getProviderPerformanceChart(req: Request, res: Response) { return proxyChart('provider-performance', req, res); }
  static getPeakTimeHeatmapChart(req: Request, res: Response) { return proxyChart('peak-time-heatmap', req, res); }
  static getRecentReviewsChart(req: Request, res: Response) { return proxyChart('recent-reviews', req, res); }
}
