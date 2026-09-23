/**
 * BREAK-GLASS: Emergency admin account unlock
 * 
 * Use when ALL super_admin accounts are locked out and no recovery codes remain.
 * Run directly against the database — no API auth required.
 * 
 * Usage:
 *   node scripts/break-glass-unlock.js <admin-email>
 * 
 * What it does:
 *   1. Resets failedOtpAttempts to 0
 *   2. Clears otpLockedUntil
 *   3. Does NOT disable 2FA (you still need your authenticator app)
 *   4. Logs the action to AdminActivityLog
 * 
 * If authenticator app is also lost, use --reset-2fa flag to also disable 2FA:
 *   node scripts/break-glass-unlock.js <admin-email> --reset-2fa
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://fixvoadmin_db_user:Fixvo123@cluster0.rdlnwbx.mongodb.net/auth_db?appName=Cluster0';

async function main() {
  const email = process.argv[2];
  const reset2fa = process.argv.includes('--reset-2fa');

  if (!email) {
    console.error('Usage: node scripts/break-glass-unlock.js <admin-email> [--reset-2fa]');
    process.exit(1);
  }

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('auth_db');
  const users = db.collection('users');
  const logs = db.collection('adminactivitylogs');

  const admin = await users.findOne({ email: email.toLowerCase(), role: 'admin' });
  if (!admin) {
    console.error(`❌ No admin found with email: ${email}`);
    await client.close();
    process.exit(1);
  }

  console.log(`Found admin: ${admin.name} (${admin.email})`);
  console.log(`  Status: ${admin.status}`);
  console.log(`  2FA enabled: ${admin.twoFactorEnabled}`);
  console.log(`  Failed OTP attempts: ${admin.failedOtpAttempts || 0}`);
  console.log(`  Locked until: ${admin.otpLockedUntil || 'not locked'}`);
  console.log(`  Recovery codes remaining: ${(admin.twoFactorRecoveryCodes || []).length}`);
  console.log('');

  const update = {
    $set: {
      failedOtpAttempts: 0,
      otpLockedUntil: null,
      status: 'active',
    },
  };

  if (reset2fa) {
    console.log('⚠️  --reset-2fa: Will disable 2FA. Admin must re-setup on next login.');
    update.$set.twoFactorEnabled = false;
    update.$set.twoFactorSecret = null;
    update.$set.twoFactorRecoveryCodes = [];
  }

  await users.updateOne({ _id: admin._id }, update);

  await logs.insertOne({
    admin_id: 'BREAK_GLASS_SCRIPT',
    admin_name: 'break-glass-unlock.js',
    action: reset2fa ? 'BREAK_GLASS_UNLOCK_AND_RESET_2FA' : 'BREAK_GLASS_UNLOCK',
    target_id: admin._id.toString(),
    details: {
      email: admin.email,
      reset2fa,
      previousFailedAttempts: admin.failedOtpAttempts || 0,
      previousLockedUntil: admin.otpLockedUntil || null,
    },
    timestamp: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log('✅ Account unlocked successfully.');
  if (reset2fa) {
    console.log('   2FA has been reset — admin will be prompted to set up again on next login.');
  }
  console.log('   This action has been logged to AdminActivityLog.');

  await client.close();
  process.exit(0);
}

main().catch(err => {
  console.error('💥 Error:', err.message);
  process.exit(1);
});
