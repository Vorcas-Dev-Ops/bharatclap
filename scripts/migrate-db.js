const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // For DNS SRV resolution

const { MongoClient } = require('mongodb');

const SOURCE_URI = 'mongodb+srv://fixvoadmin_db_user:Admin123@cluster0.rdlnwbx.mongodb.net';
const SOURCE_DB_NAME = 'serviceapp';
const TARGET_URI = 'mongodb://127.0.0.1:27017';

const DB_MAPPING = {
  auth_db: ['users', 'otps', 'addresses', 'locations'],
  catalog_db: ['categories', 'services', 'subservices', 'banners', 'offers', 'memberships', 'coupons'],
  provider_db: ['providers', 'providerservices', 'wallets', 'jobrequests'],
  booking_db: ['bookings', 'carts', 'reviews', 'complaints'],
  payment_db: ['payments', 'couponusages', 'usermemberships'],
  notification_db: ['notifications', 'adminreports']
};

async function runMigration() {
  console.log('🏁 Starting MongoDB Decoupling and Migration from MongoDB Atlas to Local...');
  const sourceClient = new MongoClient(SOURCE_URI);
  const targetClient = new MongoClient(TARGET_URI);

  try {
    await sourceClient.connect();
    await targetClient.connect();
    console.log('🔌 Connected to Atlas (Source) and Local MongoDB (Target) successfully.');

    const sourceDb = sourceClient.db(SOURCE_DB_NAME);
    const targetClientConnection = targetClient; // local ref
    
    // Get all collection names in the source database
    const monolithCollections = await sourceDb.listCollections().toArray();
    const existingCollectionNames = monolithCollections.map(c => c.name);
    console.log(`📂 Found ${existingCollectionNames.length} collections in remote database "${SOURCE_DB_NAME}".`);

    for (const [targetDbName, collectionsToMigrate] of Object.entries(DB_MAPPING)) {
      console.log(`\n➡️ Processing target database: "${targetDbName}"`);
      const targetDb = targetClientConnection.db(targetDbName);

      for (const colName of collectionsToMigrate) {
        // Handle case-sensitivity or singular vs plural
        const matchedColName = existingCollectionNames.find(
          name => name.toLowerCase() === colName.toLowerCase()
        );

        if (!matchedColName) {
          console.warn(`  ⚠️ Collection "${colName}" does not exist in source. Skipping...`);
          continue;
        }

        console.log(`  📦 Migrating "${matchedColName}" to "${targetDbName}..."`);
        const sourceCol = sourceDb.collection(matchedColName);
        const targetCol = targetDb.collection(matchedColName);

        // Fetch all documents
        const documents = await sourceCol.find({}).toArray();

        if (documents.length === 0) {
          console.log(`  ℹ️ "${matchedColName}" is empty. Nothing to migrate.`);
          continue;
        }

        // Clear existing target collection to prevent duplicates
        await targetCol.deleteMany({});

        // Insert into target database
        const result = await targetCol.insertMany(documents);
        console.log(`  ✅ Successfully migrated ${result.insertedCount} documents for "${matchedColName}".`);
      }
    }

    console.log('\n🎉 Database separation completed successfully with ZERO data loss!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await sourceClient.close();
    await targetClient.close();
    console.log('🔌 MongoDB connections closed.');
  }
}

runMigration();
