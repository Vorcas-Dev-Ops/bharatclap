import { Request, Response } from 'express';
import { CategoryRepository } from '../repositories/categoryRepository';
import { BannerRepository } from '../repositories/bannerRepository';
import { OfferRepository } from '../repositories/offerRepository';
import { getCache, setCache, invalidateCategoryCacheSelective, recordCacheHit } from '../utils/cacheManager';
import { processAndStoreImage, deleteStoredImage } from '../utils/imageStorage';

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

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, category_name, code, slug, icon, image, description, status, requiresGenderSelection } = req.body;

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

    const categorySlug = slug || targetName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    const rawImage = image || icon;
    let processedImage: string | undefined;

    if (rawImage) {
      processedImage = await processAndStoreImage(rawImage, 'categories', categorySlug);
    }

    try {
      const category = await CategoryRepository.create({
        name: targetName,
        code: code ? String(code).trim().toUpperCase() : undefined,
        slug: categorySlug,
        icon: processedImage,
        image: processedImage,
        description: description || targetName,
        requiresGenderSelection: requiresGenderSelection || false,
        status: status || 'active',
      });

      await invalidateCategoryCacheSelective();

      res.status(201).json(category);
    } catch (dbErr: any) {
      if (processedImage) {
        deleteStoredImage(processedImage).catch(() => {});
      }
      throw dbErr;
    }
  } catch (error: any) {
    if (error?.code === '23505') {
      res.status(400).json({ message: 'A category with this name or slug already exists.' });
      return;
    }
    console.error('[CREATE CATEGORY ERROR]', error?.message || error);
    res.status(500).json({ message: error.message || 'Failed to create category' });
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

    const { name, category_name, code, slug, icon, image, description, status, requiresGenderSelection } = req.body;

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

    const categorySlug = slug || category.slug || (targetName ? targetName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') : 'category');
    if (slug !== undefined) updates.slug = slug;

    const oldImage = category.image || category.icon;
    const rawImage = image !== undefined ? image : icon;
    let newProcessedImage: string | undefined;

    if (rawImage !== undefined) {
      newProcessedImage = await processAndStoreImage(rawImage, 'categories', categorySlug);
      updates.image = newProcessedImage;
      updates.icon = newProcessedImage;
    }

    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (requiresGenderSelection !== undefined) updates.requires_gender_selection = requiresGenderSelection;

    try {
      const updated = await CategoryRepository.update(category.id, updates);

      await invalidateCategoryCacheSelective(category.id);

      // Best-effort cleanup of old image after DB update confirmed
      if (newProcessedImage && oldImage && newProcessedImage !== oldImage) {
        deleteStoredImage(oldImage).catch((err) => {
          console.warn('[CATEGORY UPDATE] Old image cleanup warning:', err?.message);
        });
      }

      res.json(updated);
    } catch (dbErr: any) {
      // If DB update fails, clean up new file so DB still safely points to old image
      if (newProcessedImage && newProcessedImage !== oldImage) {
        deleteStoredImage(newProcessedImage).catch(() => {});
      }
      throw dbErr;
    }
  } catch (error: any) {
    if (error?.code === '23505') {
      res.status(400).json({ message: 'A category with this name or slug already exists.' });
      return;
    }
    console.error('[UPDATE CATEGORY ERROR]', error?.message || error);
    res.status(500).json({ message: error.message || 'Failed to update category' });
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

    // ponytail: Retain image file on soft-delete so restored categories keep original assets.
    // Permanent deletion is handled during hard purge or maintenance cleanup.

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
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');

    const cacheKey = 'catalog:home:bundle';
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      recordCacheHit(cacheKey);
      res.json(JSON.parse(cachedData));
      return;
    }

    const [categories, banners, offers] = await Promise.all([
      CategoryRepository.findAll(true),
      BannerRepository.findAll(true, undefined, 'user'),
      OfferRepository.findAll(true),
    ]);

    // Omit duplicate identical base64 strings to cut JSON payload size in half
    const sanitizedCategories = categories.map((cat: any) => {
      if (cat.icon && cat.image === cat.icon) {
        const { image, ...rest } = cat;
        return rest;
      }
      return cat;
    });

    const bundle = { categories: sanitizedCategories, banners, offers };
    await setCache(cacheKey, bundle, 3600);

    res.json(bundle);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
