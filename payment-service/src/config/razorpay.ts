import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const keyId = process.env.RAZORPAY_KEY_ID || '';
const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

if (process.env.NODE_ENV === 'production' && (!keyId || !keySecret)) {
  throw new Error('[FATAL] RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required in production');
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

export default razorpay;
