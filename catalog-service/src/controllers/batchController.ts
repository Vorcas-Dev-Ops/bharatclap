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
    const { subserviceIds, serviceIds, categoryIds, couponIds, populateRelated } = req.body;
    
    const responseData: any = {};
    let finalServiceIds = Array.isArray(serviceIds) ? [...serviceIds] : [];
    let finalCategoryIds = Array.isArray(categoryIds) ? [...categoryIds] : [];

    if (Array.isArray(subserviceIds) && subserviceIds.length > 0) {
      responseData.subservices = await SubService.find({ _id: { $in: subserviceIds } }).lean();
      if (populateRelated) {
        const extractedSIds = responseData.subservices.map((s: any) => s.service_id?.toString()).filter(Boolean);
        finalServiceIds = [...new Set([...finalServiceIds, ...extractedSIds])];
      }
    }

    if (finalServiceIds.length > 0) {
      responseData.services = await Service.find({ _id: { $in: finalServiceIds } }).lean();
      if (populateRelated) {
        const extractedCIds = responseData.services.map((s: any) => s.category_id?.toString()).filter(Boolean);
        finalCategoryIds = [...new Set([...finalCategoryIds, ...extractedCIds])];
      }
    }

    if (finalCategoryIds.length > 0) {
      responseData.categories = await Category.find({ _id: { $in: finalCategoryIds } }).select('category_name icon').lean();
    }

    if (Array.isArray(couponIds) && couponIds.length > 0) {
      responseData.coupons = await Coupon.find({ code: { $in: couponIds } }).lean();
    }

    res.json(responseData);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
