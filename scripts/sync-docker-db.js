const { MongoClient } = require('mongodb');

// Windows Local Database (Source)
const SOURCE_URI = 'mongodb://127.0.0.1:27017';

// Docker Database (Target)
const TARGET_URI = 'mongodb://127.0.0.1:27018';

// List of all the decoupled microservice databases
const DATABASES = [
  'auth_db',
  'catalog_db',
  'provider_db',
  'booking_db',
  'payment_db',
  'notification_db'
];

async function runSync() {
  console.log('🏁 Starting Database Sync from Windows (27017) to Docker (27018)...');
  
  const sourceClient = new MongoClient(SOURCE_URI);
  const targetClient = new MongoClient(TARGET_URI);

  try {
    await sourceClient.connect();
    await targetClient.connect();
    console.log('🔌 Connected to both Windows and Docker MongoDB servers successfully.\n');

    for (const dbName of DATABASES) {
      console.log(`➡️ Syncing Database: "${dbName}"...`);
      
      const sourceDb = sourceClient.db(dbName);
      const targetDb = targetClient.db(dbName);
      
      // Get all collections in the source database
      const collections = await sourceDb.listCollections().toArray();
      
      if (collections.length === 0) {
        console.log(`  ℹ️ No collections found in ${dbName}. Skipping.\n`);
        continue;
      }

      for (const col of collections) {
        const colName = col.name;
        
        // Fetch all documents from the Windows DB
        const documents = await sourceDb.collection(colName).find({}).toArray();
        
        if (documents.length === 0) {
          console.log(`  ℹ️ Collection "${colName}" is empty.`);
          continue;
        }

        // Drop the target collection completely to clear out any conflicting unique indexes
        try {
          await targetDb.collection(colName).drop();
        } catch (e) {
          // Ignore error if collection doesn't exist yet
        }

        // Insert into Docker DB
        const result = await targetDb.collection(colName).insertMany(documents);
        console.log(`  ✅ Successfully synced ${result.insertedCount} documents for "${colName}".`);
      }
      console.log(); // Empty line for readability
    }

    console.log('🎉 Database sync completed successfully! Your Docker DB is now an exact clone of your Windows DB.');
  } catch (error) {
    console.error('❌ Sync failed:', error);
  } finally {
    await sourceClient.close();
    await targetClient.close();
    console.log('🔌 Connections closed.');
  }
}

runSync();
