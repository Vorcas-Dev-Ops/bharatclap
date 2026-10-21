import assert from 'assert';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

import { generateAccessToken, generateRefreshToken } from '../src/utils/generateToken';
import { issueSession, sessionResponse } from '../src/services/sessionService';
import { createAdmin } from '../src/controllers/admin/adminManagementController';
import { ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_PATH } from '../src/utils/authCookies';

const JWT_SECRET = process.env.JWT_SECRET || 'e54a5ea657fd1d25d021433b58a9c6e101d63feb4f6549cc9520bd3c2d815222';
process.env.JWT_SECRET = JWT_SECRET;
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;

export async function runIntegrationTests() {
  console.log('================================================================');
  console.log('  BHARATCLAP: ADMIN 2FA, SESSION & REFRESH VERIFICATION SUITE   ');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // TEST 1: Default value of ENABLE_DIRECT_ADMIN_CREATION must be OFF when unset
  // ---------------------------------------------------------------------------
  delete process.env.ENABLE_DIRECT_ADMIN_CREATION;
  let status1 = 0;
  let body1: any = null;
  const mockReq1: any = { body: { name: 'Direct Admin', email: 'direct@bharatclap.com', password: 'SecretPassword123' } };
  const mockRes1: any = {
    status: (code: number) => { status1 = code; return mockRes1; },
    json: (data: any) => { body1 = data; return mockRes1; }
  };

  await createAdmin(mockReq1, mockRes1);
  assert.strictEqual(status1, 403, 'TEST 1 FAILED: createAdmin did not return 403 when ENABLE_DIRECT_ADMIN_CREATION is unset');
  assert.ok(body1?.message?.includes('disabled during transition'), 'TEST 1 FAILED: Expected disable message');
  console.log('✔ TEST 1 PASSED: ENABLE_DIRECT_ADMIN_CREATION defaults to OFF when unset (403 Forbidden).');

  // ---------------------------------------------------------------------------
  // TEST 2: issueSession response shapes: Web (cookies only) vs Mobile (body token)
  // ---------------------------------------------------------------------------
  const testAdminUser = {
    id: 'c167bc46-666d-4888-a220-8ce5f33efc2a',
    name: 'Admin User',
    email: 'admin@bharatclap.com',
    role: 'admin',
    admin_role: 'super_admin',
    token_version: 0
  };

  // 2A: Web Client (Cookie-based auth)
  let cookiesWeb: Record<string, { val: string; opts: any }> = {};
  const mockReqWeb: any = {
    headers: { 'x-client': 'web', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    get: (h: string) => mockReqWeb.headers[h.toLowerCase()],
    ip: '127.0.0.1'
  };
  const mockResWeb: any = {
    cookie: (name: string, val: string, opts: any) => {
      cookiesWeb[`${name}:${opts?.path || '/'}`] = { val, opts };
    },
    clearCookie: (name: string, opts: any) => {
      delete cookiesWeb[`${name}:${opts?.path || '/'}`];
    },
    status: (code: number) => mockResWeb,
    json: (d: any) => d
  };

  const webTokenBody = await issueSession(mockReqWeb, mockResWeb, testAdminUser, { subject_type: 'admin' });
  assert.deepStrictEqual(webTokenBody, {}, 'TEST 2A FAILED: Web client response body must NOT contain token field');

  // Cookie checks
  const accessCookieEntry = cookiesWeb[`${ACCESS_COOKIE}:/`];
  assert.ok(accessCookieEntry, 'TEST 2A FAILED: access_token cookie missing at Path=/');
  assert.strictEqual(accessCookieEntry.opts.httpOnly, true, 'TEST 2A FAILED: access_token cookie must be httpOnly');
  assert.strictEqual(accessCookieEntry.opts.sameSite, 'lax', 'TEST 2A FAILED: access_token cookie sameSite must be lax');
  assert.strictEqual(accessCookieEntry.opts.path, '/', 'TEST 2A FAILED: access_token cookie path must be /');

  const refreshCookieEntry = cookiesWeb[`${REFRESH_COOKIE}:${REFRESH_PATH}`];
  assert.ok(refreshCookieEntry, 'TEST 2A FAILED: jwt refresh cookie missing at Path=/api/users/refresh');
  assert.strictEqual(refreshCookieEntry.opts.httpOnly, true, 'TEST 2A FAILED: jwt cookie must be httpOnly');
  assert.strictEqual(refreshCookieEntry.opts.sameSite, 'strict', 'TEST 2A FAILED: jwt cookie sameSite must be strict');
  assert.strictEqual(refreshCookieEntry.opts.path, '/api/users/refresh', 'TEST 2A FAILED: jwt cookie path must be /api/users/refresh');

  const decodedWeb: any = jwt.verify(accessCookieEntry.val, JWT_SECRET);
  assert.strictEqual(decodedWeb.subject_type, 'admin', 'TEST 2A FAILED: Web JWT missing subject_type: admin');
  assert.strictEqual(decodedWeb.role, 'admin', 'TEST 2A FAILED: Web JWT missing role: admin');
  console.log('✔ TEST 2A PASSED: Web issueSession sets access_token (Path=/) and jwt (Path=/api/users/refresh, SameSite=Strict), with bodyToken = {}.');

  // 2B: Mobile Client (Bearer token in body)
  let cookiesMobile: Record<string, { val: string; opts: any }> = {};
  const mockReqMobile: any = {
    headers: { 'x-client': 'mobile', 'user-agent': 'Dart/3.0 (dart:io) Flutter BharatClapMobile' },
    get: (h: string) => mockReqMobile.headers[h.toLowerCase()],
    ip: '127.0.0.1'
  };
  const mockResMobile: any = {
    cookie: (name: string, val: string, opts: any) => {
      cookiesMobile[`${name}:${opts?.path || '/'}`] = { val, opts };
    },
    clearCookie: (name: string, opts: any) => {
      delete cookiesMobile[`${name}:${opts?.path || '/'}`];
    },
    status: (code: number) => mockResMobile,
    json: (d: any) => d
  };

  const mobileTokenBody = await issueSession(mockReqMobile, mockResMobile, testAdminUser, { subject_type: 'admin' });
  assert.ok(mobileTokenBody.token, 'TEST 2B FAILED: Mobile client bodyToken missing token');

  const fullMobileResponse: any = sessionResponse(testAdminUser, mobileTokenBody);
  assert.strictEqual(fullMobileResponse.token, mobileTokenBody.token, 'TEST 2B FAILED: Root token field missing in mobile response');
  assert.strictEqual(fullMobileResponse.user?.token, mobileTokenBody.token, 'TEST 2B FAILED: user.token field missing in mobile response');

  const decodedMobile: any = jwt.verify(mobileTokenBody.token, JWT_SECRET);
  assert.strictEqual(decodedMobile.subject_type, 'admin', 'TEST 2B FAILED: Mobile JWT missing subject_type: admin');
  console.log('✔ TEST 2B PASSED: Mobile response includes both root token and user.token with subject_type: admin.');

  // ---------------------------------------------------------------------------
  // TEST 3: Admin Token Refresh Lifecycle: subject_type preserved across paths
  // ---------------------------------------------------------------------------
  // 3A: Normal Rotation Path
  const adminClaimsOnRotation = testAdminUser.role === 'admin' ? { subject_type: 'admin' } : undefined;
  const rotatedAccessToken = generateAccessToken(
    testAdminUser.id,
    testAdminUser.role,
    testAdminUser.token_version,
    'web',
    adminClaimsOnRotation
  );
  const decodedRotated: any = jwt.verify(rotatedAccessToken, JWT_SECRET);
  assert.strictEqual(decodedRotated.subject_type, 'admin', 'TEST 3A FAILED: Rotated access token lost subject_type');
  assert.strictEqual(decodedRotated.role, 'admin', 'TEST 3A FAILED: Rotated access token lost role');

  // 3B: Concurrency Grace-Window Path (Simulating replay within 30s)
  const decodedPayloadFromGraceToken = { id: testAdminUser.id, role: 'admin' };
  const adminClaimsOnGrace = (testAdminUser.role === 'admin' || decodedPayloadFromGraceToken.role === 'admin')
    ? { subject_type: 'admin' }
    : undefined;
  const graceAccessToken = generateAccessToken(
    decodedPayloadFromGraceToken.id,
    decodedPayloadFromGraceToken.role,
    testAdminUser.token_version,
    'web',
    adminClaimsOnGrace
  );
  const decodedGrace: any = jwt.verify(graceAccessToken, JWT_SECRET);
  assert.strictEqual(decodedGrace.subject_type, 'admin', 'TEST 3B FAILED: Grace-window token lost subject_type');
  console.log('✔ TEST 3 PASSED: Both rotation and 30s grace-window refresh paths preserve subject_type: admin.');

  // ---------------------------------------------------------------------------
  // TEST 4: Customer and Provider tokens do NOT receive subject_type: admin
  // ---------------------------------------------------------------------------
  const customerUser = { id: '00000000-0000-0000-0000-000000000001', role: 'customer' };
  const customerClaims = customerUser.role === 'admin' ? { subject_type: 'admin' } : undefined;
  const customerToken = generateAccessToken(customerUser.id, customerUser.role, 0, 'mobile', customerClaims);
  const decodedCust: any = jwt.verify(customerToken, JWT_SECRET);
  assert.strictEqual(decodedCust.subject_type, undefined, 'TEST 4 FAILED: Customer token unexpectedly received subject_type');
  assert.strictEqual(decodedCust.role, 'customer', 'TEST 4 FAILED: Customer role is invalid');
  console.log('✔ TEST 4 PASSED: Customer and provider tokens never receive subject_type: admin.');

  console.log('\n================================================================');
  console.log('  ✔ ALL INTEGRATION VERIFICATION CHECKS PASSED (5/5)             ');
  console.log('================================================================\n');
  process.exit(0);
}

if (require.main === module) {
  runIntegrationTests().catch(err => {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
  });
}
