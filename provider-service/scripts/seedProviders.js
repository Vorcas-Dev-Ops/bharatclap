const mongoose = require('mongoose');

const authUri = process.env.AUTH_DB_URI || 'mongodb+srv://fixvoadmin_db_user:Fixvo123@cluster0.rdlnwbx.mongodb.net/auth_db?appName=Cluster0';
const providerUri = process.env.MONGO_URI || 'mongodb+srv://fixvoadmin_db_user:Fixvo123@cluster0.rdlnwbx.mongodb.net/provider_db?appName=Cluster0';
const catalogUri = process.env.CATALOG_DB_URI || 'mongodb+srv://fixvoadmin_db_user:Fixvo123@cluster0.rdlnwbx.mongodb.net/catalog_db?appName=Cluster0';

async function seedProviders() {
  try {
    const authConn = await mongoose.createConnection(authUri).asPromise();
    const providerConn = await mongoose.createConnection(providerUri).asPromise();
    const catalogConn = await mongoose.createConnection(catalogUri).asPromise();
    console.log('Connected to MongoDB Atlas clusters');

    const usersCol = authConn.collection('users');
    const providersCol = providerConn.collection('providers');
    const providerServicesCol = providerConn.collection('providerservices');
    const categoriesCol = catalogConn.collection('categories');
    const subservicesCol = catalogConn.collection('subservices');
    const locationsCol = authConn.collection('locations');

    // Get sample categories, subservices, and locations
    const categories = await categoriesCol.find({}).toArray();
    const subservices = await subservicesCol.find({}).toArray();
    const locations = await locationsCol.find({}).toArray();

    const sampleCategory = categories[0] || { _id: new mongoose.Types.ObjectId(), category_name: 'Appliance Repair' };
    const sampleSubservices = subservices.slice(0, 3).map(s => s._id);
    const sampleLocations = locations.slice(0, 3).map(l => l._id);

    const providerUsersData = [
      {
        name: 'Rajesh Kumar',
        email: 'rajesh.kumar@example.com',
        phone: '9876543210',
        role: 'provider',
        is_verified: true,
        password: '$2a$10$hashedpasswordplaceholder',
        profile_image: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=150',
      },
      {
        name: 'Suresh Patel',
        email: 'suresh.patel@example.com',
        phone: '9876543211',
        role: 'provider',
        is_verified: true,
        password: '$2a$10$hashedpasswordplaceholder',
        profile_image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      },
      {
        name: 'Amit Sharma',
        email: 'amit.sharma@example.com',
        phone: '9876543212',
        role: 'provider',
        is_verified: true,
        password: '$2a$10$hashedpasswordplaceholder',
        profile_image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      },
      {
        name: 'Priya Verma',
        email: 'priya.verma@example.com',
        phone: '9876543213',
        role: 'provider',
        is_verified: true,
        password: '$2a$10$hashedpasswordplaceholder',
        profile_image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      },
      {
        name: 'Vikram Singh',
        email: 'vikram.singh@example.com',
        phone: '9876543214',
        role: 'provider',
        is_verified: true,
        password: '$2a$10$hashedpasswordplaceholder',
        profile_image: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
      },
    ];

    console.log('Seeding providers into MongoDB...');

    for (let i = 0; i < providerUsersData.length; i++) {
      const uData = providerUsersData[i];
      let user = await usersCol.findOne({ email: uData.email });
      if (!user) {
        const insertRes = await usersCol.insertOne({
          ...uData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        user = { _id: insertRes.insertedId, ...uData };
      }

      let provider = await providersCol.findOne({ user_id: user._id });
      if (!provider) {
        const statuses = ['verified', 'verified', 'pending', 'verified', 'rejected'];
        const availabilities = ['available', 'busy', 'offline', 'available', 'offline'];

        const provDoc = {
          user_id: user._id,
          availability_status: availabilities[i],
          isOnline: availabilities[i] !== 'offline',
          isBusy: availabilities[i] === 'busy',
          kyc_status: statuses[i],
          is_verified: statuses[i] === 'verified',
          providerKitCompleted: true,
          accessoriesPurchased: true,
          onboardingCompleted: true,
          walletBalance: 2500,
          reservedBalance: 500,
          creditLimit: 5000,
          isWalletBlocked: false,
          codDueBalance: i === 1 ? 2200 : 0,
          isDispatchBlockedByCod: i === 1,
          bankDetails: {
            accountHolderName: user.name,
            accountNumber: '918273645' + i,
            ifscCode: 'HDFC0001234',
            bankName: 'HDFC Bank',
            status: 'verified',
          },
          service_locations: sampleLocations,
          live_location: {
            type: 'Point',
            coordinates: [77.5946 + i * 0.01, 12.9716 + i * 0.01],
          },
          serviceRadius: 10000,
          rating: 4.8,
          completed_jobs: 45 + i * 12,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const provRes = await providersCol.insertOne(provDoc);
        const providerId = provRes.insertedId;

        // Seed provider services link
        await providerServicesCol.insertOne({
          provider_id: providerId,
          category_id: sampleCategory._id,
          subservice_ids: sampleSubservices,
          location_ids: sampleLocations,
          is_active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        console.log(`Created provider profile for ${user.name} (${statuses[i]})`);
      }
    }

    console.log('✅ Provider seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding providers:', err);
    process.exit(1);
  }
}

seedProviders();
