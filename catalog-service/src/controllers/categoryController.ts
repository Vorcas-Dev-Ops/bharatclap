import { Request, Response } from 'express';
import { CategoryRepository } from '../repositories/categoryRepository';
import { BannerRepository } from '../repositories/bannerRepository';
import { OfferRepository } from '../repositories/offerRepository';
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

    const categories = await CategoryRepository.findAll();

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

    const category = await CategoryRepository.findById(req.params.id);
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

    const existingCategory = await CategoryRepository.findByName(targetName);
    if (existingCategory) {
      res.status(400).json({ message: 'Category with this name already exists' });
      return;
    }

    const category = await CategoryRepository.create({
      name: targetName,
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
    const category = await CategoryRepository.findById(req.params.id);
    if (!category) {
      res.status(404).json({ message: 'Category not found' });
      return;
    }

    const { name, category_name, code, slug, icon, description, status, requiresGenderSelection } = req.body;

    const updates: Record<string, any> = {};

    if (code !== undefined) {
      const formattedCode = String(code).trim().toUpperCase();
      if (!/^[A-Z]{3,5}$/.test(formattedCode)) {
        res.status(400).json({ message: 'Category code must be 3-5 uppercase letters (e.g. ELE, PLM, ACT)' });
        return;
      }
      if (category.code_locked && category.category_code && category.category_code !== formattedCode) {
        res.status(400).json({ message: 'Category code is locked because providers are assigned to this category.' });
        return;
      }
      updates.category_code = formattedCode;
    }

    const targetName = name || category_name;
    if (targetName) {
      updates.name = targetName;
    }

    if (slug !== undefined) updates.slug = slug;
    if (icon !== undefined) updates.icon = icon;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (requiresGenderSelection !== undefined) updates.requires_gender_selection = requiresGenderSelection;

    const updated = await CategoryRepository.update(category.id, updates);

    await invalidateCategoryCacheSelective(category.id);

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
    const category = await CategoryRepository.findById(req.params.id);
    if (!category) {
      res.status(404).json({ message: 'Category not found' });
      return;
    }

    await CategoryRepository.softDelete(category.id);

    await invalidateCategoryCacheSelective(category.id);

    res.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get aggregated home bundle (categories + banners + offers) with 1-hour Redis cache
// @route   GET /api/categories/home-bundle
// @access  Public
export const getHomeBundle = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'catalog:home:bundle';
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      recordCacheHit(cacheKey);
      res.json(JSON.parse(cachedData));
      return;
    }

    const [categories, banners, offers] = await Promise.all([
      CategoryRepository.findAll(true),
      BannerRepository.findAll(true),
      OfferRepository.findAll(true),
    ]);

    const bundle = { categories, banners, offers };
    await setCache(cacheKey, bundle, 3600);

    res.json(bundle);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
