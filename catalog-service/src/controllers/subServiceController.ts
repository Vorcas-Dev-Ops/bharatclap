import { Request, Response } from 'express';
import { SubService } from '../models/SubService';
import { Service } from '../models/Service';
import mongoose, { Schema } from 'mongoose';
import { getCache, setCache, deleteCache } from '../config/redis';
import { invalidateSubServiceCacheSelective } from '../utils/cacheManager';
import axios from 'axios';
import { getLocationsBatch } from '../utils/internalApi';

// @desc    Get all sub-services (optionally filter by service)
// @route   GET /api/sub-services?service_id=xxx
// @access  Public
// Last updated: 2026-05-19T16:40
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

    const filter: any = { isDeleted: false };
    if (!includeInactive) {
      filter.status = 'active';
    }
    if (req.query.service_id && req.query.service_id !== 'all') {
      filter.service_id = req.query.service_id as string;
    }

    if (req.query.category_id) {
      const servicesInCat = await Service.find({ category_id: req.query.category_id, isDeleted: false }).select('_id').lean();
      const sIds = servicesInCat.map(s => s._id);

      if (filter.service_id) {
        // If both are provided, this would be weird, but we handle it
        filter.service_id = { $in: [filter.service_id].filter(id => sIds.some(s => s.toString() === id.toString())) };
      } else {
        filter.service_id = { $in: sIds };
      }
    }

    if (req.query.location_id && req.query.location_id !== "Select City") {
      try {
        if (req.query.location_id.toString().match(/^[0-9a-fA-F]{24}$/)) {
          const locId = req.query.location_id as string;

          const locCacheKey = `catalog:location_children:${locId}`;
          const cachedLocs = await getCache(locCacheKey);
          let targetLocationIds: string[] = [];

          if (cachedLocs) {
            targetLocationIds = JSON.parse(cachedLocs);
          } else {
            // Check if this location is a city
            const locations = await getLocationsBatch([locId]);
            const selectedLoc = locations.length > 0 ? locations[0] : null;
            targetLocationIds = [locId];

            if (selectedLoc && selectedLoc.type === 'city') {
              const allLocationsRes = await axios.get(`${process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001'}/api/locations?parent_id=${locId}&type=area`).catch(() => ({ data: [] }));
              const childAreas = allLocationsRes.data;
              const areaIds = childAreas.map((area: any) => area._id.toString());
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

          if (availableSubServiceIds && availableSubServiceIds.length > 0) {
            filter._id = { $in: availableSubServiceIds };
          } else {
            filter._id = { $in: [] };
          }
        }
      } catch (innerError) {
        console.error("Error filtering sub-services by location:", innerError);
      }
    }

    // Restrict query to subservices whose parent services are active (not deleted)
    const activeServices = await Service.find({ isDeleted: false }).select('_id').lean();
    const activeServiceIds = activeServices.map(s => s._id);

    if (filter.service_id) {
      if (filter.service_id.$in) {
        const allowedIds = filter.service_id.$in.filter((id: any) => 
          activeServiceIds.some(actId => actId.toString() === id.toString())
        );
        filter.service_id = { $in: allowedIds };
      } else {
        const singleId = filter.service_id;
        filter.service_id = activeServiceIds.some(actId => actId.toString() === singleId.toString())
          ? singleId
          : new mongoose.Types.ObjectId();
      }
    } else {
      filter.service_id = { $in: activeServiceIds };
    }

    const subServices = await SubService.find(filter)
      .populate({
        path: 'service_id',
        select: 'service_name category_id isDeleted',
        populate: {
          path: 'category_id',
          select: 'category_name'
        }
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    await setCache(cacheKey, subServices, 3600); // 1 hour TTL
    res.json(subServices);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single sub-service by ID
// @route   GET /api/sub-services/:id
// @access  Public
// Last updated: 2026-05-19T16:40
export const getSubServiceById = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetId = req.params.id;
    const cacheKey = `catalog:subservices:id:${targetId}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    let subService: any = null;
    const populateQuery = {
      path: 'service_id',
      select: 'service_name category_id',
      populate: {
        path: 'category_id',
        select: 'category_name'
      }
    };

    if (mongoose.Types.ObjectId.isValid(targetId)) {
      subService = await SubService.findById(targetId).populate(populateQuery);
    } else {
      subService = await SubService.findOne({
        $or: [
          { slug: targetId },
          { subservice_name: new RegExp(`^${targetId.replace(/[-_]/g, ' ')}$`, 'i') }
        ]
      }).populate(populateQuery);
    }

    if (!subService) {
      res.status(404).json({ message: 'Sub-service not found' });
      return;
    }

    await setCache(cacheKey, subService, 3600);
    res.json(subService);
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

    const serviceExists = await Service.findById(service_id);
    if (!serviceExists) {
      res.status(400).json({ message: 'Service not found' });
      return;
    }

    const subService = await SubService.create({
      service_id,
      subservice_name,
      description,
      // Legacy fields – kept for backward compatibility
      ...(base_price !== undefined && { base_price }),
      ...(duration !== undefined && { duration }),
      variants: variants || [],
      // New packages structure
      ...(packages !== undefined && { packages }),
      hasPackages: hasPackages ?? false,
      service_preparations: service_preparations || [],
      image,
      status,
    });

    const populated = await subService.populate({
      path: 'service_id',
      select: 'service_name',
      populate: {
        path: 'category_id',
        select: 'category_name'
      }
    });

    // Selective Invalidation for the new subservice & parent service
    await invalidateSubServiceCacheSelective(subService._id.toString(), service_id);

    res.status(201).json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a sub-service
// @route   PUT /api/sub-services/:id
// @access  Private/Admin
export const updateSubService = async (req: Request, res: Response): Promise<void> => {
  try {
    const subService = await SubService.findById(req.params.id);
    if (!subService) {
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

    if (service_id) {
      const serviceExists = await Service.findById(service_id);
      if (!serviceExists) {
        res.status(400).json({ message: 'Service not found' });
        return;
      }
      subService.service_id = service_id;
    }

    subService.subservice_name = subservice_name ?? subService.subservice_name;
    subService.description = description ?? subService.description;
    subService.image = image ?? subService.image;
    subService.status = status ?? subService.status;
    subService.service_preparations = service_preparations ?? subService.service_preparations;

    // Legacy fields – only update if explicitly sent
    if (base_price !== undefined) subService.base_price = base_price;
    if (duration !== undefined) subService.duration = duration;
    if (variants !== undefined) subService.variants = variants;

    if (hasPackages !== undefined) subService.hasPackages = hasPackages;

    if (hasPackages === false) {
      subService.packages = undefined; // explicitly unset packages array for flat pricing
    } else if (packages !== undefined) {
      subService.packages = packages;
    }

    if (service_preparations !== undefined) subService.service_preparations = service_preparations;

    const updated = await subService.save();
    
    const populated = await updated.populate({
      path: 'service_id',
      select: 'service_name',
      populate: {
        path: 'category_id',
        select: 'category_name'
      }
    });

    // Selective Invalidation for the target subservice & parent service
    await invalidateSubServiceCacheSelective(subService._id.toString(), subService.service_id?.toString());

    res.json(populated);
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
    const subService = await SubService.findById(req.params.id);
    if (!subService) {
      res.status(404).json({ message: 'Sub-service not found' });
      return;
    }
    subService.isDeleted = true;
    subService.status = 'inactive';
    await subService.save();

    // Selective Invalidation for the deleted subservice & parent service
    await invalidateSubServiceCacheSelective(subService._id.toString(), subService.service_id?.toString());

    res.json({ message: 'Sub-service removed (soft delete) successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
