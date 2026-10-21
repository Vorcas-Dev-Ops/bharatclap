const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ponytail: Fallback to local MongoDB instance instead of leaking remote Atlas credentials.
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/auth_db';

async function seedAdmin() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB:', mongoUri);

    const db = mongoose.connection.db;
    const usersCol = db.collection('users');

    const crypto = require('crypto');
    const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@bharatclap.com';
    const seedPassword = process.env.ADMIN_SEED_PASSWORD || crypto.randomBytes(12).toString('base64url');
    if (!process.env.ADMIN_SEED_PASSWORD && process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_SEED_PASSWORD environment variable must be explicitly provided in production');
    }

    const existingAdmin = await usersCol.findOne({ email: adminEmail });

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(seedPassword, salt);

    if (existingAdmin) {
      await usersCol.updateOne(
        { email: adminEmail },
        {
          $set: {
            password: hashedPassword,
            role: 'admin',
            admin_role: 'super_admin',
            name: 'Super Admin',
            phone: process.env.ADMIN_SEED_PHONE || '+919999999999',
            status: 'active',
            isDeleted: false,
            updatedAt: new Date(),
          },
        }
      );
      console.log(`✅ Updated Super Admin credentials for ${adminEmail}`);
      if (!process.env.ADMIN_SEED_PASSWORD) {
        console.log(`🔑 Generated Password: ${seedPassword}`);
      }
    } else {
      await usersCol.insertOne({
        name: 'Super Admin',
        email: adminEmail,
        phone: process.env.ADMIN_SEED_PHONE || '+919999999999',
        password: hashedPassword,
        role: 'admin',
        admin_role: 'super_admin',
        status: 'active',
        isDeleted: false,
        isEmailVerified: true,
        isPhoneVerified: true,
        tokenVersion: 1,
        walletBalance: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`✅ Created Super Admin user for ${adminEmail}`);
      if (!process.env.ADMIN_SEED_PASSWORD) {
        console.log(`🔑 Generated Password: ${seedPassword}`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error seeding admin:', err);
    process.exit(1);
  }
}

seedAdmin();
