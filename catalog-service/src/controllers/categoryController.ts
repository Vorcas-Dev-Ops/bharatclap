import { Request, Response } from 'express';
import { Category } from '../models/Category';
import { getCache, setCache, deleteCache } from '../config/redis';

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'catalog:categories:all';
    const cachedData = await getCache(cacheKey);
    
    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    const categories = await Category.find({ isDeleted: false, status: 'active' }).sort({ createdAt: -1 });
    await setCache(cacheKey, categories, 3600); // 1 hour TTL
    
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
    const { category_name, slug, icon, description, status } = req.body;

    const exists = await Category.findOne({ $or: [{ category_name }, { slug }] });
    if (exists) {
      res.status(400).json({ message: 'Category with this name or slug already exists' });
      return;
    }

    const category = await Category.create({ 
      category_name, 
      slug: slug || category_name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''),
      icon, 
      description, 
      status 
    });

    // Invalidate categories cache
    await deleteCache('catalog:categories:*');

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

    const { category_name, slug, icon, description, status } = req.body;

    category.category_name = category_name ?? category.category_name;
    category.slug          = slug          ?? category.slug;
    category.icon          = icon          ?? category.icon;
    category.description   = description   ?? category.description;
    category.status        = status        ?? category.status;

    const updated = await category.save();

    // Invalidate categories cache
    await deleteCache('catalog:categories:*');

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
    
    // Invalidate categories cache
    await deleteCache('catalog:categories:*');

    res.json({ message: 'Category removed (soft delete) successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
