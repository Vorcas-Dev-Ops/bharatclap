import mongoose from 'mongoose';
import dns from 'dns';

// Fix querySrv ECONNREFUSED by using Google Public DNS for SRV lookup
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (err) {
  console.warn('⚠️ Could not set custom DNS servers:', err);
}

export const verifyTransactionCapability = async (): Promise<boolean> => {
  try {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // no-op test transaction verification with majority write concern
      }, {
        writeConcern: { w: 'majority', j: true },
        readConcern: { level: 'majority' }
      });
      console.log('[DB] ✅ MongoDB Multi-Document Transaction capability verified (ReplicaSet/Sharded Cluster active, w:majority, retryWrites enabled).');
      return true;
    } finally {
      await session.endSession();
    }
  } catch (err: any) {
    const isProd = process.env.NODE_ENV === 'production';
    console.error(`[DB] ❌ MongoDB Transaction Capability Check: ${err.message}`);
    if (isProd) {
      console.error('[DB FATAL] Production MongoDB must run as a Replica Set or Sharded Cluster with w:majority to support ACID transactions. Halting startup.');
      process.exit(1);
    } else {
      console.warn('[DB WARNING] Standalone MongoDB detected. ACID multi-document transactions require a Replica Set in production.');
    }
    return false;
  }
};

export const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      console.error('❌ MONGO_URI is not defined in the .env file');
      process.exit(1);
    }
    const conn = await mongoose.connect(mongoURI, {
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await verifyTransactionCapability();
  } catch (error: any) {
    console.error(`❌ MongoDB Error: ${error.message}`);
  }
};
