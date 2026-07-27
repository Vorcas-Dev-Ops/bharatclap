import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from './app';

dotenv.config();

const PORT = process.env.PORT || 5007;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bharatclap';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('[REFUND-SERVICE] Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`[REFUND-SERVICE] Running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[REFUND-SERVICE] MongoDB connection error:', err);
    process.exit(1);
  });
