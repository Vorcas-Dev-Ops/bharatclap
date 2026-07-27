import { Request, Response } from 'express';
import { CategoryDispatchRule } from '../../models/CategoryDispatchRule';

export const getCategoryRulesAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    let rules = await CategoryDispatchRule.find({}).lean();
    if (rules.length === 0) {
      // Seed default category dispatch rules
      rules = [
        { categoryName: 'Electricians', maxJobsPerDay: 20, maxConcurrentJobs: 3, isEmergencyEnabled: true },
        { categoryName: 'Cleaners & Housekeeping', maxJobsPerDay: 12, maxConcurrentJobs: 2, isEmergencyEnabled: false },
        { categoryName: 'Painters & Wall Care', maxJobsPerDay: 5, maxConcurrentJobs: 1, isEmergencyEnabled: false },
        { categoryName: 'Plumbers & Sanitization', maxJobsPerDay: 18, maxConcurrentJobs: 3, isEmergencyEnabled: true },
        { categoryName: 'Appliance Repair', maxJobsPerDay: 15, maxConcurrentJobs: 2, isEmergencyEnabled: true },
      ] as any;
    }
    res.json(rules);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const upsertCategoryRuleAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category_id, categoryName, maxJobsPerDay, maxConcurrentJobs, isEmergencyEnabled } = req.body;

    const rule = await CategoryDispatchRule.findOneAndUpdate(
      { category_id },
      {
        $set: {
          categoryName,
          maxJobsPerDay: maxJobsPerDay || 15,
          maxConcurrentJobs: maxConcurrentJobs || 3,
          isEmergencyEnabled: isEmergencyEnabled !== false
        }
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, rule });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
