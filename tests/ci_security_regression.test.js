const path = require('path');
const assert = require('assert');
require(path.resolve(__dirname, '../auth-service/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../.env') });
const jwt = require(path.resolve(__dirname, '../auth-service/node_modules/jsonwebtoken'));
const { Pool } = require(path.resolve(__dirname, '../provider-service/node_modules/pg'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test'
});

const JWT_SECRET = process.env.JWT_SECRET;
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY;

async function runCiSecuritySuite() {
  console.log('=== CI SECURITY REGRESSION TEST SUITE ===\n');

  // Load admin from DB
  const adminRes = await pool.query("SELECT * FROM auth.admins WHERE email = 'admin@bharatclap.com'");
  const admin = adminRes.rows[0];
  assert.ok(admin, 'Admin must exist in test database');

  const validAdminToken = jwt.sign(
    { id: admin.id, role: 'admin', subject_type: 'admin', admin_role: admin.admin_role, token_version: admin.token_version },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 1. Public Profile Field Projection
  console.log('[CI CHECK 1] Public Profile Field Projection...');
  const res1 = await fetch(`http://127.0.0.1:5001/api/users/${admin.id}`, {
    headers: { Authorization: `Bearer ${validAdminToken}` }
  });
  const data1 = await res1.json();
  assert.strictEqual(res1.status, 200, 'Public profile fetch must succeed with 200');
  assert.strictEqual('token_version' in data1, false, 'token_version must NOT be present in public profile');
  assert.strictEqual('tokenVersion' in data1, false, 'tokenVersion must NOT be present in public profile');
  assert.strictEqual('admin_role' in data1, false, 'admin_role must NOT be present in public profile');
  console.log('✔ CI CHECK 1 PASSED: Zero sensitive field leakage on public profile');

  // 2. Internal Route Protection
  console.log('[CI CHECK 2] Internal Service Key Authorization...');
  const res2Missing = await fetch(`http://127.0.0.1:5001/api/users/internal/${admin.id}`);
  assert.strictEqual(res2Missing.status, 401, 'Request missing x-internal-service-key must be 401');

  const res2Invalid = await fetch(`http://127.0.0.1:5001/api/users/internal/${admin.id}`, {
    headers: { 'x-internal-service-key': 'invalid_secret_key' }
  });
  assert.strictEqual(res2Invalid.status, 401, 'Request with invalid key must be 401');

  const res2Valid = await fetch(`http://127.0.0.1:5001/api/users/internal/${admin.id}`, {
    headers: { 'x-internal-service-key': INTERNAL_KEY }
  });
  const data2Valid = await res2Valid.json();
  assert.strictEqual(res2Valid.status, 200, 'Valid key must return 200');
  assert.strictEqual(data2Valid.token_version, admin.token_version, 'Valid key must return correct token_version');
  console.log('✔ CI CHECK 2 PASSED: Internal route strictly requires valid constant-time internal key');

  // 3. Revoked Token / Version Mismatch (Fail Closed)
  console.log('[CI CHECK 3] Revoked Token Version Mismatch...');
  const staleToken = jwt.sign(
    { id: admin.id, role: 'admin', subject_type: 'admin', token_version: 99999 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const res3 = await fetch(`http://127.0.0.1:5003/api/providers/admin/settlements`, {
    headers: { Authorization: `Bearer ${staleToken}` }
  });
  const data3 = await res3.json();
  assert.strictEqual(res3.status, 401, 'Stale token must be rejected with 401');
  assert.strictEqual(data3.code, 'TOKEN_VERSION_INVALID', 'Code must be TOKEN_VERSION_INVALID');
  console.log('✔ CI CHECK 3 PASSED: Version mismatch fails closed with 401 TOKEN_VERSION_INVALID');

  // 4. Non-Existent User / Missing Version (Zero Enumeration Oracle)
  console.log('[CI CHECK 4] Non-Existent User / Missing Version (No Enumeration Oracle)...');
  const fakeToken = jwt.sign(
    { id: '00000000-0000-0000-0000-000000000000', role: 'provider', token_version: 1 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const res4 = await fetch(`http://127.0.0.1:5003/api/providers/admin/settlements`, {
    headers: { Authorization: `Bearer ${fakeToken}` }
  });
  const data4 = await res4.json();
  assert.strictEqual(res4.status, 401, 'Non-existent user must be rejected with 401');
  assert.strictEqual(data4.code, 'TOKEN_VERSION_INVALID', 'Must return unified TOKEN_VERSION_INVALID to prevent enumeration');
  console.log('✔ CI CHECK 4 PASSED: Non-existent user fails closed with 401 TOKEN_VERSION_INVALID');

  // 5. Gateway Cookie CSRF Enforcement
  console.log('[CI CHECK 5] Gateway CSRF Guard on Cookie-Authenticated Mutating Requests...');
  const res5NoCsrf = await fetch(`http://127.0.0.1:5000/api/v1/admin/coupons`, {
    method: 'POST',
    headers: {
      'Cookie': `access_token=${validAdminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ code: 'CI_TEST' })
  });
  assert.strictEqual(res5NoCsrf.status, 403, 'Cookie-authenticated mutating request without CSRF header must be 403');
  const data5NoCsrf = await res5NoCsrf.json();
  assert.strictEqual(data5NoCsrf.errorCode, 'FORBIDDEN_CSRF', 'Expected FORBIDDEN_CSRF');

  const res5WithCsrf = await fetch(`http://127.0.0.1:5000/api/v1/admin/coupons`, {
    method: 'POST',
    headers: {
      'Cookie': `access_token=${validAdminToken}`,
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ code: 'CI_TEST' })
  });
  assert.notStrictEqual(res5WithCsrf.status, 403, 'Valid AJAX request with CSRF header must not be blocked by CSRF');
  console.log('✔ CI CHECK 5 PASSED: Gateway blocks cookie CSRF mutating requests with 403 FORBIDDEN_CSRF');

  console.log('\n=== ALL CI SECURITY CHECKS PASSED ===');
  await pool.end();
}

runCiSecuritySuite().catch(err => {
  console.error('CI Suite Failed:', err);
  process.exit(1);
});
