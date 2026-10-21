import assert from 'assert';
import http from 'http';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

import app from '../src/app';
import { getDb } from '../src/config/db';
import { UserRepository } from '../src/repositories/userRepository';
import { RefreshTokenRepository } from '../src/repositories/refreshTokenRepository';
import { sha256 } from '../src/services/sessionService';

const JWT_SECRET = process.env.JWT_SECRET || 'e54a5ea657fd1d25d021433b58a9c6e101d63feb4f6549cc9520bd3c2d815222';
process.env.JWT_SECRET = JWT_SECRET;
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;

async function runLiveHttpTests() {
  console.log('================================================================');
  console.log('  BHARATCLAP: LIVE HTTP SOCKET & CONCURRENCY TEST SUITE         ');
  console.log('================================================================\n');

  // Start actual Express HTTP server on ephemeral port
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[HTTP TEST] Ephemeral test server listening on ${baseUrl}`);

  try {
    const adminUser = await UserRepository.findByEmail('admin@bharatclap.com');
    assert.ok(adminUser, 'Admin user admin@bharatclap.com must exist in test database');

    // -------------------------------------------------------------------------
    // TEST 1: CSRF Guard over HTTP
    // Mutating request carrying cookie WITHOUT X-Requested-With must be rejected
    // -------------------------------------------------------------------------
    console.log('[TEST 1] Testing CSRF rejection on cookie-authenticated POST...');
    const csrfRes = await fetch(`${baseUrl}/api/users/logout`, {
      method: 'POST',
      headers: {
        'Cookie': 'jwt=fake_refresh_token_for_csrf_test',
        'Content-Type': 'application/json'
      }
    });
    assert.strictEqual(csrfRes.status, 403, `TEST 1 FAILED: Expected 403 for missing CSRF header, got ${csrfRes.status}`);
    const csrfBody: any = await csrfRes.json();
    assert.ok(csrfBody?.message?.includes('CSRF') || csrfBody?.code === 'CSRF_DETECTED', 'TEST 1 FAILED: Expected CSRF error');
    console.log('✔ TEST 1 PASSED: POST carrying cookies without X-Requested-With was rejected with 403.');

    // -------------------------------------------------------------------------
    // TEST 2: Real HTTP Cookie Serialization & Path Verification
    // -------------------------------------------------------------------------
    console.log('[TEST 2] Testing real Set-Cookie serialization & cookie attributes...');
    // Seed an active refresh token for admin in database
    const tokenVersion = adminUser.token_version ?? adminUser.tokenVersion ?? 0;
    const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;
    const initialRefreshToken = jwt.sign(
      { id: adminUser.id, role: adminUser.role, token_version: tokenVersion, nonce: 'init_' + Date.now() },
      JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );
    const initialHash = sha256(initialRefreshToken);

    await RefreshTokenRepository.saveToken({
      userId: adminUser.id,
      tokenHash: initialHash,
      deviceInfo: 'Live HTTP Test Suite',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    const refreshHttpRes = await fetch(`${baseUrl}/api/users/refresh`, {
      method: 'POST',
      headers: {
        'Cookie': `jwt=${initialRefreshToken}`,
        'X-Requested-With': 'XMLHttpRequest',
        'X-Client': 'web',
        'User-Agent': 'Live HTTP Test Suite'
      }
    });

    assert.strictEqual(refreshHttpRes.status, 200, `TEST 2 FAILED: Expected 200 on refresh, got ${refreshHttpRes.status}`);
    const rawSetCookies = refreshHttpRes.headers.getSetCookie();
    assert.ok(rawSetCookies.length > 0, 'TEST 2 FAILED: No Set-Cookie headers returned by server');

    const accessCookieHeader = rawSetCookies.find(c => c.startsWith('access_token='));
    const jwtCookieHeader = rawSetCookies.find(c => c.startsWith('jwt=') && !c.includes('jwt=;'));

    assert.ok(accessCookieHeader, 'TEST 2 FAILED: access_token Set-Cookie header missing');
    assert.ok(accessCookieHeader.includes('Path=/'), 'TEST 2 FAILED: access_token Path must be /');
    assert.ok(accessCookieHeader.toLowerCase().includes('httponly'), 'TEST 2 FAILED: access_token must be HttpOnly');

    assert.ok(jwtCookieHeader, 'TEST 2 FAILED: jwt Set-Cookie header missing');
    assert.ok(jwtCookieHeader.includes('Path=/api/users/refresh'), 'TEST 2 FAILED: jwt Path must be /api/users/refresh');
    assert.ok(jwtCookieHeader.includes('SameSite=Strict') || jwtCookieHeader.includes('samesite=strict'), 'TEST 2 FAILED: jwt SameSite must be Strict');

    // Extract access token value and verify subject_type
    const matchAccess = accessCookieHeader.match(/access_token=([^;]+)/);
    assert.ok(matchAccess, 'Unable to parse access_token from Set-Cookie');
    const decodedAccess: any = jwt.verify(matchAccess[1], JWT_SECRET);
    assert.strictEqual(decodedAccess.subject_type, 'admin', 'TEST 2 FAILED: Access token missing subject_type: admin');
    console.log('✔ TEST 2 PASSED: Live HTTP response verified access_token (Path=/, HttpOnly) and jwt (Path=/api/users/refresh, SameSite=Strict).');

    // Extract rotated refresh token from response cookies for Test 3
    const matchJwt = jwtCookieHeader.match(/jwt=([^;]+)/);
    assert.ok(matchJwt, 'Unable to parse rotated jwt from Set-Cookie');
    const rotatedRefreshToken = matchJwt[1];

    // -------------------------------------------------------------------------
    // TEST 3: Real Concurrent Token Refresh over HTTP (Grace-Window Test)
    // -------------------------------------------------------------------------
    console.log('[TEST 3] Testing real concurrent refresh over HTTP (firing 2 simultaneous requests)...');
    const [resA, resB] = await Promise.all([
      fetch(`${baseUrl}/api/users/refresh`, {
        method: 'POST',
        headers: {
          'Cookie': `jwt=${rotatedRefreshToken}`,
          'X-Requested-With': 'XMLHttpRequest',
          'X-Client': 'web',
          'User-Agent': 'Live HTTP Test Suite'
        }
      }),
      fetch(`${baseUrl}/api/users/refresh`, {
        method: 'POST',
        headers: {
          'Cookie': `jwt=${rotatedRefreshToken}`,
          'X-Requested-With': 'XMLHttpRequest',
          'X-Client': 'web',
          'User-Agent': 'Live HTTP Test Suite'
        }
      })
    ]);

    assert.strictEqual(resA.status, 200, `TEST 3 FAILED: Request A returned ${resA.status}`);
    assert.strictEqual(resB.status, 200, `TEST 3 FAILED: Concurrent Request B returned ${resB.status}`);

    // Verify both issued access tokens have subject_type: admin
    const cookiesA = resA.headers.getSetCookie().find(c => c.startsWith('access_token='));
    const cookiesB = resB.headers.getSetCookie().find(c => c.startsWith('access_token='));
    assert.ok(cookiesA, 'Response A missing access_token');
    assert.ok(cookiesB, 'Response B missing access_token');

    const tokenA = cookiesA.match(/access_token=([^;]+)/)![1];
    const tokenB = cookiesB.match(/access_token=([^;]+)/)![1];

    const decodedA: any = jwt.verify(tokenA, JWT_SECRET);
    const decodedB: any = jwt.verify(tokenB, JWT_SECRET);

    assert.strictEqual(decodedA.subject_type, 'admin', 'TEST 3 FAILED: Token A missing subject_type: admin');
    assert.strictEqual(decodedB.subject_type, 'admin', 'TEST 3 FAILED: Token B missing subject_type: admin');
    console.log('✔ TEST 3 PASSED: Both simultaneous HTTP refresh requests succeeded (200 OK) with subject_type: admin.');

    // -------------------------------------------------------------------------
    // TEST 4: IDOR Boundary on GET /api/users/:id
    // -------------------------------------------------------------------------
    console.log('[TEST 4] Testing profile access control (IDOR protection on GET /api/users/:id)...');
    // Real customer from DB
    const customerToken = jwt.sign(
      { id: '5c97f9e7-3713-421e-a8a6-6692e067858f', role: 'customer', token_version: 0 },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Customer trying to read admin's profile
    const idorRes = await fetch(`${baseUrl}/api/users/${adminUser.id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${customerToken}`
      }
    });
    assert.strictEqual(idorRes.status, 403, `TEST 4 FAILED: Expected 403 when customer reads admin profile, got ${idorRes.status}`);
    console.log('✔ TEST 4 PASSED: Customer accessing another profile is blocked with 403 Forbidden.');

    // -------------------------------------------------------------------------
    // TEST 5: HTTP Logout Cookie Clearing
    // -------------------------------------------------------------------------
    console.log('[TEST 5] Testing logout Set-Cookie expiration headers...');
    const logoutRes = await fetch(`${baseUrl}/api/users/logout`, {
      method: 'POST',
      headers: {
        'Cookie': `jwt=${rotatedRefreshToken}; access_token=${tokenA}`,
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    assert.strictEqual(logoutRes.status, 200, `TEST 5 FAILED: Expected 200 on logout, got ${logoutRes.status}`);
    const logoutCookies = logoutRes.headers.getSetCookie();
    
    // Check that cookies are cleared
    const accessClear = logoutCookies.find(c => c.startsWith('access_token=;'));
    const jwtClear = logoutCookies.find(c => c.startsWith('jwt=;'));
    assert.ok(accessClear, 'TEST 5 FAILED: access_token not cleared');
    assert.ok(jwtClear, 'TEST 5 FAILED: jwt not cleared');
    console.log('✔ TEST 5 PASSED: Logout clears both access_token and jwt cookies via HTTP.');

    console.log('\n================================================================');
    console.log('  ✔ ALL LIVE HTTP SOCKET & CONCURRENCY TESTS PASSED (5/5)       ');
    console.log('================================================================\n');

  } finally {
    server.close();
  }
}

if (require.main === module) {
  runLiveHttpTests().then(() => process.exit(0)).catch(err => {
    console.error('LIVE HTTP TEST ERROR:', err);
    process.exit(1);
  });
}
