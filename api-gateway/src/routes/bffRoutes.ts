import { Router, Request, Response } from 'express';
import axios from 'axios';
import http from 'http';
import https from 'https';

// ponytail: keep-alive for BFF → backend service calls
const keepAliveAgent = new http.Agent({ keepAlive: true, maxSockets: 200 });
const keepAliveHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 200 });

const internalClient = axios.create({
  timeout: 8000,
  httpAgent: keepAliveAgent,
  httpsAgent: keepAliveHttpsAgent,
});

const CATALOG_SERVICE = process.env.CATALOG_SERVICE_URL || 'http://127.0.0.1:5002';
const PROVIDER_SERVICE = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || '';

const internalHeaders = () => ({ 'x-internal-service-key': INTERNAL_KEY });

const router = Router();

// ponytail: bypass duplicate node-memory cache; catalog-service already caches in Redis and invalidates on banner/category updates
/**
 * GET /api/customer/home
 * Aggregates categories + banners + offers in 1 request via home-bundle → 1 request for the home screen.
 */
router.get('/home', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  try {
    const bundleRes = await internalClient.get(`${CATALOG_SERVICE}/api/categories/home-bundle`).catch((err) => {
      console.warn('[BFF] home-bundle call failed/timeout, falling back to parallel:', err?.message);
      return null;
    });

    if (bundleRes && bundleRes.data) {
      res.json(bundleRes.data);
      return;
    }

    // Fallback parallel calls if home-bundle fails
    const [categoriesRes, bannersRes, offersRes] = await Promise.all([
      internalClient.get(`${CATALOG_SERVICE}/api/categories`).catch(() => ({ data: [] })),
      internalClient.get(`${CATALOG_SERVICE}/api/banners?audience=user`).catch(() => ({ data: [] })),
      internalClient.get(`${CATALOG_SERVICE}/api/offers`).catch(() => ({ data: [] })),
    ]);

    const result = {
      categories: categoriesRes.data,
      banners: bannersRes.data,
      offers: offersRes.data,
    };

    res.json(result);
  } catch (error: any) {
    console.error('[BFF] /customer/home error:', error.message);
    res.status(500).json({ error: 'Failed to load home data' });
  }
});

/**
 * GET /api/customer/service/:id
 * Aggregates service booking overview + provider availability in parallel → 1 request.
 * Old endpoints (/api/services/booking-overview/:id, /api/providers/check-availability) remain available.
 */
router.get('/service/:id', async (req: Request, res: Response) => {
  const serviceId = req.params.id;
  const { lat, lng, category_id } = req.query;

  try {
    const promises: Promise<any>[] = [
      internalClient.get(`${CATALOG_SERVICE}/api/services/booking-overview/${serviceId}`).catch(() => ({ data: null })),
    ];

    // Only fetch providers if location is provided
    if (lat && lng) {
      const params = new URLSearchParams();
      params.set('lat', String(lat));
      params.set('lng', String(lng));
      if (category_id) params.set('category_id', String(category_id));

      promises.push(
        internalClient.get(`${PROVIDER_SERVICE}/api/providers/check-availability?${params.toString()}`).catch(() => ({ data: null }))
      );
    }

    const results = await Promise.all(promises);

    res.json({
      service: results[0].data,
      providers: results[1]?.data || null,
    });
  } catch (error: any) {
    console.error('[BFF] /customer/service/:id error:', error.message);
    res.status(500).json({ error: 'Failed to load service data' });
  }
});

export default router;
