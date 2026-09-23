import { getDb } from '../../config/db';
import { deleteFileFromCloud } from '../../utils/fileHelper';

// @desc    System task to cleanup expired KYC and Service documents
// @access  Internal/Admin
export const cleanupExpiredDocuments = async (): Promise<{ deletedCount: number }> => {
  try {
    const pool = getDb();

    // ── ProviderServices documents cleanup ───────────────────────────────────────
    const expiredDocsRes = await pool.query(
      `SELECT id, document_url, public_id
       FROM provider.provider_service_documents
       WHERE created_at < NOW() - INTERVAL '365 days'
       LIMIT 100`
    );

    await Promise.all(expiredDocsRes.rows.map(async (doc: any) => {
      if (doc.public_id) {
        await deleteFileFromCloud(doc.public_id).catch(() => {});
      } else if (doc.document_url) {
        await deleteFileFromCloud(doc.document_url).catch(() => {});
      }
    }));

    let deletedCount = 0;
    if (expiredDocsRes.rows.length > 0) {
      const ids = expiredDocsRes.rows.map(r => r.id);
      const delRes = await pool.query(
        `DELETE FROM provider.provider_service_documents WHERE id = ANY($1)`,
        [ids]
      );
      deletedCount = delRes.rowCount || 0;
    }

    console.log(`[STORAGE CLEANUP] Successfully removed documents from ${deletedCount} records.`);
    return { deletedCount };
  } catch (error) {
    console.error('[STORAGE CLEANUP] Task failed:', error);
    return { deletedCount: 0 };
  }
};
