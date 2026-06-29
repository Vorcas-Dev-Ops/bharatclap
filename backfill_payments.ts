import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Payment } from './payment-service/src/models/Payment';
import axios from 'axios';

dotenv.config({ path: './payment-service/.env' });

const backfillPaymentUsers = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/payment_db';
    await mongoose.connect(mongoUri);
    console.log('Connected to Payment DB');

    const payments = await Payment.find({ user_id: { $exists: false } });
    console.log(`Found ${payments.length} payments missing user_id`);

    if (payments.length === 0) {
      process.exit(0);
    }

    const bookingIds = payments.map(p => p.booking_id);
    
    // We don't have access to booking models directly, so let's hit the internal API
    const BOOKING_URL = 'http://localhost:5004';
    const bRes = await axios.post(`${BOOKING_URL}/api/bookings/batch`, { ids: bookingIds }, {
      headers: { 'x-internal-service-key': 'your-internal-key-here' } // Adjust key if necessary
    }).catch(e => {
      console.error('Failed to fetch bookings:', e.message);
      return { data: [] };
    });

    const bookings = bRes.data;
    const bookingMap = new Map(bookings.map((b: any) => [String(b._id), String(b.user_id)]));

    let updated = 0;
    for (const payment of payments) {
      const userId = bookingMap.get(String(payment.booking_id));
      if (userId) {
        payment.user_id = new mongoose.Types.ObjectId(userId);
        await payment.save();
        updated++;
      }
    }

    console.log(`Successfully backfilled ${updated} payments with user_id`);
    process.exit(0);
  } catch (err) {
    console.error('Error backfilling payments:', err);
    process.exit(1);
  }
};

backfillPaymentUsers();
