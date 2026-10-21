import bcrypt from 'bcryptjs';
import { Client } from 'pg';

async function run() {
  const c = new Client('postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test');
  await c.connect();
  const hash = await bcrypt.hash('TestPassword123!', 10);
  await c.query('UPDATE auth.users SET password_hash = $1 WHERE id = $2 OR id = $3', [
    hash,
    '02b99802-0dd5-44da-8e83-c40827fae034',
    'e01a55c4-c0fd-417c-bf93-b04cef75ed38'
  ]);
  console.log('Passwords updated successfully');
  await c.end();
}

run().catch(console.error);
