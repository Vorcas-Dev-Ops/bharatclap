import { Request, Response } from 'express';
import { Category } from '../models/Category';
import { Service } from '../models/Service';
import { getCache, setCache, deleteCache } from '../config/redis';
import { invalidateCategoryCacheSelective } from '../utils/cacheManager';

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const cacheKey = `catalog:categories:inactive:${includeInactive}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    const filter: any = { isDeleted: false };
    if (!includeInactive) {
      filter.status = 'active';
    }
    const categories = await Category.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    
    // Get service counts for each category in a single aggregation query
    const categoryIds = categories.map(cat => cat._id);
    const serviceCounts = await Service.aggregate([
      { $match: { category_id: { $in: categoryIds }, isDeleted: false } },
      { $group: { _id: '$category_id', count: { $sum: 1 } } }
    ]);
    
    const countMap = new Map<string, number>(serviceCounts.map(item => [item._id.toString(), item.count]));

    const normalized = categories.map((cat: any) => ({
      ...cat,
      requiresGenderSelection: cat.requiresGenderSelection ?? false,
      services_count: countMap.get(cat._id.toString()) || 0
    }));
    
    await setCache(cacheKey, normalized, 3600); // 1 hour TTL
    res.json(normalized);
  } catch (error: any) {
    console.error('[CATALOG] getCategories error:', error?.message || error);
    const isDbError = error?.name === 'MongooseError' || error?.name === 'MongoNetworkError' || error?.message?.includes('buffering') || error?.message?.includes('ENOTFOUND');
    const message = isDbError ? 'Catalog database is currently unreachable. Please check network connection.' : (error?.message || 'Internal Server Error');
    res.status(500).json({ message });
  }
};

// @desc    Get single category by ID
// @route   GET /api/categories/:id
// @access  Public
export const getCategoryById = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `catalog:categories:id:${req.params.id}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404).json({ message: 'Category not found' });
      return;
    }
    // Normalize requiresGenderSelection so old documents without the field return false
    const normalized = {
      ...category.toObject(),
      requiresGenderSelection: category.requiresGenderSelection ?? false,
    };
    await setCache(cacheKey, normalized, 3600);
    res.json(normalized);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new category
// @route   POST /api/categories
// @access  Private/Admin
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category_name, code, slug, icon, description, status, requiresGenderSelection } = req.body;

    const exists = await Category.findOne({ $or: [{ category_name }, { slug }] });
    if (exists) {
      res.status(400).json({ message: 'Category with this name or slug already exists' });
      return;
    }

    const formattedCode = code ? String(code).trim().toUpperCase() : undefined;
    if (formattedCode && !/^[A-Z]{3,5}$/.test(formattedCode)) {
      res.status(400).json({ message: 'Category code must be 3-5 uppercase letters (e.g. ELE, PLM, ACT)' });
      return;
    }

    const category = await Category.create({
      category_name,
      code: formattedCode,
      slug: slug || category_name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''),
      icon,
      description,
      status,
      requiresGenderSelection: requiresGenderSelection ?? false,
    });

    // Selective Invalidation for the new category
    await invalidateCategoryCacheSelective(category._id.toString());

    res.status(201).json(category);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private/Admin
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404).json({ message: 'Category not found' });
      return;
    }

    const { category_name, code, slug, icon, description, status, requiresGenderSelection } = req.body;

    if (code !== undefined) {
      const formattedCode = String(code).trim().toUpperCase();
      if (!/^[A-Z]{3,5}$/.test(formattedCode)) {
        res.status(400).json({ message: 'Category code must be 3-5 uppercase letters (e.g. ELE, PLM, ACT)' });
        return;
      }
      if (category.codeLocked && category.code && category.code !== formattedCode) {
        res.status(400).json({ message: 'Category code is locked because providers are assigned to this category.' });
        return;
      }
      category.code = formattedCode;
    }

    category.category_name = category_name ?? category.category_name;
    category.slug = slug ?? category.slug;
    category.icon = icon ?? category.icon;
    category.description = description ?? category.description;
    category.status = status ?? category.status;
    category.requiresGenderSelection = requiresGenderSelection !== undefined
      ? requiresGenderSelection
      : category.requiresGenderSelection;

    const updated = await category.save();

    // Selective Invalidation for the updated category
    await invalidateCategoryCacheSelective(category._id.toString());

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404).json({ message: 'Category not found' });
      return;
    }

    category.isDeleted = true;
    category.status = 'inactive';
    await category.save();

    // Selective Invalidation for the deleted category
    await invalidateCategoryCacheSelective(category._id.toString());

    res.json({ message: 'Category removed (soft delete) successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
