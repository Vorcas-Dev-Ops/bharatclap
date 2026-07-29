import { Request, Response } from 'express';
import { Service } from '../models/Service';
import { Category } from '../models/Category';
import { SubService } from '../models/SubService';
import { getCache, setCache, deleteCache } from '../config/redis';
import {
  invalidateServiceCacheSelective,
  recordCacheHit,
  recordCacheMiss,
  getCacheMetricsSummary,
  getCatalogVersion,
  acquireRebuildLock,
  releaseRebuildLock,
  getPrometheusMetrics,
} from '../utils/cacheManager';

// @desc    Get all services (optionally filter by category)
// @route   GET /api/services?category_id=xxx
// @access  Public
export const getServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryId = req.query.category_id ? String(req.query.category_id) : 'all';
    const gender = req.query.gender ? String(req.query.gender) : null;
    const includeInactive = req.query.includeInactive === 'true';
    
    // Include includeInactive in cacheKey to prevent admin vs public cache collisions
    const cacheKey = `catalog:services:cat:${categoryId}:gender:${gender ?? 'all'}:inactive:${includeInactive}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    const filter: any = { isDeleted: false };
    if (!includeInactive) {
      filter.status = 'active';
    }

    if (req.query.category_id) {
      if (req.query.category_id.toString().match(/^[0-9a-fA-F]{24}$/)) {
        filter.category_id = req.query.category_id;
      } else {
        res.json([]);
        return;
      }
    }

    // Gender filter: if specified, include services matching the gender
    if (gender && ['men', 'women'].includes(gender)) {
      filter.genderApplicability = gender;
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 100; // Services are often loaded completely for FE, using 100 as default max limit

    const services = await Service.find(filter)
      .populate('category_id', 'category_name icon requiresGenderSelection')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Get subservice counts for each service in a single aggregated batch
    const serviceIds = services.map(srv => srv._id);
    const subserviceCounts = await SubService.aggregate([
      { $match: { service_id: { $in: serviceIds }, isDeleted: false } },
      { $group: { _id: '$service_id', count: { $sum: 1 } } }
    ]);
    const countMap = new Map(subserviceCounts.map(item => [item._id.toString(), item.count]));
    const normalized = services.map((srv: any) => ({
      ...srv,
      subservices_count: countMap.get(srv._id.toString()) || 0
    }));

    await setCache(cacheKey, normalized, 3600); // 1 hour TTL
    res.json(normalized);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single service by ID
// @route   GET /api/services/:id
// @access  Public
export const getServiceById = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `catalog:services:id:${req.params.id}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    const service = await Service.findById(req.params.id).populate('category_id', 'category_name icon');
    if (!service) {
      res.status(404).json({ message: 'Service not found' });
      return;
    }

    await setCache(cacheKey, service, 3600);
    res.json(service);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get complete booking overview bundle for a service in ONE API call
