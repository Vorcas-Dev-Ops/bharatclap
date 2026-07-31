import express from 'express';
import { generatePricingQuote, getQuoteDetails } from '../controllers/pricingController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/quote', generatePricingQuote);
router.get('/quote/:quoteId', getQuoteDetails);

export default router;
