import { Request, Response } from 'express';
import { CategoryRepository } from '../repositories/categoryRepository';
import { ServiceRepository } from '../repositories/serviceRepository';
import { SubServiceRepository } from '../repositories/subServiceRepository';
import { CouponRepository } from '../repositories/couponRepository';

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
      responseData.subservices = await SubServiceRepository.findByIds(subserviceIds);
      if (populateRelated) {
        const extractedSIds = responseData.subservices.map((s: any) => s.service_id?.toString()).filter(Boolean);
        finalServiceIds = [...new Set([...finalServiceIds, ...extractedSIds])];
      }
    }

    if (finalServiceIds.length > 0) {
      responseData.services = await ServiceRepository.findByIds(finalServiceIds);
      if (populateRelated) {
        const extractedCIds = responseData.services.map((s: any) => s.category_id?.toString()).filter(Boolean);
        finalCategoryIds = [...new Set([...finalCategoryIds, ...extractedCIds])];
      }
    }

    if (finalCategoryIds.length > 0) {
      const allCategories = await CategoryRepository.findAll();
      responseData.categories = allCategories
        .filter(c => finalCategoryIds.includes(c.id) || (c.legacy_mongo_id && finalCategoryIds.includes(c.legacy_mongo_id)))
        .map(c => ({ _id: c.id, id: c.id, category_name: c.name, icon: c.icon }));
    }

    if (Array.isArray(couponIds) && couponIds.length > 0) {
      const allCoupons = await CouponRepository.findAll();
      responseData.coupons = allCoupons.filter(c => couponIds.includes(c.code) || couponIds.includes(c.id));
    }

    res.json(responseData);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
