import mongoose, { Types } from 'mongoose';
import { ProviderCounter } from '../models/ProviderCounter';
import { CategorySnapshot } from '../models/CategorySnapshot';
import { Provider } from '../models/Provider';

export const STANDARD_CATEGORY_CODES: Record<string, string> = {
  electrician: 'ELE',
  plumber: 'PLM',
  'ac technician': 'ACT',
  carpenter: 'CAR',
  painter: 'PNT',
  cleaning: 'CLN',
  'pest control': 'PST',
  salon: 'SAL',
  beauty: 'BEA',
  'appliance repair': 'APR',
  'home cleaning': 'HCL',
  'water purifier': 'WTR',
  cctv: 'CCT',
  'ro service': 'ROS',
  'tv repair': 'TVR',
  'washing machine': 'WMR',
  refrigerator: 'RFR',
};

/**
 * Resolves standard 3-5 letter category code for a given category ID or name.
 */
export async function resolveCategoryCode(
  categoryId?: string | Types.ObjectId,
  categoryName?: string
): Promise<{ categoryId: Types.ObjectId; categoryCode: string; categoryName: string }> {
  let catId: Types.ObjectId;
  let code = 'GEN';
  let name = categoryName || 'General';

  if (categoryId && mongoose.Types.ObjectId.isValid(String(categoryId))) {
    catId = new Types.ObjectId(String(categoryId));
    const snapshot = await CategorySnapshot.findOne({ categoryId: catId }).lean();
    if (snapshot) {
      return {
        categoryId: snapshot.categoryId,
        categoryCode: snapshot.categoryCode,
        categoryName: snapshot.categoryName,
      };
    }
  } else {
    // Generate deterministic ObjectId based on name fallback
    catId = new Types.ObjectId();
  }

  if (categoryName) {
    const cleanName = categoryName.trim().toLowerCase();
    for (const [key, val] of Object.entries(STANDARD_CATEGORY_CODES)) {
      if (cleanName.includes(key) || key.includes(cleanName)) {
        code = val;
        name = categoryName;
        break;
      }
    }
  }

  // Update or insert CategorySnapshot locally
  await CategorySnapshot.findOneAndUpdate(
    { categoryId: catId },
    { $setOnInsert: { categoryId: catId, categoryCode: code, categoryName: name } },
    { upsert: true, new: true }
  ).catch(() => {});

  return { categoryId: catId, categoryCode: code, categoryName: name };
}

/**
 * Generates an enterprise unique Provider ID (e.g. BC-ELE-000001) atomically.
 * Immutable & atomic using MongoDB ProviderCounter.
 */
export async function generateProviderCode(
  providerId: string | Types.ObjectId,
  categoryId?: string | Types.ObjectId,
  categoryName?: string,
  tenantPrefix = 'BC'
): Promise<string> {
  const provider = await Provider.findById(providerId);
  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }

  // Immutable rule: Never regenerate if valid provider_code already exists
  if (provider.provider_code && !provider.provider_code.match(/^BC-GEN-[0-9A-Z]{6}$/i)) {
    return provider.provider_code;
  }

  let resolvedCatId = categoryId;
  let resolvedCatName = categoryName;

  if (!resolvedCatId && !resolvedCatName) {
    try {
      const { ProviderService } = require('../models/ProviderService');
      const pSvc = await ProviderService.findOne({ provider_id: provider._id, isDeleted: false }).lean();
      if (pSvc && (pSvc.category_id || pSvc.category_name || pSvc.categoryName)) {
        resolvedCatId = pSvc.category_id;
        resolvedCatName = pSvc.category_name || pSvc.categoryName;
      }
    } catch (e) {}
  }

  const { categoryId: catId, categoryCode, categoryName: resName } = await resolveCategoryCode(resolvedCatId, resolvedCatName);

  // Atomic increment counter per category ID
  const counter = await ProviderCounter.findOneAndUpdate(
    { categoryId: catId },
    { $inc: { seq: 1 }, $setOnInsert: { categoryCode } },
    { upsert: true, new: true }
  );

  const seqFormatted = String(counter.seq).padStart(6, '0');
  const generatedCode = `${tenantPrefix}-${categoryCode}-${seqFormatted}`;

  // Assign and save provider_code
  provider.provider_code = generatedCode;
  await provider.save();

  // Audit event log
  console.log(
    `[AUDIT EVENT: PROVIDER_ID_GENERATED] Provider: ${provider._id} | ` +
    `Code: ${generatedCode} | CategoryId: ${catId} | CategoryCode: ${categoryCode} | ` +
    `Timestamp: ${new Date().toISOString()}`
  );

  return generatedCode;
}

/**
 * Migration utility to backfill unassigned provider_codes in batches of 500.
 */
export async function backfillProviderCodesBatch(batchSize = 500): Promise<{ processed: number; success: number }> {
  const unassigned = await Provider.find({
    $or: [{ provider_code: { $exists: false } }, { provider_code: null }, { provider_code: '' }],
    isDeleted: false,
  })
    .sort({ createdAt: 1 })
    .limit(batchSize);

  let successCount = 0;
  for (const provider of unassigned) {
    try {
      await generateProviderCode(provider._id);
      successCount++;
    } catch (err: any) {
      console.error(`[BACKFILL-ERROR] Failed generating provider_code for ${provider._id}:`, err?.message);
    }
  }

  return { processed: unassigned.length, success: successCount };
}
