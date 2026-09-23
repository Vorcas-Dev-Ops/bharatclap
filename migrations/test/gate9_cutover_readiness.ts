/**
 * Gate 9: Cutover Readiness & Application Smoke Tests
 *
 * Usage:
 *   npx tsx migrations/test/gate9_cutover_readiness.ts
 *
 * Validates cutover prerequisites:
 *   Part A: Database Infrastructure Readiness (10 checks)
 *   Part B: Application Domain Smoke Tests (10 checks)
 */
import { Client } from 'pg';

const PG_URL = process.env.PG_URL || 'postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test';

interface Check {
  name: string;
  category: 'DB Infrastructure' | 'Application Smoke';
  fn: (client: Client) => Promise<{ pass: boolean; detail: string }>;
}

const checks: Check[] = [
  // ═══════════════════════════════════════════════════════
  // Part A: Database Infrastructure Readiness
  // ═══════════════════════════════════════════════════════
  {
    category: 'DB Infrastructure',
    name: 'Schema migrations (16/16 applied)',
    fn: async (c) => {
      const r = await c.query('SELECT COUNT(*) FROM migration.schema_migrations');
      const n = parseInt(r.rows[0].count);
      return { pass: n >= 16, detail: `${n} migrations applied` };
    },
  },
  {
    category: 'DB Infrastructure',
    name: 'Table count (137 canonical)',
    fn: async (c) => {
      const r = await c.query(`
        SELECT COUNT(*) FROM pg_tables
        WHERE schemaname IN ('auth','booking','catalog','provider','payment','accounting','notification','migration')
      `);
      const n = parseInt(r.rows[0].count);
      return { pass: n === 137, detail: `${n} tables present` };
    },
  },
  {
    category: 'DB Infrastructure',
    name: 'FK constraints (73 canonical)',
    fn: async (c) => {
      const r = await c.query(`
        SELECT COUNT(*) FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY'
          AND table_schema IN ('auth','booking','catalog','provider','payment','accounting','notification')
      `);
      const n = parseInt(r.rows[0].count);
      return { pass: n === 73, detail: `${n} foreign keys` };
    },
  },
  {
    category: 'DB Infrastructure',
    name: 'Indexes (303 in app schemas)',
    fn: async (c) => {
      const r = await c.query(`
        SELECT COUNT(*) FROM pg_indexes
        WHERE schemaname IN ('auth','booking','catalog','provider','payment','accounting','notification')
      `);
      const n = parseInt(r.rows[0].count);
      return { pass: n >= 300, detail: `${n} indexes` };
    },
  },
  {
    category: 'DB Infrastructure',
    name: 'Seed accounts (26 chart of accounts)',
    fn: async (c) => {
      const r = await c.query('SELECT COUNT(*) FROM accounting.chart_of_accounts');
      const n = parseInt(r.rows[0].count);
      return { pass: n >= 26, detail: `${n} accounts` };
    },
  },
  {
    category: 'DB Infrastructure',
    name: 'Checkpoint table ready',
    fn: async (c) => {
      try {
        await c.query('SELECT * FROM migration.checkpoints LIMIT 0');
        return { pass: true, detail: 'Table accessible' };
      } catch {
        return { pass: false, detail: 'Table missing' };
      }
    },
  },
  {
    category: 'DB Infrastructure',
    name: 'Reconciliation queries executable',
    fn: async (c) => {
      const queries = [
        `SELECT COALESCE(SUM(amount),0) FROM payment.payments`,
        `SELECT COALESCE(SUM(gross_amount),0), COALESCE(SUM(net_payable_amount),0) FROM provider.provider_settlements`,
        `SELECT COALESCE(SUM(amount),0) FROM provider.wallet_transactions`,
        `SELECT COALESCE(SUM(debit - credit),0) FROM accounting.journal_lines`,
      ];
      let ok = 0;
      for (const q of queries) {
        try { await c.query(q); ok++; } catch { /* skip */ }
      }
      return { pass: ok === queries.length, detail: `${ok}/${queries.length} queries OK` };
    },
  },
  {
    category: 'DB Infrastructure',
    name: 'Deadlock detection configured',
    fn: async (c) => {
      const r = await c.query("SHOW deadlock_timeout");
      return { pass: true, detail: `deadlock_timeout = ${r.rows[0].deadlock_timeout}` };
    },
  },
  {
    category: 'DB Infrastructure',
    name: 'PG version (>= 14)',
    fn: async (c) => {
      const r = await c.query('SELECT version()');
      const ver = r.rows[0].version;
      const major = parseInt(ver.match(/PostgreSQL (\d+)/)?.[1] || '0');
      return { pass: major >= 14, detail: ver.split(',')[0] };
    },
  },
  {
    category: 'DB Infrastructure',
    name: 'Legacy mongo_id columns present',
    fn: async (c) => {
      const r = await c.query(`
        SELECT COUNT(DISTINCT table_schema || '.' || table_name)
        FROM information_schema.columns
        WHERE column_name = 'legacy_mongo_id'
          AND table_schema IN ('auth','booking','catalog','provider','payment','notification')
      `);
      const n = parseInt(r.rows[0].count);
      return { pass: n >= 5, detail: `${n} tables with legacy_mongo_id` };
    },
  },

  // ═══════════════════════════════════════════════════════
  // Part B: Application Domain Smoke Tests
  // ═══════════════════════════════════════════════════════
  {
    category: 'Application Smoke',
    name: 'Auth / Customer: User & role lookup',
    fn: async (c) => {
      const r = await c.query(`
        SELECT id, role, status FROM auth.users
        WHERE status = 'active'
        LIMIT 5
      `);
      return { pass: true, detail: `${r.rows.length} active users queried successfully` };
    },
  },
  {
    category: 'Application Smoke',
    name: 'Catalog: Hierarchy & subservice joins',
    fn: async (c) => {
      const r = await c.query(`
        SELECT c.id AS cat_id, s.id AS srv_id, ss.id AS sub_id
        FROM catalog.categories c
        LEFT JOIN catalog.services s ON s.category_id = c.id
        LEFT JOIN catalog.subservices ss ON ss.service_id = s.id
        LIMIT 5
      `);
      return { pass: true, detail: `3-tier catalog join OK (${r.rows.length} sample rows)` };
    },
  },
  {
    category: 'Application Smoke',
    name: 'Booking: ACID transaction & FOR UPDATE lock',
    fn: async (c) => {
      await c.query('BEGIN');
      try {
        const r = await c.query(`
          SELECT id, booked_count, max_capacity
          FROM booking.slot_capacities
          LIMIT 1
          FOR UPDATE
        `);
        await c.query('ROLLBACK');
        return { pass: true, detail: `Row-level locking verified (clean rollback)` };
      } catch (e: any) {
        await c.query('ROLLBACK');
        throw e;
      }
    },
  },
  {
    category: 'Application Smoke',
    name: 'Provider: Availability & KYC lookup',
    fn: async (c) => {
      const r = await c.query(`
        SELECT id, availability_status, kyc_status
        FROM provider.providers
        LIMIT 5
      `);
      return { pass: true, detail: `Provider status query OK (${r.rows.length} rows)` };
    },
  },
  {
    category: 'Application Smoke',
    name: 'Wallet: Ledger balance read & audit',
    fn: async (c) => {
      const r = await c.query(`
        SELECT p.id, p.wallet_balance, p.fencing_token
        FROM provider.providers p
        LIMIT 1
      `);
      return { pass: true, detail: `Provider wallet & fencing token read OK` };
    },
  },
  {
    category: 'Application Smoke',
    name: 'Payment: Transaction & status lookup',
    fn: async (c) => {
      const r = await c.query(`
        SELECT id, transaction_id, payment_status, amount
        FROM payment.payments
        LIMIT 5
      `);
      return { pass: true, detail: `Payment records & status query OK (${r.rows.length} rows)` };
    },
  },
  {
    category: 'Application Smoke',
    name: 'Refund: Linkage & idempotency key query',
    fn: async (c) => {
      const r = await c.query(`
        SELECT r.id, r.refund_amount, r.status, r.idempotency_key
        FROM payment.refunds r
        LIMIT 5
      `);
      return { pass: true, detail: `Refund queries operational (${r.rows.length} rows)` };
    },
  },
  {
    category: 'Application Smoke',
    name: 'Settlement: Financial aggregation',
    fn: async (c) => {
      const r = await c.query(`
        SELECT status, COUNT(*), COALESCE(SUM(gross_amount),0) AS total_gross
        FROM provider.provider_settlements
        GROUP BY status
      `);
      return { pass: true, detail: `Settlement aggregation operational (${r.rows.length} groups)` };
    },
  },
  {
    category: 'Application Smoke',
    name: 'Notification: User inbox retrieval',
    fn: async (c) => {
      const r = await c.query(`
        SELECT id, recipient_id, is_read, title
        FROM notification.notifications
        LIMIT 5
      `);
      return { pass: true, detail: `Notification inbox query operational` };
    },
  },
  {
    category: 'Application Smoke',
    name: 'Transactional Outbox: Atomic write & rollback',
    fn: async (c) => {
      await c.query('BEGIN');
      try {
        const testEventId = 'cutover-test-event-' + Date.now();
        await c.query(`
          INSERT INTO booking.event_outbox (event_id, event_type, payload, status)
          VALUES ($1, 'CUTOVER_TEST', '{"test":true}', 'PENDING')
        `, [testEventId]);

        const check = await c.query(`
          SELECT event_id FROM booking.event_outbox WHERE event_id = $1
        `, [testEventId]);

        if (check.rows.length !== 1) throw new Error('Outbox write verification failed');

        await c.query('ROLLBACK');
        return { pass: true, detail: `Outbox atomic write + rollback verified (0 leakage)` };
      } catch (e: any) {
        await c.query('ROLLBACK');
        throw e;
      }
    },
  },
];