// @route   GET /api/services/booking-overview/:id
// @access  Public
export const getBookingOverviewBundle = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const serviceId = req.params.id;
    const version = await getCatalogVersion();
    const cacheKey = `catalog:v${version}:booking-overview:${serviceId}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      recordCacheHit(cacheKey);
      res.json(JSON.parse(cachedData));
      return;
    }

    // Cache Stampede Mutex Lock: Ensure only 1 worker rebuilds cache during miss
    const acquiredLock = await acquireRebuildLock(serviceId, 5000);
    if (!acquiredLock) {
      // Another worker is rebuilding. Wait 120ms and retry reading cached value
      await new Promise((r) => setTimeout(r, 120));
      const retryCached = await getCache(cacheKey);
      if (retryCached) {
        recordCacheHit(cacheKey);
        res.json(JSON.parse(retryCached));
        return;
      }
    }

    // 1. Fetch target service
    const targetService = await Service.findOne({ _id: serviceId, isDeleted: false })
      .populate('category_id', 'category_name icon requiresGenderSelection')
      .lean();

    if (!targetService) {
      if (acquiredLock) await releaseRebuildLock(serviceId);
      res.status(404).json({ message: 'Service not found' });
      return;
    }

    const categoryId = (targetService.category_id as any)?._id || targetService.category_id;

    // 2. Concurrently fetch related category services & subservices with lean projections
    const [relatedServices, subServices] = await Promise.all([
      categoryId
        ? Service.find({ category_id: categoryId, status: 'active', isDeleted: false })
            .select('_id service_name image images description base_price duration')
            .sort({ is_featured: -1, createdAt: -1 })
            .lean()
        : Promise.resolve([]),
      SubService.find({ service_id: serviceId, status: 'active', isDeleted: false })
        .select('_id service_id subservice_name description base_price duration hasPackages packages service_preparations image')
        .sort({ createdAt: 1 })
        .lean(),
    ]);

    const bundle = {
      service: targetService,
      relatedServices: relatedServices.map((s: any) => ({
        id: s._id,
        title: s.service_name,
        image: s.image || (s.images && s.images[0]) || '',
        description: s.description,
        price: s.packages?.[0]?.base_price ?? s.base_price ?? 0,
      })),
      subServices: subServices.map((item: any) => ({
        id: String(item._id),
        title: item.subservice_name,
        rating: 4.9,
        reviews: '2,400+',
        price: item.packages?.[0]?.base_price ?? item.base_price ?? 0,
        duration: item.packages?.[0]?.duration ?? item.duration ?? '45-60 mins',
        description: item.description,
        image: item.image || '',
        features: [
          'Expert professional',
          'High-quality tools',
          'Mess-free experience',
          'Satisfaction guarantee',
        ],
        preparations: (item.service_preparations || []).map((p: any) => ({
          title: p.title,
          isMandatory: p.isMandatory,
        })),
      })),
    };

    await setCache(cacheKey, bundle, 3600); // 1 hour TTL in Redis
    if (acquiredLock) await releaseRebuildLock(serviceId);

    recordCacheMiss(cacheKey, Date.now() - startTime);
    res.json(bundle);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get cache metrics summary (JSON)
// @route   GET /api/services/cache-metrics
// @access  Private/Admin
export const getCatalogCacheMetrics = async (req: Request, res: Response): Promise<void> => {
  res.json(getCacheMetricsSummary());
};

// @desc    Get Prometheus metrics
// @route   GET /api/services/metrics/prometheus
// @access  Public
export const getCatalogPrometheusMetrics = async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(getPrometheusMetrics());
};

// @desc    Create a new service
// @route   POST /api/services
// @access  Private/Admin
export const createService = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      category_id,
      service_name,
      slug,
      description,
      base_price,
      duration,
      images,
      is_featured,
      genderApplicability,
      status
    } = req.body;

    const categoryExists = await Category.findById(category_id);
    if (!categoryExists) {
      res.status(400).json({ message: 'Category not found' });
      return;
    }

    const service = await Service.create({
      category_id,
      service_name,
      slug: slug || service_name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''),
      description,
      base_price,
      duration,
      images: Array.isArray(images) ? images : [images],
      is_featured,
      genderApplicability: genderApplicability || 'men',
      status,
    });

    const populated = await service.populate('category_id', 'category_name icon requiresGenderSelection');

    // Selective Invalidation for the new service & its category
    await invalidateServiceCacheSelective(service._id.toString(), category_id);

    res.status(201).json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a service
// @route   PUT /api/services/:id
// @access  Private/Admin
export const updateService = async (req: Request, res: Response): Promise<void> => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      res.status(404).json({ message: 'Service not found' });
      return;
    }

    const {
      category_id,
      service_name,
      slug,
      description,
      base_price,
      duration,
      images,
      is_featured,
      genderApplicability,
      status
    } = req.body;

    if (category_id) {
      const categoryExists = await Category.findById(category_id);
      if (!categoryExists) {
        res.status(400).json({ message: 'Category not found' });
        return;
      }
      service.category_id = category_id;
    }

    service.service_name = service_name ?? service.service_name;
    service.slug = slug ?? service.slug;
    service.description = description ?? service.description;
    service.base_price = base_price ?? service.base_price;
    service.duration = duration ?? service.duration;
    if (images) service.images = Array.isArray(images) ? images : [images];
    service.is_featured = is_featured ?? service.is_featured;
    // Normalise old enum values ('male'→'men', 'female'→'women') from DB documents
    const normaliseGender = (g: string) => g === 'male' ? 'men' : g === 'female' ? 'women' : g === 'unisex' ? 'men' : g;
    service.genderApplicability = normaliseGender(genderApplicability ?? service.genderApplicability) as any;
    service.status = status ?? service.status;

    const updated = await service.save();
    const populated = await updated.populate('category_id', 'category_name icon requiresGenderSelection');

    // Selective Invalidation for the target service & its category
    await invalidateServiceCacheSelective(service._id.toString(), service.category_id?.toString());

    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a service
// @route   DELETE /api/services/:id
// @access  Private/Admin
export const deleteService = async (req: Request, res: Response): Promise<void> => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      res.status(404).json({ message: 'Service not found' });
      return;
    }
    service.isDeleted = true;
    service.status = 'inactive';
    await service.save();

    // Selective Invalidation for the deleted service & its category
    await invalidateServiceCacheSelective(service._id.toString(), service.category_id?.toString());

    res.json({ message: 'Service removed (soft delete) successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
