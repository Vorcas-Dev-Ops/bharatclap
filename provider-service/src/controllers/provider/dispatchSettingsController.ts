import { Request, Response } from 'express';
import { DispatchSetting } from '../../models/DispatchSetting';

export const getDispatchSettingsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    let settings = await DispatchSetting.findOne({}).lean();
    if (!settings) {
      settings = await DispatchSetting.create({
        distanceWeight: 40,
        ratingWeight: 20,
        priorityPackageWeight: 15,
        loadBalancingWeight: 15,
        recencyWeight: 10,
        maxConcurrentJobs: 3,
        maxJobsPerDay: 20,
        responseTimeoutSeconds: 600,
        dispatchRadiusMeters: 10000,
      }) as any;
    }
    res.json(settings);
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

    let settings = await DispatchSetting.findOne({});
    if (!settings) {
      settings = new DispatchSetting();
    }

    settings.distanceWeight = distanceWeight ?? 40;
    settings.ratingWeight = ratingWeight ?? 20;
    settings.priorityPackageWeight = priorityPackageWeight ?? 15;
    settings.loadBalancingWeight = loadBalancingWeight ?? 15;
    settings.recencyWeight = recencyWeight ?? 10;
    settings.maxConcurrentJobs = maxConcurrentJobs ?? 3;
    settings.maxJobsPerDay = maxJobsPerDay ?? 20;
    settings.responseTimeoutSeconds = responseTimeoutSeconds ?? 600;
    settings.dispatchRadiusMeters = dispatchRadiusMeters ?? 10000;

    await settings.save();
    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
