import express from 'express';
import { getCatalogBatch } from '../controllers/batchController';
import { internalAuth } from '../middleware/internalAuth';

const router = express.Router();

router.post('/', internalAuth, getCatalogBatch);

export default router;
