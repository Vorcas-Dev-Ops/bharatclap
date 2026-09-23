import { Request, Response } from 'express';
import { getDb } from '../../config/db';

const DEFAULT_SETTINGS = {
  distanceWeight: 40,
  ratingWeight: 20,
  priorityPackageWeight: 15,
  loadBalancingWeight: 15,
  recencyWeight: 10,
  maxConcurrentJobs: 3,
  maxJobsPerDay: 20,
  responseTimeoutSeconds: 600,
  dispatchRadiusMeters: 10000,
};

export const getDispatchSettingsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const pool = getDb();
    const result = await pool.query(`SELECT settings FROM provider.dispatch_settings LIMIT 1`);
    if (result.rowCount === 0) {
      await pool.query(
        `INSERT INTO provider.dispatch_settings (settings) VALUES ($1)`,
        [JSON.stringify(DEFAULT_SETTINGS)]
      );
      res.json(DEFAULT_SETTINGS);
      return;
    }
    res.json(result.rows[0].settings || DEFAULT_SETTINGS);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateDispatchSettingsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      distanceWeight,
      ratingWeight,
      priorityPackageWeight,
      loadBalancingWeight,
      recencyWeight,
      maxConcurrentJobs,
      maxJobsPerDay,
      responseTimeoutSeconds,
      dispatchRadiusMeters,
    } = req.body;

    const pool = getDb();
    const existing = await pool.query(`SELECT id, settings FROM provider.dispatch_settings LIMIT 1`);

    const current = existing.rows[0]?.settings || DEFAULT_SETTINGS;
    const newSettings = {
      ...current,
      distanceWeight: distanceWeight ?? current.distanceWeight ?? 40,
      ratingWeight: ratingWeight ?? current.ratingWeight ?? 20,
      priorityPackageWeight: priorityPackageWeight ?? current.priorityPackageWeight ?? 15,
      loadBalancingWeight: loadBalancingWeight ?? current.loadBalancingWeight ?? 15,
      recencyWeight: recencyWeight ?? current.recencyWeight ?? 10,
      maxConcurrentJobs: maxConcurrentJobs ?? current.maxConcurrentJobs ?? 3,
      maxJobsPerDay: maxJobsPerDay ?? current.maxJobsPerDay ?? 20,
      responseTimeoutSeconds: responseTimeoutSeconds ?? current.responseTimeoutSeconds ?? 600,
      dispatchRadiusMeters: dispatchRadiusMeters ?? current.dispatchRadiusMeters ?? 10000,
    };

    if (existing.rowCount && existing.rowCount > 0) {
      await pool.query(
        `UPDATE provider.dispatch_settings
         SET settings = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(newSettings), existing.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO provider.dispatch_settings (settings) VALUES ($1)`,
        [JSON.stringify(newSettings)]
      );
    }

    res.json({ success: true, settings: newSettings });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
