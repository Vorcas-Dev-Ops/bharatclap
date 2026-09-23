import { Request, Response } from 'express';
import axios from 'axios';
import { getDb } from '../../config/db';

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
    const pool = getDb();
    const savedRulesRes = await pool.query(`SELECT * FROM provider.category_dispatch_rules`);
    const savedRules = savedRulesRes.rows.map(r => ({
      _id: r.id,
      id: r.id,
      category_id: r.category_id,
      ...(r.rules || {})
    }));

    const savedNameMap = new Map(savedRules.map(r => [r.categoryName, r]));
    const savedIdMap = new Map(savedRules.filter(r => r.category_id).map(r => [String(r.category_id), r]));

    let categories: Array<{ _id?: string; categoryName: string }> = [];

    try {
      const catRes = await axios.get(`${CATALOG_SERVICE_URL}/api/categories?includeInactive=true`, { timeout: 3000 });
      const catData = Array.isArray(catRes.data) ? catRes.data : (catRes.data?.data || []);
      if (Array.isArray(catData) && catData.length > 0) {
        categories = catData.map((c: any) => ({
          _id: c._id?.toString() || c.id?.toString(),
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

    const rules = {
      categoryName,
      maxJobsPerDay: Number(maxJobsPerDay) || 15,
      maxConcurrentJobs: Number(maxConcurrentJobs) || 3,
      isEmergencyEnabled: isEmergencyEnabled !== false
    };

    const pool = getDb();

    // Find category uuid if string passed or default category
    let targetCatId = category_id;
    if (!targetCatId) {
      const catLookup = await pool.query(
        `SELECT id FROM catalog.categories WHERE name ILIKE $1 OR legacy_mongo_id = $1 LIMIT 1`,
        [categoryName]
      );
      targetCatId = catLookup.rows[0]?.id;
    }

    if (!targetCatId) {
      // Find any valid category or generate dummy UUID
      const fallbackCat = await pool.query(`SELECT id FROM catalog.categories LIMIT 1`);
      targetCatId = fallbackCat.rows[0]?.id || '00000000-0000-0000-0000-000000000000';
    }

    const existing = await pool.query(
      `SELECT id FROM provider.category_dispatch_rules
       WHERE category_id::text = $1 OR rules->>'categoryName' = $2
       LIMIT 1`,
      [targetCatId, categoryName]
    );

    let result;
    if (existing.rowCount && existing.rowCount > 0) {
      result = await pool.query(
        `UPDATE provider.category_dispatch_rules
         SET rules = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify(rules), existing.rows[0].id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO provider.category_dispatch_rules (
           category_id, rules
         ) VALUES ($1, $2)
         RETURNING *`,
        [targetCatId, JSON.stringify(rules)]
      );
    }

    const r = result.rows[0];
    res.json({
      success: true,
      rule: {
        _id: r.id,
        id: r.id,
        category_id: r.category_id,
        ...(r.rules || {})
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
