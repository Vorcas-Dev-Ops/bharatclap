import { Request, Response } from 'express';
import { CommissionRepository } from '../repositories/commissionRepository';
import { CategoryRepository } from '../repositories/categoryRepository';

// @desc    Get all commissions
// @route   GET /api/commissions
// @access  Private/Admin
export const getCommissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const commissions = await CommissionRepository.findAll();
    res.json(commissions);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a commission rule
// @route   POST /api/commissions
// @access  Private/Admin
export const createCommission = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category_name, rate, status } = req.body;

    if (!category_name || rate === undefined) {
      res.status(400).json({ message: 'category_name and rate are required' });
      return;
    }

    const commission = await CommissionRepository.create({ category_name, rate, status: status || 'active' });
    res.status(201).json(commission);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk-upsert commissions for ALL categories with the given rate
// @route   PUT /api/commissions/bulk-update
// @access  Private/Admin
export const bulkUpdateCommissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rate } = req.body;

    if (rate === undefined || isNaN(Number(rate))) {
      res.status(400).json({ message: 'A valid rate is required' });
      return;
    }

    // Fetch all active categories from the database
    const allCategories = await CategoryRepository.findAll(true);

    if (!allCategories.length) {
      res.status(404).json({ message: 'No active categories found' });
      return;
    }

    // Upsert a commission record for each category
    for (const cat of allCategories) {
      const existing = await CommissionRepository.findByCategoryId(cat.id);
      if (existing) {
        await CommissionRepository.update(existing.id, { rate: Number(rate) });
      } else {
        await CommissionRepository.create({ categoryId: cat.id, category_name: cat.name, rate: Number(rate) });
      }
    }

    res.json({
      message: `${allCategories.length} categories updated successfully`,
      updatedCount: allCategories.length,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a commission rule
// @route   PUT /api/commissions/:id
// @access  Private/Admin
export const updateCommission = async (req: Request, res: Response): Promise<void> => {
  try {
    const commission = await CommissionRepository.findById(req.params.id);
    if (!commission) {
      res.status(404).json({ message: 'Commission not found' });
      return;
    }

    const { category_name, rate, status } = req.body;
    const updated = await CommissionRepository.update(req.params.id, {
      category_name,
      rate,
      status,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a commission rule (soft delete)
// @route   DELETE /api/commissions/:id
// @access  Private/Admin
export const deleteCommission = async (req: Request, res: Response): Promise<void> => {
  try {
    const commission = await CommissionRepository.findById(req.params.id);
    if (!commission) {
      res.status(404).json({ message: 'Commission not found' });
      return;
    }

    await CommissionRepository.delete(req.params.id);
    res.json({ message: 'Commission deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
