// Seed schema_migrations with current checksums for all applied migrations
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Client } from 'pg';

const main = async () => {
  const pgUrl = process.env.PG_URL || 'postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test';
  const client = new Client({ connectionString: pgUrl });
  await client.connect();

  const dir = path.resolve(__dirname, '..');
  const files = fs.readdirSync(dir)
    .filter(f => /^\d{3}[a-z]?_.*\.sql$/.test(f))
    .sort();

  for (const f of files) {
    const match = f.match(/^(\d{3})/);
    const version = match ? parseInt(match[1], 10) : -1;
    const checksum = crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(dir, f), 'utf-8'))
      .digest('hex');

    await client.query(
      `INSERT INTO migration.schema_migrations (filename, checksum, execution_time_ms)
       VALUES ($1, $2, 0)
       ON CONFLICT (filename) DO UPDATE SET checksum = $2`,
      [f, checksum]
    );
    console.log(`  Seeded: ${f} → ${checksum.substring(0, 16)}...`);
  }

  await client.end();
  console.log(`\n✅ ${files.length} migrations seeded into schema_migrations.`);
};

main().catch(err => { console.error(err); process.exit(1); });
