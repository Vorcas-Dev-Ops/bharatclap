import { Request, Response } from 'express';
import { AccessoryRepository } from '../repositories/accessoryRepository';
import { getCache, setCache, deleteCache } from '../config/redis';

// @desc    Get all accessories (optionally filter by category)
// @route   GET /api/accessories
// @access  Public
export const getAccessories = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, status, includeAll } = req.query;

    const cacheKey = `catalog:accessories:${category || 'all'}:${status || 'any'}:${includeAll || 'false'}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 100;

    const accessories = await AccessoryRepository.findWithFilters({
      category: category as string,
      status: status as string,
      includeAll: includeAll === 'true' || Boolean(req.headers.authorization),
      page,
      limit,
    });

    await setCache(cacheKey, accessories, 300);

    res.json(accessories);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single accessory by ID
// @route   GET /api/accessories/:id
// @access  Public
export const getAccessoryById = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `catalog:accessories:id:${req.params.id}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    const accessory = await AccessoryRepository.findById(req.params.id);
    if (!accessory) {
      res.status(404).json({ message: 'Accessory not found' });
      return;
    }

    await setCache(cacheKey, accessory, 3600);
    res.json(accessory);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new accessory
// @route   POST /api/accessories
// @access  Private/Admin
export const createAccessory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, price, image, category, status } = req.body;

    const accessory = await AccessoryRepository.create({
      title,
      description,
      price,
      image,
      category,
      status,
    });

    await deleteCache('catalog:accessories:*');

    res.status(201).json(accessory);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update an accessory
// @route   PUT /api/accessories/:id
// @access  Private/Admin
export const updateAccessory = async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await AccessoryRepository.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ message: 'Accessory not found' });
      return;
    }

    const { title, description, price, image, category, status } = req.body;

    const updated = await AccessoryRepository.update(req.params.id, {
      title,
      description,
      price,
      image,
      category,
      status,
    });

    await deleteCache('catalog:accessories:*');

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete an accessory
// @route   DELETE /api/accessories/:id
// @access  Private/Admin
export const deleteAccessory = async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await AccessoryRepository.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ message: 'Accessory not found' });
      return;
    }

    await AccessoryRepository.softDelete(req.params.id);
    await deleteCache('catalog:accessories:*');

    res.json({ message: 'Accessory removed (soft delete) successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