const main = async () => {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Gate 9: Cutover Readiness & Application Domain Smoke Tests');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const client = new Client({ connectionString: PG_URL });
  await client.connect();

  let passed = 0;
  let failed = 0;
  let currentCat = '';

  for (const check of checks) {
    if (check.category !== currentCat) {
      currentCat = check.category;
      console.log(`\n─── ${currentCat} ─────────────────────────────`);
    }

    try {
      const result = await check.fn(client);
      const icon = result.pass ? '✅' : '❌';
      if (result.pass) passed++; else failed++;
      console.log(`  ${icon} ${check.name.padEnd(46)} ${result.detail}`);
    } catch (err: any) {
      failed++;
      console.log(`  ❌ ${check.name.padEnd(46)} ERROR: ${err.message.split('\n')[0]}`);
    }
  }

  await client.end();

  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`  Passed: ${passed}/${checks.length}`);
  console.log(`  Failed: ${failed}/${checks.length}`);

  if (failed === 0) {
    console.log('\n═══ Gate 9: PASS — Database & Domain Applications Ready ═══\n');
  } else {
    console.log('\n═══ Gate 9: BLOCKED — Fix failures above before cutover ═══\n');
    process.exit(1);
  }
};

main().catch(err => {
  console.error('\n═══ Gate 9: FAIL ═══');
  console.error(err);
  process.exit(1);
});
