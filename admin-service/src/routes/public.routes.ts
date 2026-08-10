import { Router, Request, Response } from 'express';
import { SettingsController } from '../controllers/settings.controller';

const router = Router();

// GET /api/v1/public/settings & /api/v1/platform/settings
router.get('/settings', SettingsController.getPublicSettings);

// GET /api/v1/public/legal/:slug
router.get('/legal/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  const docMeta: Record<string, { docId: string; version: string; title: string }> = {
    privacy: { docId: 'DOC-PRIV-2026-V2.4', version: '2.4', title: 'Privacy Policy' },
    terms: { docId: 'DOC-[#1D2B83]-2026-V2.4', version: '2.4', title: 'Terms & Conditions' },
    refunds: { docId: 'DOC-RFND-2026-V2.4', version: '2.4', title: 'Refund & Cancellation Policy' },
    cookies: { docId: 'DOC-COOK-2026-V1.2', version: '1.2', title: 'Cookie Policy' },
    community: { docId: 'DOC-COMM-2026-V2.0', version: '2.0', title: 'Community Guidelines' },
    provider: { docId: 'DOC-PROV-2026-V2.4', version: '2.4', title: 'Provider Guidelines' },
  };

  const meta = docMeta[slug] || { docId: `DOC-${slug.toUpperCase()}-2026-V1.0`, version: '1.0', title: 'Legal Policy' };

  res.status(200).json({
    success: true,
    data: {
      docId: meta.docId,
      version: meta.version,
      title: meta.title,
      effectiveDate: 'August 7, 2026',
      lastUpdated: 'August 7, 2026',
    }
  });
});

export default router;
