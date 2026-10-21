import assert from 'assert';
import http from 'http';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import app from '../src/app';
import { getDb } from '../src/config/db';
import { RefreshTokenRepository } from '../src/repositories/refreshTokenRepository';
import { UserRepository } from '../src/repositories/userRepository';
import { AdminRepository } from '../src/repositories/adminRepository';
import * as sessionHelper from '../src/utils/sessionHelper';

const sha256 = (val: string) => crypto.createHash('sha256').update(val).digest('hex');

async function runSessionEvictionAndGraceTests() {
  console.log('================================================================');
  console.log('  BHARATCLAP: COMPREHENSIVE REFRESH, EVICTION & CONSTRAINTS TEST');
  console.log('================================================================\n');

  const pool = getDb();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const JWT_SECRET = process.env.JWT_SECRET || 'secret';
  const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;
  let adminAccessToken = '';

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Migration 035 Verification — chk_refresh_tokens_owner Constraint
    // -------------------------------------------------------------------------
    console.log('[TEST 1] Verifying Migration 035 owner constraint (both vs neither vs single)...');

    const adminEntity = await AdminRepository.findById('c167bc46-666d-4888-a220-8ce5f33efc2a');
    assert.ok(adminEntity, 'auth.admins must contain migrated admin row c167bc46-666d-4888-a220-8ce5f33efc2a');
    assert.strictEqual(adminEntity.email, 'admin@bharatclap.com');

    const sampleUserRes = await pool.query(`SELECT id FROM auth.users WHERE deleted_at IS NULL LIMIT 1`);
    assert.ok(sampleUserRes.rows[0]?.id, 'Must have at least one user in auth.users');
    const sampleUserId = sampleUserRes.rows[0].id;

    // Case 1A: Both user_id and admin_id set -> MUST FAIL
    let bothFailed = false;
    try {
      await pool.query(
        `INSERT INTO auth.refresh_tokens (user_id, admin_id, token_hash, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')`,
        [sampleUserId, adminEntity.id, 'hash_both_' + Date.now()]
      );
    } catch (err: any) {
      bothFailed = err.message.includes('chk_refresh_tokens_owner');
    }
    assert.ok(bothFailed, 'TEST 1A FAILED: Constraint must reject rows with BOTH user_id and admin_id set');

    // Case 1B: Neither user_id nor admin_id set -> MUST FAIL
    let neitherFailed = false;
    try {
      await pool.query(
        `INSERT INTO auth.refresh_tokens (user_id, admin_id, token_hash, expires_at)
         VALUES (NULL, NULL, $1, NOW() + INTERVAL '1 hour')`,
        ['hash_neither_' + Date.now()]
      );
    } catch (err: any) {
      neitherFailed = err.message.includes('chk_refresh_tokens_owner');
    }
    assert.ok(neitherFailed, 'TEST 1B FAILED: Constraint must reject rows with NEITHER user_id nor admin_id set');

    // Case 1C: Exactly one owner set (user_id only) -> MUST SUCCEED
    const userOnlyHash = 'hash_user_only_' + Date.now();
    const userOnlyRes = await pool.query(
      `INSERT INTO auth.refresh_tokens (user_id, admin_id, token_hash, expires_at)
       VALUES ($1, NULL, $2, NOW() + INTERVAL '1 hour') RETURNING id`,
      [sampleUserId, userOnlyHash]
    );
    assert.ok(userOnlyRes.rows[0]?.id, 'TEST 1C FAILED: user_id only must be accepted');

    // Case 1D: Exactly one owner set (admin_id only) -> MUST SUCCEED
    const adminOnlyHash = 'hash_admin_only_' + Date.now();
    const adminOnlyRes = await pool.query(
      `INSERT INTO auth.refresh_tokens (user_id, admin_id, token_hash, expires_at)
       VALUES (NULL, $1, $2, NOW() + INTERVAL '1 hour') RETURNING id`,
      [adminEntity.id, adminOnlyHash]
    );
    assert.ok(adminOnlyRes.rows[0]?.id, 'TEST 1D FAILED: admin_id only must be accepted');

    // Clean up test constraint rows
    await pool.query(`DELETE FROM auth.refresh_tokens WHERE token_hash IN ($1, $2)`, [userOnlyHash, adminOnlyHash]);
    console.log('✔ TEST 1 PASSED: Migration 035 chk_refresh_tokens_owner correctly rejects both owners set and neither owner set.');

    // -------------------------------------------------------------------------
    // TEST 2: Evicted session returns 401 and active sessions survive concurrent refresh
    // -------------------------------------------------------------------------
    console.log('[TEST 2] Testing session eviction (401 without breach) and active session survival...');

    // Start with clean active sessions for adminEntity
    await pool.query(`UPDATE auth.refresh_tokens SET revoked = TRUE WHERE user_id = $1 OR admin_id = $1`, [adminEntity.id]);

    const vBefore = adminEntity.token_version ?? 0;

    // Create Token 1 (Device A: oldest, created 30s ago -> will be evicted)
    const token1 = jwt.sign(
      { id: adminEntity.id, role: 'admin', token_version: vBefore, nonce: 't1_' + Date.now() },
      JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );
    const hash1 = sha256(token1);
    await pool.query(
      `INSERT INTO auth.refresh_tokens (admin_id, token_hash, device_info, ip_address, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '30 seconds', NOW() - INTERVAL '30 seconds')`,
      [adminEntity.id, hash1, 'Device A (Evicted)', '127.0.0.1', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]
    );

    // Create Token 2 (Device B: Active device, created 20s ago)
    const token2 = jwt.sign(
      { id: adminEntity.id, role: 'admin', token_version: vBefore, nonce: 't2_' + Date.now() },
      JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );
    const hash2 = sha256(token2);
    await pool.query(
      `INSERT INTO auth.refresh_tokens (admin_id, token_hash, device_info, ip_address, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '20 seconds', NOW() - INTERVAL '20 seconds')`,
      [adminEntity.id, hash2, 'Device B (Active)', '127.0.0.1', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]
    );

    // Create Token 3 (Device C: Active device, created 10s ago, pushes count to 3 -> Token 1 gets evicted)
    const token3 = jwt.sign(
      { id: adminEntity.id, role: 'admin', token_version: vBefore, nonce: 't3_' + Date.now() },
      JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );
    const hash3 = sha256(token3);
    await pool.query(
      `INSERT INTO auth.refresh_tokens (admin_id, token_hash, device_info, ip_address, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '10 seconds', NOW() - INTERVAL '10 seconds')`,
      [adminEntity.id, hash3, 'Device C (Active)', '127.0.0.1', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]
    );

    // Enforce session limit
    await sessionHelper.enforceSessionLimit({ adminId: adminEntity.id }, 'admin');

    // Verify Token 1 has revoked_reason = 'SESSION_LIMIT'
    const evictRow = await pool.query(
      `SELECT revoked, revoked_reason FROM auth.refresh_tokens WHERE token_hash = $1`,
      [hash1]
    );
    assert.strictEqual(evictRow.rows[0].revoked, true);
    assert.strictEqual(evictRow.rows[0].revoked_reason, 'SESSION_LIMIT');

    // Present evicted Token 1 -> Returns 401
    const evictRes = await fetch(`${baseUrl}/api/users/refresh`, {
      method: 'POST',
      headers: {
        'Cookie': `jwt=${token1}`,
        'X-Requested-With': 'XMLHttpRequest',
        'X-Client': 'web',
        'User-Agent': 'Device A (Evicted)'
      }
    });
    assert.strictEqual(evictRes.status, 401);
    const evictBody: any = await evictRes.json();
    assert.strictEqual(evictBody.message, 'Session expired due to login on another device');

    // Now test that active Device B SURVIVES and can refresh cleanly while limit is active!
    const activeRefreshRes = await fetch(`${baseUrl}/api/users/refresh`, {
      method: 'POST',
      headers: {
        'Cookie': `jwt=${token2}`,
        'X-Requested-With': 'XMLHttpRequest',
        'X-Client': 'web',
        'User-Agent': 'Device B (Active)'
      }
    });
    assert.strictEqual(activeRefreshRes.status, 200, 'TEST 2 FAILED: Active device B must succeed with 200 during concurrent refresh');

    // Clean up
    await pool.query(`DELETE FROM auth.refresh_tokens WHERE token_hash IN ($1, $2, $3)`, [hash1, hash2, hash3]);
    console.log('✔ TEST 2 PASSED: Evicted session returned 401 without breach, and active sessions survived refresh while limit was enforced.');

    // -------------------------------------------------------------------------
    // TEST 3: Grace window device mismatch (rejects 403 without running breach handler)
    // -------------------------------------------------------------------------
    console.log('[TEST 3] Testing grace window device mismatch (rejects 403 without running breach handler)...');

    const tokenDeviceLegit = jwt.sign(
      { id: adminEntity.id, role: 'admin', token_version: vBefore, nonce: 'dev_legit_' + Date.now() },
      JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );
    const hashDeviceLegit = sha256(tokenDeviceLegit);
    const hashReplacement = sha256('replacement_' + Date.now());

    // Insert active replacement session
    await pool.query(
      `INSERT INTO auth.refresh_tokens (
        admin_id, token_hash, device_info, ip_address, expires_at, revoked
      ) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days', FALSE)`,
      [adminEntity.id, hashReplacement, 'Mozilla/5.0 Legit Browser', '127.0.0.1']
    );

    // Insert rotated token with replaced_by_hash pointing to the active replacement
    await pool.query(
      `INSERT INTO auth.refresh_tokens (
        admin_id, token_hash, device_info, ip_address, expires_at,
        revoked, rotated_at, replaced_by_hash
      ) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days', TRUE, NOW() - INTERVAL '5 seconds', $5)`,
      [adminEntity.id, hashDeviceLegit, 'Mozilla/5.0 Legit Browser', '127.0.0.1', hashReplacement]
    );

    const attackerRes = await fetch(`${baseUrl}/api/users/refresh`, {
      method: 'POST',
      headers: {
        'Cookie': `jwt=${tokenDeviceLegit}`,
        'X-Requested-With': 'XMLHttpRequest',
        'X-Client': 'web',
        'User-Agent': 'curl/7.88.1 Sneaky Attacker'
      }
    });

    assert.strictEqual(attackerRes.status, 403, 'TEST 3 FAILED: Attacker with different User-Agent in grace window must be rejected with 403');
    const attackerBody: any = await attackerRes.json();
    assert.ok(attackerBody.message.includes('Device mismatch'), `Expected device mismatch message, got: ${attackerBody.message}`);

    // Confirm legitimately active sessions were NOT destroyed (breach handler was NOT called)
    const legitCheck = await pool.query(
      `SELECT count(*) FROM auth.refresh_tokens WHERE admin_id = $1 AND revoked = FALSE AND token_hash = $2`,
      [adminEntity.id, hashReplacement]
    );
    assert.strictEqual(parseInt(legitCheck.rows[0].count), 1, 'Legitimate replacement session must still be active');

    await pool.query(`DELETE FROM auth.refresh_tokens WHERE token_hash IN ($1, $2)`, [hashDeviceLegit, hashReplacement]);
    console.log('✔ TEST 3 PASSED: Device mismatch rejected with 403 without revoking legitimate active sessions.');

    // -------------------------------------------------------------------------
    // TEST 4: Failed enforceSessionLimit inside transaction (preserves old cookie)
    // -------------------------------------------------------------------------
    console.log('[TEST 4] Testing failed enforceSessionLimit inside transaction (preserves old cookie)...');

    const tokenRollback = jwt.sign(
      { id: adminEntity.id, role: 'admin', token_version: vBefore, nonce: 'rb_' + Date.now() },
      JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );
    const hashRollback = sha256(tokenRollback);
    await RefreshTokenRepository.saveToken({
      adminId: adminEntity.id,
      tokenHash: hashRollback,
      deviceInfo: 'Device Rollback Test',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    // Trigger simulated enforceSessionLimit error inside transaction
    sessionHelper.setTestSessionLimitError(new Error('SIMULATED_SESSION_LIMIT_FAILURE_FOR_ROLLBACK_TEST'));

    let failedRefreshStatus = 0;
    try {
      const failRes = await fetch(`${baseUrl}/api/users/refresh`, {
        method: 'POST',
        headers: {
          'Cookie': `jwt=${tokenRollback}`,
          'X-Requested-With': 'XMLHttpRequest',
          'X-Client': 'web',
          'User-Agent': 'Device Rollback Test'
        }
      });
      failedRefreshStatus = failRes.status;
    } finally {
      sessionHelper.setTestSessionLimitError(null);
    }

    assert.strictEqual(failedRefreshStatus, 500, 'Expected 500 when enforceSessionLimit fails');

    // Verify in DB that the transaction ROLLED BACK:
    const tokenInDbAfterFail = await RefreshTokenRepository.findByTokenHash(hashRollback);
    assert.ok(tokenInDbAfterFail, 'Old token must still exist in DB');
    assert.strictEqual(tokenInDbAfterFail.revoked, false, 'TEST 4 FAILED: Old token must NOT be marked revoked after transaction rollback');
    assert.strictEqual(tokenInDbAfterFail.rotated_at, null, 'TEST 4 FAILED: Old token rotated_at must be null');

    // Prove that the old cookie STILL WORKS afterward!
    const retryRes = await fetch(`${baseUrl}/api/users/refresh`, {
      method: 'POST',
      headers: {
        'Cookie': `jwt=${tokenRollback}`,
        'X-Requested-With': 'XMLHttpRequest',
        'X-Client': 'web',
        'User-Agent': 'Device Rollback Test'
      }
    });
    assert.strictEqual(retryRes.status, 200, 'TEST 4 FAILED: Old token retry must succeed with 200 after limit failure recovery');

    await pool.query(`DELETE FROM auth.refresh_tokens WHERE token_hash = $1`, [hashRollback]);
    console.log('✔ TEST 4 PASSED: Failed enforceSessionLimit cleanly rolled back the transaction, leaving the old cookie fully functional.');

    // -------------------------------------------------------------------------
    // TEST 5: Real Admin Login -> 2FA Verification -> Refresh with Real Cookies
    // -------------------------------------------------------------------------
    console.log('[TEST 5] Testing real admin login flow (adminLogin -> 2FA -> refresh) against migrated auth.admins...');

    // Confirm that auth.users has ZERO admin rows
    const usersAdminCheck = await pool.query(
      `SELECT count(*) FROM auth.users WHERE role IN ('admin', 'super_admin') OR admin_role IS NOT NULL`
    );
    assert.strictEqual(parseInt(usersAdminCheck.rows[0].count), 0, 'TEST 5 FAILED: auth.users must contain 0 admin rows');

    // Ensure clean admin state (unlocked, active)
    await pool.query(
      `UPDATE auth.admins 
       SET status = 'active', failed_otp_attempts = 0, otp_locked_until = NULL 
       WHERE id = $1`,
      [adminEntity.id]
    );

    // Step 1: Real adminLogin via HTTP POST /api/users/admin/login
    const loginRes = await fetch(`${baseUrl}/api/users/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@bharatclap.com', password: 'admin123' })
    });
    assert.strictEqual(loginRes.status, 200, `TEST 5 FAILED: adminLogin returned ${loginRes.status}`);
    const loginData: any = await loginRes.json();

    let authCookies: string[] = [];

    if (loginData.requiresTwoFactorSetup) {
      console.log('  -> Admin 2FA setup required. Setting up TOTP...');
      const setupRes = await fetch(`${baseUrl}/api/users/admin/2fa/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken: loginData.tempToken })
      });
      assert.strictEqual(setupRes.status, 200, '2FA setup must return 200');
      const setupData: any = await setupRes.json();
      assert.ok(setupData.secret, 'Setup must return base32 secret');

      const totpCode = speakeasy.totp({ secret: setupData.secret, encoding: 'base32' });
      const verifySetupRes = await fetch(`${baseUrl}/api/users/admin/2fa/verify-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken: loginData.tempToken, code: totpCode })
      });
      assert.strictEqual(verifySetupRes.status, 200, 'Verify setup must return 200');
      authCookies = verifySetupRes.headers.getSetCookie();
    } else if (loginData.requiresTwoFactor) {
      console.log('  -> Admin 2FA already enabled. Verifying TOTP code...');
      const freshAdmin = await AdminRepository.findById(adminEntity.id);
      assert.ok(freshAdmin?.totp_secret, 'Admin must have totp_secret in auth.admins');
      const totpCode = speakeasy.totp({ secret: freshAdmin!.totp_secret!, encoding: 'base32' });

      const verifyRes = await fetch(`${baseUrl}/api/users/admin/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken: loginData.tempToken, code: totpCode })
      });
      assert.strictEqual(verifyRes.status, 200, `Verify 2FA must return 200, got ${verifyRes.status}`);
      authCookies = verifyRes.headers.getSetCookie();
    } else {
      assert.fail('adminLogin must require either 2FA setup or 2FA verify');
    }

    // Extract real jwt cookie produced by real issueSession
    const realJwtCookie = authCookies.find(c => c.startsWith('jwt=') && !c.includes('jwt=;'))?.match(/jwt=([^;]+)/)?.[1];
    assert.ok(realJwtCookie, 'Login flow must set a real jwt cookie via issueSession');

    // Step 2: Real refresh with the cookie issued by the real login
    const realRefreshRes = await fetch(`${baseUrl}/api/users/refresh`, {
      method: 'POST',
      headers: {
        'Cookie': `jwt=${realJwtCookie}`,
        'X-Requested-With': 'XMLHttpRequest',
        'X-Client': 'web',
        'User-Agent': 'Real Admin Test Device'
      }
    });

    assert.strictEqual(realRefreshRes.status, 200, `TEST 5 FAILED: Real admin refresh returned ${realRefreshRes.status}`);
    const refreshedCookies = realRefreshRes.headers.getSetCookie();
    const accessHeader = refreshedCookies.find(c => c.startsWith('access_token='));
    const replacementJwtHeader = refreshedCookies.find(c => c.startsWith('jwt=') && !c.includes('jwt=;'));

    assert.ok(accessHeader, 'Refresh must return new access_token');
    assert.ok(replacementJwtHeader, 'Refresh must return replacement jwt');

    const accessTokenVal = accessHeader.match(/access_token=([^;]+)/)?.[1];
    adminAccessToken = accessTokenVal!;
    const decodedAccessToken: any = jwt.verify(accessTokenVal!, JWT_SECRET);
    assert.strictEqual(decodedAccessToken.subject_type, 'admin', 'Access token must carry subject_type: admin');
    assert.strictEqual(decodedAccessToken.id, adminEntity.id);

    // Verify replacement row in DB has admin_id set and user_id = NULL
    const replacementJwtVal = replacementJwtHeader.match(/jwt=([^;]+)/)?.[1];
    const replacementHash = sha256(replacementJwtVal!);
    const dbTokenRow = await pool.query(
      `SELECT user_id, admin_id, revoked FROM auth.refresh_tokens WHERE token_hash = $1`,
      [replacementHash]
    );
    assert.strictEqual(dbTokenRow.rows[0].user_id, null, 'Replacement session must have user_id = null');
    assert.strictEqual(dbTokenRow.rows[0].admin_id, adminEntity.id, 'Replacement session must have admin_id set');
    assert.strictEqual(dbTokenRow.rows[0].revoked, false);

    // Step 3: Verify the refreshed access token works on protected admin management route
    const mgmtRes = await fetch(`${baseUrl}/api/users/admin/manage-admins`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessTokenVal}`,
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    assert.strictEqual(mgmtRes.status, 200, 'Refreshed access token must authenticate against admin management');
    const mgmtData: any = await mgmtRes.json();
    assert.ok(mgmtData.admins.some((a: any) => a.email === 'admin@bharatclap.com'), 'Admin list must contain super admin');

    console.log('✔ TEST 5 PASSED: Real adminLogin -> 2FA -> refresh cycle against auth.admins executed cleanly with zero rows in auth.users.');

    // -------------------------------------------------------------------------
    // TEST 6: Max Devices Login Eviction (Standardized Transactional Eviction)
    // -------------------------------------------------------------------------
    console.log('[TEST 6] Testing login on max devices + exactly 1 eviction at limit + 1...');

    const testCustomerEmail = 'max_device_test_user@example.com';
    const testCustomerPass = 'TestPass123!';

    let testCustomer = await UserRepository.findByEmail(testCustomerEmail);
    if (!testCustomer) {
      testCustomer = await UserRepository.create({
        name: 'Max Device Test User',
        email: testCustomerEmail,
        phone: null,
        password_hash: await bcrypt.hash(testCustomerPass, 10),
        role: 'customer',
        status: 'active',
        is_email_verified: true,
      });
    } else {
      await UserRepository.update(testCustomer.id, {
        password_hash: await bcrypt.hash(testCustomerPass, 10),
        status: 'active',
      });
    }

    // Clean prior sessions
    await pool.query(`DELETE FROM auth.refresh_tokens WHERE user_id = $1`, [testCustomer.id]);

    // Customer maxDevices is 5. Log in on exactly 5 devices
    for (let i = 1; i <= 5; i++) {
      const devRes = await fetch(`${baseUrl}/api/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `Customer Device ${i}`
        },
        body: JSON.stringify({ email: testCustomerEmail, password: testCustomerPass })
      });
      assert.strictEqual(devRes.status, 200, `Login device ${i} must succeed`);
    }

    // Check DB: exactly 5 active sessions, 0 revoked
    const fiveSessions = await pool.query(
      `SELECT id, device_info, revoked, revoked_reason FROM auth.refresh_tokens 
       WHERE user_id = $1 ORDER BY created_at ASC`,
      [testCustomer.id]
    );
    assert.strictEqual(fiveSessions.rows.length, 5, 'Must have exactly 5 session rows in DB');
    const activeCountBefore = fiveSessions.rows.filter(r => !r.revoked).length;
    assert.strictEqual(activeCountBefore, 5, 'All 5 sessions must be active before 6th login');

    // Now log in on Device 6 -> pushes total to 6 -> exactly Device 1 must be evicted
    const sixthRes = await fetch(`${baseUrl}/api/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Customer Device 6'
      },
      body: JSON.stringify({ email: testCustomerEmail, password: testCustomerPass })
    });
    assert.strictEqual(sixthRes.status, 200, 'Login on device 6 must succeed');

    const sixSessions = await pool.query(
      `SELECT id, device_info, revoked, revoked_reason FROM auth.refresh_tokens 
       WHERE user_id = $1 ORDER BY created_at ASC`,
      [testCustomer.id]
    );
    assert.strictEqual(sixSessions.rows.length, 6, 'Total 6 session rows recorded');

    const activeSessionsAfter = sixSessions.rows.filter(r => !r.revoked);
    const evictedSessionsAfter = sixSessions.rows.filter(r => r.revoked && r.revoked_reason === 'SESSION_LIMIT');

    assert.strictEqual(activeSessionsAfter.length, 5, 'TEST 6 FAILED: Exactly 5 sessions must remain active');
    assert.strictEqual(evictedSessionsAfter.length, 1, 'TEST 6 FAILED: Exactly ONE session must be evicted');
    assert.strictEqual(evictedSessionsAfter[0].device_info, 'Customer Device 1', 'Oldest session (Device 1) must be the one evicted');

    // Clean up test customer
    await pool.query(`DELETE FROM auth.refresh_tokens WHERE user_id = $1`, [testCustomer.id]);
    await pool.query(`DELETE FROM auth.users WHERE id = $1`, [testCustomer.id]);
    console.log('✔ TEST 6 PASSED: Login on max devices (5) followed by device 6 cleanly evicted exactly one session (Device 1).');

    // -------------------------------------------------------------------------
    // TEST 7: Security: getUserById Allowlist Prevents Secret Leakage
    // -------------------------------------------------------------------------
    console.log('[TEST 7] Testing getUserById allowlist (does NOT leak TOTP secret or 2FA recovery)...');

    // Populate admin row in auth.admins with secret data
    await pool.query(
      `UPDATE auth.admins 
       SET totp_secret = 'BASE32SECRETTEST123',
           two_factor_recovery = ARRAY['RECOVERY_CODE_1', 'RECOVERY_CODE_2'],
           failed_otp_attempts = 3,
           otp_locked_until = NOW() + INTERVAL '10 minutes'
       WHERE id = $1`,
      [adminEntity.id]
    );

    // Call GET /api/users/:id as self/admin
    const profileRes = await fetch(`${baseUrl}/api/users/${adminEntity.id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    assert.strictEqual(profileRes.status, 200, `Profile fetch must return 200, got ${profileRes.status}`);
    const profileData: any = await profileRes.json();

    // Verify ALLOWLIST behavior: None of the secret fields may exist in the response
    assert.strictEqual(profileData.totp_secret, undefined, 'TEST 7 FAILED: totp_secret must NOT be exposed');
    assert.strictEqual(profileData.two_factor_recovery, undefined, 'TEST 7 FAILED: two_factor_recovery must NOT be exposed');
    assert.strictEqual(profileData.failed_otp_attempts, undefined, 'TEST 7 FAILED: failed_otp_attempts must NOT be exposed');
    assert.strictEqual(profileData.otp_locked_until, undefined, 'TEST 7 FAILED: otp_locked_until must NOT be exposed');
    assert.strictEqual(profileData.password, undefined, 'TEST 7 FAILED: password must NOT be exposed');
    assert.strictEqual(profileData.password_hash, undefined, 'TEST 7 FAILED: password_hash must NOT be exposed');

    // Safe fields must be present
    assert.strictEqual(profileData.id, adminEntity.id);
    assert.strictEqual(profileData.email, adminEntity.email);
    assert.strictEqual(profileData.role, 'admin');

    // Clean up test lockout/attempts
    await pool.query(
      `UPDATE auth.admins SET failed_otp_attempts = 0, otp_locked_until = NULL WHERE id = $1`,
      [adminEntity.id]
    );

    console.log('✔ TEST 7 PASSED: getUserById strictly allowlists safe profile fields; zero 2FA/auth secrets leaked.');

    // -------------------------------------------------------------------------
    // TEST 8: Negative Authorization Tests
    // -------------------------------------------------------------------------
    console.log('[TEST 8] Testing negative authorization cases (customer 403, stale token 401, blocked admin 403, second super admin 409)...');

    // Case 8A: Customer token on /api/users/admin/manage-admins -> MUST RETURN 403
    const customerUser = await UserRepository.findById(sampleUserId);
    const customerToken = jwt.sign(
      { id: sampleUserId, role: 'customer', token_version: customerUser?.token_version ?? 0 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const custOnAdminRes = await fetch(`${baseUrl}/api/users/admin/manage-admins`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    assert.strictEqual(custOnAdminRes.status, 403, 'Case 8A FAILED: Customer token on admin management route must return 403');

    // Case 8B: Version-bumped admin token -> MUST RETURN 401 TOKEN_VERSION_INVALID on next request
    const staleAdminToken = jwt.sign(
      { id: adminEntity.id, role: 'admin', subject_type: 'admin', token_version: 99999 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const staleRes = await fetch(`${baseUrl}/api/users/admin/manage-admins`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${staleAdminToken}`,
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    assert.strictEqual(staleRes.status, 401, 'Case 8B FAILED: Stale token_version must return 401');
    const staleBody: any = await staleRes.json();
    assert.strictEqual(staleBody.code, 'TOKEN_VERSION_INVALID');

    // Case 8C: Blocked admin token -> MUST RETURN 403
    await pool.query(`UPDATE auth.admins SET status = 'blocked' WHERE id = $1`, [adminEntity.id]);
    try {
      const blockedRes = await fetch(`${baseUrl}/api/users/admin/manage-admins`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminAccessToken}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      assert.strictEqual(blockedRes.status, 403, 'Case 8C FAILED: Blocked admin token must return 403');
    } finally {
      await pool.query(`UPDATE auth.admins SET status = 'active' WHERE id = $1`, [adminEntity.id]);
    }

    // Case 8D: Second super admin insert -> MUST BE REJECTED by ux_admins_one_super_admin
    let secondSuperFailed = false;
    try {
      await pool.query(
        `INSERT INTO auth.admins (email, name, password_hash, admin_role, status)
         VALUES ($1, $2, $3, 'super_admin', 'active')`,
        ['second_super_' + Date.now() + '@bharatclap.com', 'Second Super Admin', 'hash']
      );
    } catch (err: any) {
      secondSuperFailed = err.message.includes('ux_admins_one_super_admin');
    }
    assert.ok(secondSuperFailed, 'Case 8D FAILED: Second super admin insert must be rejected by ux_admins_one_super_admin');
    console.log('✔ TEST 8 PASSED: Negative tests verified: customer 403, stale token 401, blocked 403, second super admin rejected.');

    console.log('\n================================================================');
    console.log('  ✔ ALL 8 TESTS PASSED: EVICTION, HARDENING, REAL LOGIN, ALLOWLIST & NEGATIVE');
    console.log('================================================================\n');

  } finally {
    server.close();
  }
}

if (require.main === module) {
  runSessionEvictionAndGraceTests().then(() => process.exit(0)).catch(err => {
    console.error('TEST ERROR:', err);
    process.exit(1);
  });
}
