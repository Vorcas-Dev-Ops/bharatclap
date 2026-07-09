import { Provider } from '../../models/Provider';
import { ProviderService } from '../../models/ProviderService';
import { deleteFileFromCloud } from '../../utils/fileHelper';

// @desc    System task to cleanup expired KYC and Service documents
// @access  Internal/Admin
export const cleanupExpiredDocuments = async (): Promise<{ deletedCount: number }> => {
  try {
    const now = new Date();

    // ── Providers: delete cloud files then bulkWrite in 2 round-trips ────────
    const expiredProviders = await Provider.find({
      verification_docs_expiry: { $lte: now },
      kyc_status: 'verified'
    }).limit(100).lean();

    // Fire cloud deletions in parallel
    await Promise.all(expiredProviders.map(async (p) => {
      if (!p.verification_docs) return;
      if (p.verification_docs.public_id) {
        await deleteFileFromCloud(p.verification_docs.public_id, p.verification_docs.resource_type).catch(() => {});
      } else if (p.verification_docs.id_proof_url) {
        await deleteFileFromCloud(p.verification_docs.id_proof_url).catch(() => {});
      }
    }));

    // Single bulkWrite for all provider doc resets
    if (expiredProviders.length > 0) {
      await Provider.bulkWrite(
        expiredProviders.map(p => ({
          updateOne: {
            filter: { _id: p._id },
            update: { $set: { verification_docs: { id_proof_url: '' } }, $unset: { verification_docs_expiry: '' } }
          }
        }))
      );
    }

    // ── ProviderServices: same pattern ───────────────────────────────────────
    const expiredServices = await ProviderService.find({
      documents_expiry: { $lte: now },
      'documents.0': { $exists: true }
    }).limit(100).lean();

    await Promise.all(expiredServices.flatMap((svc: any) =>
      (svc.documents || []).map(async (doc: any) => {
        if (doc.public_id) {
          await deleteFileFromCloud(doc.public_id, doc.resource_type).catch(() => {});
        } else if (doc.file_url) {
          await deleteFileFromCloud(doc.file_url).catch(() => {});
        }
      })
    ));

    if (expiredServices.length > 0) {
      await ProviderService.bulkWrite(
        expiredServices.map((svc: any) => ({
          updateOne: {
            filter: { _id: svc._id },
            update: { $set: { documents: [] }, $unset: { documents_expiry: '' } }
          }
        }))
      );
    }

    const count = expiredProviders.length + expiredServices.length;
    console.log(`[STORAGE CLEANUP] Successfully removed documents from ${count} records.`);
    return { deletedCount: count };
  } catch (error) {
    console.error('[STORAGE CLEANUP] Task failed:', error);
    return { deletedCount: 0 };
  }
};
