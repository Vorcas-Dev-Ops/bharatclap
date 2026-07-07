import express from 'express';
import { grantWaiver, getWaivers } from '../controllers/waiverController';

const router = express.Router();

router.get('/', getWaivers);
router.post('/', grantWaiver);

export default router;
