import { Request, Response } from 'express';
import { Accessory } from '../models/Accessory';
import { getCache, setCache, deleteCache } from '../config/redis';

// @desc    Get all accessories (optionally filter by category)
// @route   GET /api/accessories
// @access  Public
export const getAccessories = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;
    const filter: any = { isDeleted: false, status: 'active' };
    
    if (category) {
      filter.category = category;
    }

    const cacheKey = category ? `catalog:accessories:category:${category}` : 'catalog:accessories:all';
    const cachedData = await getCache(cacheKey);
    
    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const accessories = await Accessory.find(filter)
      .populate('category', 'category_name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    await setCache(cacheKey, accessories, 3600);
    
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

    const accessory = await Accessory.findById(req.params.id).populate('category', 'category_name');
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

    const accessory = await Accessory.create({ 
      title, 
      description, 
      price, 
      image, 
      category, 
      status 
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
    const accessory = await Accessory.findById(req.params.id);
    if (!accessory) {
      res.status(404).json({ message: 'Accessory not found' });
      return;
    }

    const { title, description, price, image, category, status } = req.body;

    accessory.title       = title       ?? accessory.title;
    accessory.description = description ?? accessory.description;
    accessory.price       = price       ?? accessory.price;
    accessory.image       = image       ?? accessory.image;
    accessory.category    = category    ?? accessory.category;
    accessory.status      = status      ?? accessory.status;

    const updated = await accessory.save();

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
    const accessory = await Accessory.findById(req.params.id);
    if (!accessory) {
      res.status(404).json({ message: 'Accessory not found' });
      return;
    }
    
    accessory.isDeleted = true;
    accessory.status = 'inactive';
    await accessory.save();
    
    await deleteCache('catalog:accessories:*');

    res.json({ message: 'Accessory removed (soft delete) successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
