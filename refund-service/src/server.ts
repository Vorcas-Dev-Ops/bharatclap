import dotenv from 'dotenv';
import { connectDB } from './config/db';
import app from './app';
import { startRefundEventOutboxPoller } from './services/refundEventOutboxPoller';
import { startRefundProcessingPoller } from './services/refundProcessingPoller';

dotenv.config();

const PORT = process.env.PORT || 5007;

connectDB()
  .then(() => {
    console.log('[REFUND-SERVICE] Connected to PostgreSQL');
    app.listen(PORT, () => {
      console.log(`[REFUND-SERVICE] Running on port ${PORT}`);
      startRefundEventOutboxPoller();
      startRefundProcessingPoller();
      console.log('[REFUND-SERVICE] Outbox + refund processing pollers started');
    });
  })
  .catch((err) => {
    console.error('[REFUND-SERVICE] Database connection error:', err);
    process.exit(1);
  });

