import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Provider } from '../../../provider-service/src/models/Provider';
import { ProviderSettlement } from '../../../provider-service/src/models/ProviderSettlement';
import { LedgerEntry } from '../../../provider-service/src/models/LedgerEntry';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://fixvoadmin_db_user:Fixvo123@cluster0.rdlnwbx.mongodb.net/booking_db?appName=Cluster0';

async function diagnose() {
  console.log('🔍 Running Cash Deposit Backend Diagnostic Test...\n');
  try {
    await mongoose.connect(MONGO_URI, { connectTimeoutMS: 10000, socketTimeoutMS: 15000 });
    console.log('✅ Connected to MongoDB Atlas');

    // Find any provider with codDueBalance > 0
    const provider = await Provider.findOne({ codDueBalance: { $gt: 0 } }).lean();
    console.log('Provider found:', provider ? { id: provider._id, codDueBalance: provider.codDueBalance } : 'None found');

    if (!provider) {
      console.log('Creating mock provider with codDueBalance = 229.923...');
      const newProv = await Provider.create({
        user_id: new mongoose.Types.ObjectId(),
        provider_code: 'PTEST999',
        codDueBalance: 229.923,
        status: 'active',
        isDispatchBlockedByCod: false,
      });
      console.log('Mock Provider Created:', newProv._id, newProv.codDueBalance);
    }
  } catch (err: any) {
    console.error('❌ DIAGNOSTIC ERROR:', err);
  } finally {
    await mongoose.disconnect();
  }
}

diagnose();
