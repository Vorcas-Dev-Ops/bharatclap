import { Request, Response } from 'express';
import { SubServiceRepository } from '../repositories/subServiceRepository';
import { ServiceRepository } from '../repositories/serviceRepository';
import { getCache, setCache } from '../config/redis';
import { invalidateSubServiceCacheSelective } from '../utils/cacheManager';
import axios from 'axios';
import { getLocationsBatch } from '../utils/internalApi';
import { processAndStoreImage, deleteStoredImage } from '../utils/imageStorage';

// @desc    Get all sub-services (optionally filter by service)
// @route   GET /api/sub-services?service_id=xxx
// @access  Public
export const getSubServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const serviceId = req.query.service_id ? String(req.query.service_id) : 'all';
    const locationId = req.query.location_id ? String(req.query.location_id) : 'all';
    const categoryId = req.query.category_id ? String(req.query.category_id) : 'all';
    const includeInactive = req.query.includeInactive === 'true';
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 100;

    const cacheKey = `catalog:subservices:srv:${serviceId}:cat:${categoryId}:loc:${locationId}:inactive:${includeInactive}:page:${page}:limit:${limit}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    let subserviceIds: string[] | undefined = undefined;

    if (req.query.location_id && req.query.location_id !== "Select City") {
      try {
        const locId = req.query.location_id as string;
        const locCacheKey = `catalog:location_children:${locId}`;
        const cachedLocs = await getCache(locCacheKey);
        let targetLocationIds: string[] = [];

        if (cachedLocs) {
          targetLocationIds = JSON.parse(cachedLocs);
        } else {
          const locations = await getLocationsBatch([locId]);
          const selectedLoc = locations.length > 0 ? locations[0] : null;
          targetLocationIds = [locId];

          if (selectedLoc && selectedLoc.type === 'city') {
            const allLocationsRes = await axios.get(`${process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001'}/api/locations?parent_id=${locId}&type=area`).catch(() => ({ data: [] }));
            const childAreas = allLocationsRes.data;
            const areaIds = childAreas.map((area: any) => (area._id || area.id).toString());
            targetLocationIds = [...targetLocationIds, ...areaIds];
          }
          await setCache(locCacheKey, JSON.stringify(targetLocationIds), 600); // 10 min TTL
        }

        // Fetch available subservice IDs from provider-service
        const providerRes = await axios.post(`${process.env.PROVIDER_SERVICE_URL || 'http://localhost:5003'}/api/providers/internal/active-subservices`, {
          location_ids: targetLocationIds
        }, {
          headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
        }).catch(() => ({ data: { subservice_ids: [] } }));

        const availableSubServiceIds = providerRes.data?.subservice_ids || [];
        subserviceIds = availableSubServiceIds;
      } catch (innerError) {
        console.error("Error filtering sub-services by location:", innerError);
      }
    }

    const subServices = await SubServiceRepository.findSubServices({
      serviceId: serviceId !== 'all' ? serviceId : undefined,
      categoryId: categoryId !== 'all' ? categoryId : undefined,
      subserviceIds,
      includeInactive,
      page,
      limit,
    });

    const formatted = subServices.map(s => ({
      ...s,
      service_id: s.service ? {
        _id: s.service.id,
        id: s.service.id,
        service_name: s.service.service_name,
        category_id: s.service.category_id ? {
          _id: s.service.category_id.id,
          id: s.service.category_id.id,
          category_name: s.service.category_id.category_name,
        } : undefined,
      } : s.service_id,
    }));

    await setCache(cacheKey, formatted, 3600); // 1 hour TTL
    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single sub-service by ID
