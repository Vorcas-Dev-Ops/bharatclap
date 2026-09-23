import { getDb } from '../config/db';

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

export function resolveCategoryCode(
  categoryName?: string
): { categoryCode: string; categoryName: string } {
  let code = 'GEN';
  let name = categoryName || 'General';

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

  return { categoryCode: code, categoryName: name };
}

/**
 * Generates an enterprise unique Provider ID (e.g. BC-ELE-000001) atomically.
 */
export async function generateProviderCode(
  providerId: string,
  categoryName?: string,
  tenantPrefix = 'BC'
): Promise<string> {
  const db = getDb();
  const { categoryCode } = resolveCategoryCode(categoryName);

  // Count existing provider codes for suffix
  const countRes = await db.query(
    `SELECT COUNT(*)::int AS count FROM provider.providers WHERE provider_code IS NOT NULL`
  );
  const nextSeq = (Number(countRes.rows[0]?.count) || 0) + 1;
  const seqFormatted = String(nextSeq).padStart(6, '0');
  const generatedCode = `${tenantPrefix}-${categoryCode}-${seqFormatted}`;

  await db.query(
    `UPDATE provider.providers
     SET provider_code = $1,
         updated_at = NOW()
     WHERE (id::text = $2 OR legacy_mongo_id = $2)
       AND provider_code IS NULL`,
    [generatedCode, providerId]
  );

  return generatedCode;
}

export async function backfillProviderCodesBatch(batchSize = 500): Promise<{ processed: number; success: number }> {
  const db = getDb();
  const unassignedRes = await db.query(
    `SELECT id FROM provider.providers
     WHERE provider_code IS NULL
       AND deleted_at IS NULL
     ORDER BY created_at ASC
     LIMIT $1`,
    [batchSize]
  );

  let successCount = 0;
  for (const row of unassignedRes.rows) {
    try {
      await generateProviderCode(String(row.id));
      successCount++;
    } catch (err: any) {
      console.error(`[BACKFILL-ERROR] Failed generating provider_code for ${row.id}:`, err?.message);
    }
  }

  return { processed: unassignedRes.rows.length, success: successCount };
}
