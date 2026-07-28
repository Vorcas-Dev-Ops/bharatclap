import { Request, Response } from 'express';
import axios from 'axios';
import mongoose from 'mongoose';
import { CategoryDispatchRule } from '../../models/CategoryDispatchRule';

const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://127.0.0.1:5002';

const DEFAULT_CATEGORIES = [
  { categoryName: 'Electricians', maxJobsPerDay: 20, maxConcurrentJobs: 3, isEmergencyEnabled: true },
  { categoryName: 'Cleaners & Housekeeping', maxJobsPerDay: 12, maxConcurrentJobs: 2, isEmergencyEnabled: false },
  { categoryName: 'Painters & Wall Care', maxJobsPerDay: 5, maxConcurrentJobs: 1, isEmergencyEnabled: false },
  { categoryName: 'Plumbers & Sanitization', maxJobsPerDay: 18, maxConcurrentJobs: 3, isEmergencyEnabled: true },
  { categoryName: 'Appliance Repair', maxJobsPerDay: 15, maxConcurrentJobs: 2, isEmergencyEnabled: true },
];

export const getCategoryRulesAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const savedRules = await CategoryDispatchRule.find({}).lean();
    const savedNameMap = new Map(savedRules.map(r => [r.categoryName, r]));
    const savedIdMap = new Map(savedRules.filter(r => r.category_id).map(r => [String(r.category_id), r]));

    let categories: Array<{ _id?: string; categoryName: string }> = [];

    try {
      const catRes = await axios.get(`${CATALOG_SERVICE_URL}/api/categories?includeInactive=true`, { timeout: 3000 });
      const catData = Array.isArray(catRes.data) ? catRes.data : (catRes.data?.data || []);
      if (Array.isArray(catData) && catData.length > 0) {
        categories = catData.map((c: any) => ({
          _id: c._id?.toString(),
          categoryName: c.category_name || c.name || c.categoryName
        }));
      }
    } catch {
      // Fallback if catalog service is unreachable
    }

    if (categories.length === 0) {
      categories = DEFAULT_CATEGORIES;
    }

    const combinedRules: any[] = categories.map(cat => {
      const saved = (cat._id ? savedIdMap.get(cat._id) : null) || savedNameMap.get(cat.categoryName);
      if (saved) {
        return {
          ...saved,
          category_id: cat._id || saved.category_id,
          categoryName: cat.categoryName || saved.categoryName
        };
      }
      return {
        category_id: cat._id,
        categoryName: cat.categoryName,
        maxJobsPerDay: 15,
        maxConcurrentJobs: 3,
        isEmergencyEnabled: true
      };
    });

    savedRules.forEach(r => {
      const existsInCombined = combinedRules.some(c => c.categoryName === r.categoryName || (r.category_id && String(c.category_id) === String(r.category_id)));
      if (!existsInCombined) {
        combinedRules.push(r);
      }
    });

    res.json(combinedRules);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const upsertCategoryRuleAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category_id, categoryName, maxJobsPerDay, maxConcurrentJobs, isEmergencyEnabled } = req.body;

    if (!categoryName && !category_id) {
      res.status(400).json({ message: 'Category identifier or categoryName is required' });
      return;
    }

    const filter: any = category_id ? { category_id } : { categoryName };

    const updateDoc: any = {
      categoryName,
      maxJobsPerDay: Number(maxJobsPerDay) || 15,
      maxConcurrentJobs: Number(maxConcurrentJobs) || 3,
      isEmergencyEnabled: isEmergencyEnabled !== false
    };

    if (category_id) {
      updateDoc.category_id = category_id;
    }

    const rule = await CategoryDispatchRule.findOneAndUpdate(
      filter,
      { $set: updateDoc },
      { upsert: true, new: true }
    );

    res.json({ success: true, rule });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

