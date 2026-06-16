import express from 'express';
import { getCatalogBatch } from '../controllers/batchController';

const router = express.Router();

router.post('/', getCatalogBatch);

export default router;
