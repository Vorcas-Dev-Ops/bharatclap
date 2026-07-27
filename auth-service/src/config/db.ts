import mongoose from 'mongoose';
import dns from 'dns';

// Fix querySrv ECONNREFUSED by using Google Public DNS for SRV lookup
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (err) {
  console.warn('⚠️ Could not set custom DNS servers:', err);
}

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
  } catch (error: any) {
    console.error(`❌ MongoDB Error: ${error.message}`);
  }
};
