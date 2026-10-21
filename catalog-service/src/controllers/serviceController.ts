import { Request, Response } from 'express';
import { ServiceRepository } from '../repositories/serviceRepository';
import { CategoryRepository } from '../repositories/categoryRepository';
import { SubServiceRepository } from '../repositories/subServiceRepository';
import { getCache, setCache } from '../config/redis';
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
import { processAndStoreImage, deleteStoredImage, deleteMultipleStoredImages } from '../utils/imageStorage';

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

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 100;

    const services = await ServiceRepository.findServices({
      categoryId: categoryId !== 'all' ? categoryId : undefined,
      gender: gender && ['men', 'women'].includes(gender) ? gender : undefined,
      includeInactive,
      page,
      limit,
    });

    await setCache(cacheKey, services, 3600); // 1 hour TTL
    res.json(services);
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

    const service = await ServiceRepository.findById(req.params.id);
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
      await new Promise((r) => setTimeout(r, 120));
      const retryCached = await getCache(cacheKey);
      if (retryCached) {
        recordCacheHit(cacheKey);
        res.json(JSON.parse(retryCached));
        return;
      }
    }

    // 1. Fetch target service
    const targetService = await ServiceRepository.findById(serviceId);
    if (!targetService) {
      if (acquiredLock) await releaseRebuildLock(serviceId);
      res.status(404).json({ message: 'Service not found' });
      return;
    }

    const categoryId = targetService.category_id;

    // 2. Concurrently fetch related category services & subservices
    const [relatedServices, subServices] = await Promise.all([
      categoryId
        ? ServiceRepository.findServices({ categoryId, featured: true, limit: 10 })
        : Promise.resolve([]),
      SubServiceRepository.findSubServices({ serviceId }),
    ]);

    const bundle = {
      service: targetService,
      relatedServices: relatedServices.map((s: any) => ({
        id: s.id,
        _id: s.id,
        title: s.service_name,
        image: (s.images && s.images[0]) || '',
        description: s.description,
        price: s.base_price ?? 0,
      })),
      subServices: subServices.map((item: any) => ({
        id: String(item.id),
        _id: String(item.id),
        title: item.subservice_name,
        rating: 4.9,
        reviews: '2,400+',
        price: item.packages?.[0]?.base_price ?? item.base_price ?? 0,
        duration: item.packages?.[0]?.duration ?? item.duration ?? '45-60 mins',
        description: item.description,
        image: item.image || (targetService?.images && targetService.images[0]) || targetService?.image || '',
        features: [
          'Expert professional',
          'High-quality tools',
          'Mess-free experience',
          'Satisfaction guarantee',
        ],
        preparations: (item.service_preparations || []).map((p: any) => ({
          title: p.title,
          isMandatory: p.is_mandatory ?? p.isMandatory ?? false,
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
  let newlyUploadedImages: string[] = [];
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

    const categoryExists = await CategoryRepository.findById(category_id);
    if (!categoryExists) {
      res.status(400).json({ message: 'Category not found' });
      return;
    }

    const rawImagesList: string[] = Array.isArray(images)
      ? images
      : (images ? [images] : (req.body.image ? [req.body.image] : []));

    const itemSlug = slug || service_name?.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') || 'service';
    const processedImages: string[] = [];

    for (const rawImg of rawImagesList) {
      if (typeof rawImg === 'string' && rawImg.startsWith('data:image/')) {
        const storedUrl = await processAndStoreImage(rawImg, 'services', itemSlug);
        if (storedUrl) {
          processedImages.push(storedUrl);
          newlyUploadedImages.push(storedUrl);
        }
      } else if (rawImg) {
        processedImages.push(rawImg);
      }
    }

    try {
      const service = await ServiceRepository.create({
        categoryId: categoryExists.id,
        serviceName: service_name,
        slug,
        description,
        basePrice: parseFloat(base_price || 0),
        duration: Number(duration) || 0,
        images: processedImages,
        isFeatured: is_featured,
        genderApplicability: genderApplicability || 'men',
        status,
      });

      // Selective Invalidation for the new service & its category
      await invalidateServiceCacheSelective(service.id, categoryExists.id);

      res.status(201).json(service);
    } catch (dbErr: any) {
      // Rollback newly uploaded images on DB failure
      deleteMultipleStoredImages(newlyUploadedImages).catch(() => {});
      throw dbErr;
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a service
// @route   PUT /api/services/:id
// @access  Private/Admin
export const updateService = async (req: Request, res: Response): Promise<void> => {
  let newlyUploadedImages: string[] = [];
  try {
    const existingService = await ServiceRepository.findById(req.params.id);
    if (!existingService) {
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

    let targetCategoryId = existingService.category_id;
    if (category_id) {
      const categoryExists = await CategoryRepository.findById(category_id);
      if (!categoryExists) {
        res.status(400).json({ message: 'Category not found' });
        return;
      }
      targetCategoryId = categoryExists.id;
    }

    const normaliseGender = (g: string) => g === 'male' ? 'men' : g === 'female' ? 'women' : g === 'unisex' ? 'men' : g;
    const gender = genderApplicability ? normaliseGender(genderApplicability) : undefined;

    let processedImages: string[] | undefined = undefined;
    if (images !== undefined || req.body.image !== undefined) {
      const rawImagesList: string[] = images
        ? (Array.isArray(images) ? images : [images])
        : (req.body.image ? [req.body.image] : []);

      const itemSlug = slug || service_name || existingService.slug || 'service';
      processedImages = [];

      for (const rawImg of rawImagesList) {
        if (typeof rawImg === 'string' && rawImg.startsWith('data:image/')) {
          const storedUrl = await processAndStoreImage(rawImg, 'services', itemSlug);
          if (storedUrl) {
            processedImages.push(storedUrl);
            newlyUploadedImages.push(storedUrl);
          }
        } else if (rawImg) {
          processedImages.push(rawImg);
        }
      }
    }

    try {
      const updated = await ServiceRepository.update(req.params.id, {
        category_id: targetCategoryId,
        service_name,
        slug,
        description,
        base_price: base_price !== undefined ? parseFloat(base_price) : undefined,
        duration: duration !== undefined ? Number(duration) : undefined,
        images: processedImages,
        is_featured,
        gender_applicability: gender,
        status,
      });

      // Selective Invalidation for the target service & its category
      await invalidateServiceCacheSelective(existingService.id, targetCategoryId);

      // Best effort cleanup of any old images that were replaced
      if (processedImages && Array.isArray(existingService.images)) {
        const oldImagesToDelete = existingService.images.filter(
          (oldImg: string) => !processedImages!.includes(oldImg)
        );
        deleteMultipleStoredImages(oldImagesToDelete).catch((err) => {
          console.warn('[SERVICE UPDATE] Old image cleanup warning:', err?.message);
        });
      }

      res.json(updated);
    } catch (dbErr: any) {
      // If DB update fails, remove newly created images so DB still points to old working ones
      deleteMultipleStoredImages(newlyUploadedImages).catch(() => {});
      throw dbErr;
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a service
// @route   DELETE /api/services/:id
// @access  Private/Admin
export const deleteService = async (req: Request, res: Response): Promise<void> => {
  try {
    const service = await ServiceRepository.findById(req.params.id);
    if (!service) {
      res.status(404).json({ message: 'Service not found' });
      return;
    }

    await ServiceRepository.softDelete(req.params.id);

    // Selective Invalidation for the deleted service & its category
    await invalidateServiceCacheSelective(service.id, service.category_id);

    // ponytail: Retain image files on soft-delete so restored services keep original assets.
    // Permanent deletion is handled during hard purge or maintenance cleanup.

    res.json({ message: 'Service removed (soft delete) successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
