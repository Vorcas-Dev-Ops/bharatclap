import { Request, Response } from 'express';
import { Commission } from '../models/Commission';
import { Category } from '../models/Category';

// @desc    Get all commissions
// @route   GET /api/commissions
// @access  Private/Admin
export const getCommissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const commissions = await Commission.find({ isDeleted: false }).sort({ createdAt: -1 });
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

    const commission = await Commission.create({ category_name, rate, status: status || 'active' });
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

    // Fetch all active categories from the same DB
    const allCategories = await Category.find({ isDeleted: false, status: 'active' }).lean();

    if (!allCategories.length) {
      res.status(404).json({ message: 'No active categories found' });
      return;
    }

    // Upsert a commission record for each category (create if missing, update if exists)
    const upsertOps = allCategories.map((cat: any) => ({
      updateOne: {
        filter: { category_name: cat.category_name, isDeleted: false },
        update: { $set: { rate: Number(rate), status: 'active' as const, isDeleted: false } },
        upsert: true,
      },
    }));

    await Commission.bulkWrite(upsertOps);

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
    const commission = await Commission.findById(req.params.id);
    if (!commission || commission.isDeleted) {
      res.status(404).json({ message: 'Commission not found' });
      return;
    }

    const { category_name, rate, status } = req.body;
    commission.category_name = category_name ?? commission.category_name;
    commission.rate          = rate          ?? commission.rate;
    commission.status        = status        ?? commission.status;

    const updated = await commission.save();
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
    const commission = await Commission.findById(req.params.id);
    if (!commission || commission.isDeleted) {
      res.status(404).json({ message: 'Commission not found' });
      return;
    }

    commission.isDeleted = true;
    commission.status = 'inactive';
    await commission.save();

    res.json({ message: 'Commission deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
