import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_TCwlsGgFYgQdGL',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'BEx2OBXwYoQI4YHuVIYh7cSB',
});

export default razorpay;
