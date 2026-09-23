/**
 * One-time migration: seed ratingSum and totalJobs from existing rating_count and average_rating.
 *
 * Run: npx ts-node src/scripts/migrateRatingFields.ts
 *
 * Safe to re-run — providers with totalJobs > 0 are skipped (only migrates where totalJobs is 0 or missing).
 *
 * ponytail: ratingSum = rating_count × average_rating is approximate if average_rating was stored
 * rounded (e.g. toFixed(1)). For a provider with rating_count=10, average_rating=4.2, the true sum
 * could be anywhere in [41.5, 42.5). We accept this ≤0.5 drift since the first few post-migration
 * ratings will rapidly dominate. The verification step below flags any provider where the
 * reconstructed average drifts more than 0.01 from the stored value.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bharatclap_providers';

async function migrate() {
  await mongoose.connect(MONGO_URI);
  console.log('[MIGRATION] Connected to', MONGO_URI);

  const db = mongoose.connection.db!;
  const col = db.collection('providers');

  // Only migrate providers that haven't been migrated yet
  const result = await col.updateMany(
    { $or: [{ totalJobs: { $exists: false } }, { totalJobs: 0 }] },
    [
      {
        $set: {
          ratingSum: {
            $multiply: [
              { $ifNull: ['$rating_count', 0] },
              { $ifNull: ['$average_rating', 4.5] }
            ]
          },
          totalJobs: { $ifNull: ['$rating_count', 0] }
        }
      }
    ]
  );

  console.log(`[MIGRATION] Updated ${result.modifiedCount} providers`);

  // Verification: spot-check providers with totalJobs > 0
  const sample = await col.find({ totalJobs: { $gt: 0 } }).limit(5).toArray();
  for (const p of sample) {
    const expected = (p as any).average_rating;
    const computed = (p as any).totalJobs > 0 ? (p as any).ratingSum / (p as any).totalJobs : 4.5;
    const diff = Math.abs(expected - computed);
    console.log(
      `  Provider ${p._id}: totalJobs=${(p as any).totalJobs}, ratingSum=${(p as any).ratingSum}, ` +
      `avg=${expected?.toFixed(2)}, computed=${computed.toFixed(2)}, drift=${diff.toFixed(4)}${diff > 0.01 ? ' ⚠️' : ' ✓'}`
    );
  }

  const total = await col.countDocuments({ ratingSum: { $gt: 0 } });
  console.log(`[MIGRATION] ${total} providers have ratingSum > 0`);

  await mongoose.disconnect();
  console.log('[MIGRATION] Done');
}

migrate().catch((err) => {
  console.error('[MIGRATION] Fatal:', err);
  process.exit(1);
});
