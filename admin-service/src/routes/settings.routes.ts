import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';
import { requirePermission } from '../middlewares/permissionMiddleware';
import { AdminPermission } from '../types/permissions';

const router = Router();

// GET /api/v1/admin/settings/public — Unauthenticated public platform branding & CMS details
router.get('/public', SettingsController.getPublicSettings);

// GET /api/v1/admin/settings — Admin protected
router.get('/', requirePermission(AdminPermission.SETTINGS_EDIT), SettingsController.getSettings);

// PUT /api/v1/admin/settings — Admin protected
router.put('/', requirePermission(AdminPermission.SETTINGS_EDIT), SettingsController.updateSettings);

export default router;
