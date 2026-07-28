import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { CategoryDispatchRule } from '../../models/CategoryDispatchRule';

const DEFAULT_CATEGORIES = [
  { categoryName: 'Electricians', maxJobsPerDay: 20, maxConcurrentJobs: 3, isEmergencyEnabled: true },
  { categoryName: 'Cleaners & Housekeeping', maxJobsPerDay: 12, maxConcurrentJobs: 2, isEmergencyEnabled: false },
  { categoryName: 'Painters & Wall Care', maxJobsPerDay: 5, maxConcurrentJobs: 1, isEmergencyEnabled: false },
  { categoryName: 'Plumbers & Sanitization', maxJobsPerDay: 18, maxConcurrentJobs: 3, isEmergencyEnabled: true },
  { categoryName: 'Appliance Repair', maxJobsPerDay: 15, maxConcurrentJobs: 2, isEmergencyEnabled: true },
];

export const getCategoryRulesAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const dbRules = await CategoryDispatchRule.find({}).lean();
    const dbRulesByName = new Map(dbRules.map(r => [r.categoryName, r]));

    // Always merge saved DB rules with default categories so all categories are displayed
    const combinedRules = DEFAULT_CATEGORIES.map(def => {
      const saved = dbRulesByName.get(def.categoryName);
      if (saved) return { ...def, ...saved };
      return def;
    });

    // Include any additional custom categories saved in DB that aren't in default list
    const defaultNames = new Set(DEFAULT_CATEGORIES.map(d => d.categoryName));
    for (const r of dbRules) {
      if (!defaultNames.has(r.categoryName)) {
        combinedRules.push(r);
      }
    }

    res.json(combinedRules);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const upsertCategoryRuleAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category_id, categoryName, maxJobsPerDay, maxConcurrentJobs, isEmergencyEnabled } = req.body;

    if (!categoryName) {
      res.status(400).json({ message: 'categoryName is required' });
      return;
    }

    const filter = category_id ? { category_id } : { categoryName };

    const updateDoc: any = {
      categoryName,
      maxJobsPerDay: Number(maxJobsPerDay) || 15,
      maxConcurrentJobs: Number(maxConcurrentJobs) || 3,
      isEmergencyEnabled: isEmergencyEnabled !== false
    };

    if (category_id) {
      updateDoc.category_id = category_id;
    } else {
      // Ensure category_id is set if creating new document
      updateDoc.$setOnInsert = { category_id: new mongoose.Types.ObjectId() };
    }

    const rule = await CategoryDispatchRule.findOneAndUpdate(
      filter,
      updateDoc,
      { upsert: true, new: true }
    );

    res.json({ success: true, rule });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

