import { Request, Response } from 'express';
import { SubService } from '../models/SubService';
import { Service } from '../models/Service';
import mongoose, { Schema } from 'mongoose';
import { getCache, setCache, deleteCache } from '../config/redis';
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
    const cacheKey = `catalog:subservices:srv:${serviceId}:loc:${locationId}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    const filter: any = { isDeleted: false, status: 'active' };
    if (req.query.service_id) {
      filter.service_id = req.query.service_id as string;
    }

    if (req.query.location_id && req.query.location_id !== "Select City") {
      try {
        if (req.query.location_id.toString().match(/^[0-9a-fA-F]{24}$/)) {
          const locId = req.query.location_id as string;

          // Check if this location is a city
          const locations = await getLocationsBatch([locId]);
          const selectedLoc = locations.length > 0 ? locations[0] : null;
          let targetLocationIds = [locId];

          if (selectedLoc && selectedLoc.type === 'city') {
            const allLocationsRes = await axios.get(`${process.env.AUTH_SERVICE_URL || 'http://localhost:5001'}/api/locations`).catch(() => ({ data: [] }));
            const allLocations = allLocationsRes.data;
            const childAreas = allLocations.filter((l: any) => String(l.parent_id) === locId && !l.isDeleted);
            const areaIds = childAreas.map((area: any) => area._id.toString());
            targetLocationIds = [...targetLocationIds, ...areaIds];
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

    const subServices = await SubService.find(filter)
      .populate({
        path: 'service_id',
        select: 'service_name category_id isDeleted',
        populate: {
          path: 'category_id',
          select: 'category_name'
        }
      })
      .sort({ createdAt: -1 });

    const activeSubServices = subServices.filter(ss => {
      const service = ss.service_id as any;
      return service && service.isDeleted !== true;
    });

    await setCache(cacheKey, activeSubServices, 3600); // 1 hour TTL
    res.json(activeSubServices);
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
    const cacheKey = `catalog:subservices:id:${req.params.id}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    const subService = await SubService.findById(req.params.id).populate({
      path: 'service_id',
      select: 'service_name category_id',
      populate: {
        path: 'category_id',
        select: 'category_name'
      }
    });
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
      base_price,
      duration,
      variants: variants || [],
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

    // Invalidate sub-services cache
    await deleteCache('catalog:subservices:*');

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
    subService.base_price = base_price ?? subService.base_price;
    subService.duration = duration ?? subService.duration;
    subService.variants = variants ?? subService.variants;
    subService.image = image ?? subService.image;
    subService.status = status ?? subService.status;

    const updated = await subService.save();
    const populated = await updated.populate({
      path: 'service_id',
      select: 'service_name',
      populate: {
        path: 'category_id',
        select: 'category_name'
      }
    });

    // Invalidate sub-services cache
    await deleteCache('catalog:subservices:*');

    res.json(populated);
  } catch (error: any) {
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

    // Invalidate sub-services cache
    await deleteCache('catalog:subservices:*');

    res.json({ message: 'Sub-service removed (soft delete) successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
