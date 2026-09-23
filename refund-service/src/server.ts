import dotenv from 'dotenv';
import { connectDB } from './config/db';
import app from './app';

dotenv.config();

const PORT = process.env.PORT || 5007;

connectDB()
  .then(() => {
    console.log('[REFUND-SERVICE] Connected to PostgreSQL');
    app.listen(PORT, () => {
      console.log(`[REFUND-SERVICE] Running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[REFUND-SERVICE] Database connection error:', err);
    process.exit(1);
  });