// @route   GET /api/sub-services/:id
// @access  Public
export const getSubServiceById = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetId = req.params.id;
    const cacheKey = `catalog:subservices:id:${targetId}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    const subService = await SubServiceRepository.findById(targetId);
    if (!subService) {
      // Fallback: Check if targetId is a direct service without sub-services
      const srv = await ServiceRepository.findById(targetId);
      if (srv) {
        const directSub = {
          id: srv.id,
          _id: srv.id,
          service_id: {
            id: srv.id,
            _id: srv.id,
            service_name: srv.service_name,
            category_id: srv.category_id,
          },
          subservice_name: srv.service_name,
          name: srv.service_name,
          description: srv.description,
          has_packages: false,
          hasPackages: false,
          base_price: parseFloat(String(srv.base_price || 0)),
          basePrice: parseFloat(String(srv.base_price || 0)),
          currency: srv.currency || 'INR',
          duration: srv.duration,
          image: srv.images?.[0] || '',
          status: srv.status,
          service: {
            id: srv.id,
            _id: srv.id,
            service_name: srv.service_name,
            category_id: srv.category_id,
          }
        };
        await setCache(cacheKey, directSub, 3600);
        res.json(directSub);
        return;
      }
      res.status(404).json({ message: 'Sub-service not found' });
      return;
    }

    const formatted = {
      ...subService,
      service_id: subService.service ? {
        _id: subService.service.id,
        id: subService.service.id,
        service_name: subService.service.service_name,
        category_id: subService.service.category_id ? {
          _id: subService.service.category_id.id,
          id: subService.service.category_id.id,
          category_name: subService.service.category_id.category_name,
        } : undefined,
      } : subService.service_id,
    };

    await setCache(cacheKey, formatted, 3600);
    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new sub-service
// @route   POST /api/sub-services
// @access  Private/Admin
export const createSubService = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      service_id,
      subservice_name,
      description,
      base_price,
      duration,
      variants,
      packages,
      hasPackages,
      service_preparations,
      image,
      status
    } = req.body;

    const serviceExists = await ServiceRepository.findById(service_id);
    if (!serviceExists) {
      res.status(400).json({ message: 'Service not found' });
      return;
    }

    let processedImage: string | undefined = image;
    if (typeof image === 'string' && image.startsWith('data:image/')) {
      const itemSlug = subservice_name?.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') || 'subservice';
      processedImage = await processAndStoreImage(image, 'sub-services', itemSlug);
    }

    try {
      const subService = await SubServiceRepository.create({
        serviceId: serviceExists.id,
        subserviceName: subservice_name,
        description,
        basePrice: base_price !== undefined ? parseFloat(base_price) : undefined,
        duration: duration !== undefined ? Number(duration) : undefined,
        hasPackages: hasPackages ?? (Array.isArray(packages) && packages.length > 0),
        variants: variants || [],
        packages: packages || [],
        service_preparations: service_preparations || [],
        image: processedImage,
        status,
      });

      // Selective Invalidation for the new subservice & parent service
      await invalidateSubServiceCacheSelective(subService.id, serviceExists.id);

      const formatted = {
        ...subService,
        service_id: {
          _id: serviceExists.id,
          id: serviceExists.id,
          service_name: serviceExists.service_name,
          category_id: serviceExists.category ? {
            _id: serviceExists.category.id,
            id: serviceExists.category.id,
            category_name: serviceExists.category.category_name,
          } : undefined,
        }
      };

      res.status(201).json(formatted);
    } catch (dbErr: any) {
      if (processedImage && processedImage !== image) {
        deleteStoredImage(processedImage).catch(() => {});
      }
      throw dbErr;
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a sub-service
// @route   PUT /api/sub-services/:id
// @access  Private/Admin
export const updateSubService = async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await SubServiceRepository.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ message: 'Sub-service not found' });
      return;
    }

    const {
      service_id,
      subservice_name,
      description,
      base_price,
      duration,
      variants,
      packages,
      hasPackages,
      service_preparations,
      image,
      status
    } = req.body;

    let targetServiceId = existing.service_id;
    if (service_id) {
      const serviceExists = await ServiceRepository.findById(service_id);
      if (!serviceExists) {
        res.status(400).json({ message: 'Service not found' });
        return;
      }
      targetServiceId = serviceExists.id;
    }

    let processedImage: string | undefined = image;
    const oldImage = existing.image;
    let isNewUpload = false;

    if (typeof image === 'string' && image.startsWith('data:image/')) {
      const itemSlug = subservice_name || existing.subservice_name || 'subservice';
      processedImage = await processAndStoreImage(image, 'sub-services', itemSlug);
      isNewUpload = true;
    }

    try {
      const updated = await SubServiceRepository.update(req.params.id, {
        service_id: targetServiceId,
        subservice_name,
        description,
        base_price: base_price !== undefined ? parseFloat(base_price) : undefined,
        duration: duration !== undefined ? Number(duration) : undefined,
        has_packages: hasPackages,
        variants,
        packages,
        service_preparations,
        image: processedImage,
        status,
      });

      // Selective Invalidation for the target subservice & parent service
      await invalidateSubServiceCacheSelective(existing.id, targetServiceId);

      // Best-effort cleanup of old image after DB update confirmed
      if (isNewUpload && oldImage && processedImage !== oldImage) {
        deleteStoredImage(oldImage).catch((err) => {
          console.warn('[SUBSERVICE UPDATE] Old image cleanup warning:', err?.message);
        });
      }

      const formatted = {
        ...updated,
        service_id: updated?.service ? {
          _id: updated.service.id,
          id: updated.service.id,
          service_name: updated.service.service_name,
          category_id: updated.service.category_id ? {
            _id: updated.service.category_id.id,
            id: updated.service.category_id.id,
            category_name: updated.service.category_id.category_name,
          } : undefined,
        } : updated?.service_id,
      };

      res.json(formatted);
    } catch (dbErr: any) {
      // Rollback new upload on DB failure
      if (isNewUpload && processedImage) {
        deleteStoredImage(processedImage).catch(() => {});
      }
      throw dbErr;
    }
  } catch (error: any) {
    console.error(`[updateSubService] Error:`, error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a sub-service
// @route   DELETE /api/sub-services/:id
// @access  Private/Admin
export const deleteSubService = async (req: Request, res: Response): Promise<void> => {
  try {
    const subService = await SubServiceRepository.findById(req.params.id);
    if (!subService) {
      res.status(404).json({ message: 'Sub-service not found' });
      return;
    }

    await SubServiceRepository.softDelete(req.params.id);

    // Selective Invalidation for the deleted subservice & parent service
    await invalidateSubServiceCacheSelective(subService.id, subService.service_id);

    // ponytail: Retain image file on soft-delete so restored sub-services keep original assets.
    // Permanent deletion is handled during hard purge or maintenance cleanup.

    res.json({ message: 'Sub-service removed (soft delete) successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
