import { Request, Response } from 'express';
import { Category } from '../models/Category';
import { Service } from '../models/Service';
import { SubService } from '../models/SubService';
import { getCache, setCache, invalidateCategoryCacheSelective, recordCacheHit } from '../utils/cacheManager';

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'catalog:categories:all';
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      recordCacheHit(cacheKey);
      res.json(JSON.parse(cachedData));
      return;
    }

    const categories = await Category.find().sort({ createdAt: -1 });

    await setCache(cacheKey, categories, 3600);

    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
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
      recordCacheHit(cacheKey);
      res.json(JSON.parse(cachedData));
      return;
    }

    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404).json({ message: 'Category not found' });
      return;
    }

    await setCache(cacheKey, category, 3600);

    res.json(category);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new category
// @route   POST /api/categories
// @access  Private/Admin
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, category_name, code, slug, icon, description, status, requiresGenderSelection } = req.body;

    const targetName = name || category_name;
    if (!targetName) {
      res.status(400).json({ message: 'Category name is required' });
      return;
    }

    const existingCategory = await Category.findOne({ name: targetName });
    if (existingCategory) {
      res.status(400).json({ message: 'Category with this name already exists' });
      return;
    }

    const category = await Category.create({
      name: targetName,
      category_name: targetName,
      code: code ? String(code).trim().toUpperCase() : undefined,
      slug: slug || targetName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''),
      icon,
      description: description || targetName,
      requiresGenderSelection: requiresGenderSelection || false,
      status: status || 'active',
    });

    await invalidateCategoryCacheSelective();

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

    const { name, category_name, code, slug, icon, description, status, requiresGenderSelection } = req.body;

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

    const targetName = name || category_name;
    if (targetName) {
      category.name = targetName;
      category.category_name = targetName;
    } else if (!category.name) {
      category.name = category.category_name || 'Category';
    }

    category.slug = slug ?? category.slug;
    category.icon = icon ?? category.icon;
    category.description = description ?? (category.description || category.name);
    category.status = status ?? category.status;
    category.requiresGenderSelection = requiresGenderSelection !== undefined
      ? requiresGenderSelection
      : category.requiresGenderSelection;

    const updated = await category.save();

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

    await invalidateCategoryCacheSelective(category._id.toString());

    res.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
