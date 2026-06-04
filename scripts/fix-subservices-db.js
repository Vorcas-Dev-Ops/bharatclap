const { MongoClient } = require('mongodb');

async function fixSubservices() {
  const uris = [
    'mongodb://localhost:27017',
    'mongodb://127.0.0.1:27017',
    'mongodb://localhost:27018',
    'mongodb://127.0.0.1:27018'
  ];

  for (const uri of uris) {
    console.log(`\n🏁 Connecting to ${uri}...`);
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 2000 });
    try {
      await client.connect();
      const db = client.db('catalog_db');
      const col = db.collection('subservices');

      // Find all subservices
      const allSubservices = await col.find({}).toArray();
      console.log(`📂 Found ${allSubservices.length} subservices in ${uri}`);

      let fixCount = 0;
      for (const sub of allSubservices) {
        let updateDoc = null;

        // If the document has a 'name' property but no 'subservice_name'
        if (sub.name && !sub.subservice_name) {
          updateDoc = { subservice_name: sub.name };
        } else if (sub.subservice_name && !sub.name) {
          updateDoc = { name: sub.subservice_name };
        }

        if (updateDoc) {
          await col.updateOne({ _id: sub._id }, { $set: updateDoc });
          fixCount++;
        }
      }

      console.log(`✅ Fixed ${fixCount} documents in ${uri}`);
    } catch (e) {
      console.warn(`⚠️ Interface not active or failed for ${uri}`);
    } finally {
      await client.close();
    }
  }
  console.log('\n🎉 Finished standardizing subservice fields across databases.');
}

fixSubservices();
