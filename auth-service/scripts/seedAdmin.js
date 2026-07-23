const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const mongoUri = process.env.MONGO_URI || 'mongodb+srv://fixvoadmin_db_user:Fixvo123@cluster0.rdlnwbx.mongodb.net/auth_db?appName=Cluster0';

async function seedAdmin() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB:', mongoUri);

    const db = mongoose.connection.db;
    const usersCol = db.collection('users');

    const adminEmail = 'admin@bharatclap.com';
    const existingAdmin = await usersCol.findOne({ email: adminEmail });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    if (existingAdmin) {
      await usersCol.updateOne(
        { email: adminEmail },
        {
          $set: {
            password: hashedPassword,
            role: 'admin',
            admin_role: 'super_admin',
            name: 'Super Admin',
            phone: '+919999999999',
            status: 'active',
            isDeleted: false,
            updatedAt: new Date(),
          },
        }
      );
      console.log('✅ Updated Super Admin user password to admin123');
    } else {
      await usersCol.insertOne({
        name: 'Super Admin',
        email: adminEmail,
        phone: '+919999999999',
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
      console.log('✅ Created Super Admin user (admin@bharatclap.com / admin123)');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error seeding admin:', err);
    process.exit(1);
  }
}

seedAdmin();
