import { Request, Response } from 'express';
import { Service } from '../models/Service';
import { Category } from '../models/Category';
import { getCache, setCache, deleteCache } from '../config/redis';

// @desc    Get all services (optionally filter by category)
// @route   GET /api/services?category_id=xxx
// @access  Public
export const getServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryId = req.query.category_id ? String(req.query.category_id) : 'all';
    const gender     = req.query.gender ? String(req.query.gender) : null;
    const cacheKey = `catalog:services:cat:${categoryId}:gender:${gender ?? 'all'}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    const filter: any = { isDeleted: false };

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

    // Invalidate services cache
    await deleteCache('catalog:services:*');

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

    service.service_name       = service_name       ?? service.service_name;
    service.slug               = slug               ?? service.slug;
    service.description        = description        ?? service.description;
    service.base_price         = base_price         ?? service.base_price;
    service.duration           = duration           ?? service.duration;
    if (images) service.images = Array.isArray(images) ? images : [images];
    service.is_featured        = is_featured        ?? service.is_featured;
    // Normalise old enum values ('male'→'men', 'female'→'women') from DB documents
    const normaliseGender = (g: string) => g === 'male' ? 'men' : g === 'female' ? 'women' : g === 'unisex' ? 'men' : g;
    service.genderApplicability = normaliseGender(genderApplicability ?? service.genderApplicability) as any;
    service.status             = status             ?? service.status;

    const updated = await service.save();
    const populated = await updated.populate('category_id', 'category_name icon requiresGenderSelection');

    // Invalidate services cache
    await deleteCache('catalog:services:*');

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

    // Invalidate services cache
    await deleteCache('catalog:services:*');

    res.json({ message: 'Service removed (soft delete) successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
