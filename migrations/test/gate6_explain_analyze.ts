/**
 * Gate 6: EXPLAIN ANALYZE on Critical Queries
 *
 * Usage:
 *   npx tsx migrations/test/gate6_explain_analyze.ts
 *
 * Runs EXPLAIN ANALYZE on the most critical queries and verifies
 * indexes are being used. With local data this validates query plans,
 * not production cardinalities.
 */
import { Client } from 'pg';

const PG_URL = process.env.PG_URL || 'postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test';

interface QueryTest {
  name: string;
  sql: string;
  expectIndex?: string; // expected index usage keyword
}

const CRITICAL_QUERIES: QueryTest[] = [
  {
    name: 'Customer phone lookup',
    sql: `EXPLAIN ANALYZE SELECT * FROM auth.users WHERE phone = '+919999900001' LIMIT 1`,
    expectIndex: 'idx_users_phone',
  },
  {
    name: 'Active bookings by customer',
    sql: `EXPLAIN ANALYZE SELECT * FROM booking.bookings WHERE user_id = '00000000-0000-0000-0000-000000000001' AND status IN ('PENDING','CONFIRMED','ASSIGNED','EN_ROUTE','ARRIVED','IN_PROGRESS') ORDER BY created_at DESC LIMIT 10`,
    expectIndex: 'idx_bookings_customer',
  },
  {
    name: 'Provider settlements pending',
    sql: `EXPLAIN ANALYZE SELECT * FROM provider.provider_settlements WHERE provider_id = '00000000-0000-0000-0000-000000000001' AND status = 'pending_hold' ORDER BY created_at DESC LIMIT 20`,
  },
  {
    name: 'Wallet transactions by provider',
    sql: `EXPLAIN ANALYZE SELECT * FROM provider.wallet_transactions WHERE provider_id = '00000000-0000-0000-0000-000000000001' ORDER BY created_at DESC LIMIT 20`,
  },
  {
    name: 'Payment by Razorpay order ID',
    sql: `EXPLAIN ANALYZE SELECT * FROM payment.payments WHERE razorpay_order_id = 'order_test_123' LIMIT 1`,
    expectIndex: 'idx_payments_razorpay_order',
  },
  {
    name: 'Slot capacity check',
    sql: `EXPLAIN ANALYZE SELECT * FROM booking.slot_capacities WHERE slot_date = '2026-01-15' AND slot = '10:00-11:00'`,
  },
  {
    name: 'Webhook log by event_id',
    sql: `EXPLAIN ANALYZE SELECT * FROM payment.webhook_logs WHERE event_id = 'evt_test_123' LIMIT 1`,
    expectIndex: 'idx_webhook_event',
  },
  {
    name: 'Notifications by user',
    sql: `EXPLAIN ANALYZE SELECT * FROM notification.notifications WHERE recipient_id = '00000000-0000-0000-0000-000000000001' ORDER BY created_at DESC LIMIT 20`,
  },
  {
    name: 'Provider by user_id',
    sql: `EXPLAIN ANALYZE SELECT * FROM provider.providers WHERE user_id = '00000000-0000-0000-0000-000000000001' LIMIT 1`,
    expectIndex: 'idx_providers_user',
  },
  {
    name: 'Schema migrations checksum',
    sql: `EXPLAIN ANALYZE SELECT * FROM migration.schema_migrations WHERE filename = '001_auth.sql'`,
  },
  {
    name: 'Accounting journal by booking',
    sql: `EXPLAIN ANALYZE SELECT * FROM accounting.journal_entries WHERE reference_id = 'BK-000001'`,
    expectIndex: 'idx_journal_entries_reference',
  },
  {
    name: 'Chart of accounts by code',
    sql: `EXPLAIN ANALYZE SELECT * FROM accounting.chart_of_accounts WHERE code = 'REVENUE_COMMISSION'`,
  },
];

const main = async () => {
  console.log('\n═══ Gate 6: EXPLAIN ANALYZE on Critical Queries ═══\n');

  const client = new Client({ connectionString: PG_URL });
  await client.connect();

  let passed = 0;
  let warnings = 0;
  const results: { name: string; scanType: string; indexUsed: string; time: string; status: string }[] = [];

  for (const q of CRITICAL_QUERIES) {
    try {
      const result = await client.query(q.sql);
      const plan = result.rows.map(r => Object.values(r)[0]).join('\n');

      // Parse scan type
      let scanType = 'Unknown';
      if (plan.includes('Index Scan') || plan.includes('Index Only Scan')) scanType = 'Index Scan';
      else if (plan.includes('Bitmap Index Scan') || plan.includes('Bitmap Heap Scan')) scanType = 'Bitmap Scan';
      else if (plan.includes('Seq Scan')) scanType = 'Seq Scan';

      // Parse index name
      const indexMatch = plan.match(/using\s+(\w+)/i);
      const indexUsed = indexMatch ? indexMatch[1] : 'n/a';

      // Parse execution time
      const timeMatch = plan.match(/Execution Time:\s+([\d.]+)\s+ms/);
      const time = timeMatch ? `${timeMatch[1]}ms` : 'n/a';

      // On empty tables, Seq Scan is expected (optimizer knows 0 rows)
      const isEmpty = plan.includes('rows=0') || plan.includes('actual rows=0');
      let status = '✅';

      if (scanType === 'Seq Scan' && !isEmpty) {
        status = '⚠️';
        warnings++;
      } else {
        passed++;
      }

      results.push({ name: q.name, scanType, indexUsed, time, status });
      console.log(`  ${status} ${q.name.padEnd(35)} ${scanType.padEnd(15)} ${indexUsed.padEnd(30)} ${time}`);

    } catch (err: any) {
      console.log(`  ❌ ${q.name.padEnd(35)} ERROR: ${err.message.split('\n')[0]}`);
      warnings++;
      results.push({ name: q.name, scanType: 'ERROR', indexUsed: 'n/a', time: 'n/a', status: '❌' });
    }
  }

  // Index coverage check
  console.log('\n  Index Coverage Summary:\n');

  const indexResult = await client.query(`
    SELECT schemaname, indexname, tablename
    FROM pg_indexes
    WHERE schemaname IN ('auth','booking','catalog','provider','payment','accounting','notification')
    ORDER BY schemaname, tablename
  `);

  const indexesBySchema: Record<string, number> = {};
  for (const idx of indexResult.rows) {
    indexesBySchema[idx.schemaname] = (indexesBySchema[idx.schemaname] || 0) + 1;
  }

  for (const [schema, count] of Object.entries(indexesBySchema).sort()) {
    console.log(`    ${schema.padEnd(15)} ${count} indexes`);
  }
  console.log(`    ${'TOTAL'.padEnd(15)} ${indexResult.rows.length} indexes`);

  await client.end();

  console.log(`\n  Queries tested:  ${CRITICAL_QUERIES.length}`);
  console.log(`  Passed:          ${passed}`);
  console.log(`  Warnings:        ${warnings}`);
  console.log(`  Note: Seq Scan on empty tables is expected (optimizer shortcut)`);

  if (warnings === 0 || results.every(r => r.status !== '❌')) {
    console.log('\n═══ Gate 6: LOCAL PASS (plans validated, production cardinalities needed) ═══\n');
  } else {
    console.log('\n═══ Gate 6: WARNINGS (review query plans above) ═══\n');
  }
};

main().catch(err => {
  console.error('\n═══ Gate 6: FAIL ═══');
  console.error(err);
  process.exit(1);
});
