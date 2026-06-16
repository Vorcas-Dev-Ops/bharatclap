import { Request, Response } from 'express';
import { Category } from '../models/Category';
import { Service } from '../models/Service';
import { SubService } from '../models/SubService';
import { Coupon } from '../models/Coupon';

// @desc    Get multiple catalog entities by IDs (Internal API)
// @route   POST /api/batch
// @access  Public (Internal)
export const getCatalogBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subserviceIds, serviceIds, categoryIds, couponIds } = req.body;
    
    const responseData: any = {};

    if (Array.isArray(categoryIds) && categoryIds.length > 0) {
      responseData.categories = await Category.find({ _id: { $in: categoryIds } }).select('category_name icon').lean();
    }

    if (Array.isArray(serviceIds) && serviceIds.length > 0) {
      responseData.services = await Service.find({ _id: { $in: serviceIds } }).lean();
    }

    if (Array.isArray(subserviceIds) && subserviceIds.length > 0) {
      responseData.subservices = await SubService.find({ _id: { $in: subserviceIds } }).lean();
    }

    if (Array.isArray(couponIds) && couponIds.length > 0) {
      responseData.coupons = await Coupon.find({ code: { $in: couponIds } }).lean();
    }

    res.json(responseData);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
