import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { backfillProviderCodesBatch } from '../utils/providerIdGenerator';

dotenv.config();

const runMigration = async () => {
  try {
    console.log('[MIGRATION] Connecting to database...');
    await connectDB();
    console.log('[MIGRATION] Starting provider code backfill...');
    const res = await backfillProviderCodesBatch();
    console.log(`[MIGRATION] Successfully backfilled ${res.success}/${res.processed} provider codes.`);
  } catch (err: any) {
    console.error('[MIGRATION] Provider code backfill error:', err?.message || err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

runMigration();
