import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';

const router = Router();

// GET /api/v1/admin/search
router.get('/', SearchController.globalSearch);

export default router;
