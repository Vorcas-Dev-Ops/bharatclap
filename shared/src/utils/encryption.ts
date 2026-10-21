import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for GCM

export class DecryptionError extends Error {
  constructor(message = 'Cryptographic decryption failed') {
    super(message);
    this.name = 'DecryptionError';
  }
}

const DEFAULT_DEV_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const CURRENT_KEY_VERSION = process.env.ENCRYPTION_KEY_VERSION || 'v1';
const ALLOWED_KEY_VERSIONS = new Set(['v1', 'v2', 'v3']);

// ponytail: startup guard — reject conflicting ENCRYPTION_KEY vs ENCRYPTION_KEY_V1
// ceiling: only checks v1; add similar checks if v2/v3 ever get legacy aliases
if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY_V1 &&
    process.env.ENCRYPTION_KEY !== process.env.ENCRYPTION_KEY_V1) {
  throw new Error(
    '[SECURITY FATAL] ENCRYPTION_KEY and ENCRYPTION_KEY_V1 are both set but differ. ' +
    'This causes split-brain: rows encrypted with one key fail to decrypt with the other. ' +
    'Set only one, or ensure they are identical.'
  );
}

// Reject the insecure default key in ANY env var, regardless of NODE_ENV name
for (const envName of ['ENCRYPTION_KEY', 'ENCRYPTION_KEY_V1', 'ENCRYPTION_KEY_V2', 'ENCRYPTION_KEY_V3']) {
  if (process.env[envName] === DEFAULT_DEV_KEY && process.env.NODE_ENV !== 'test') {
    throw new Error(`[SECURITY FATAL] Insecure default key detected in ${envName}. Forbidden outside NODE_ENV=test.`);
  }
}

const getEncryptionKey = (version: string = CURRENT_KEY_VERSION): Buffer => {
  if (!ALLOWED_KEY_VERSIONS.has(version)) {
    throw new DecryptionError(`Unsupported encryption key version: '${version}'. Allowed versions: ${Array.from(ALLOWED_KEY_VERSIONS).join(', ')}`);
  }

  // Key lookup precedence: ENCRYPTION_KEY_V<N>, then ENCRYPTION_KEY (for v1)
  const versionEnvName = `ENCRYPTION_KEY_${version.toUpperCase()}`;
  let keyEnv = process.env[versionEnvName];

  if (!keyEnv && version === 'v1') {
    keyEnv = process.env.ENCRYPTION_KEY;
  }

  if (!keyEnv) {
    if (process.env.NODE_ENV === 'test') {
      return Buffer.from(DEFAULT_DEV_KEY, 'hex');
    }
    throw new Error(`[SECURITY FATAL] ${versionEnvName} (or ENCRYPTION_KEY) environment variable is required and missing.`);
  }

  if (keyEnv === DEFAULT_DEV_KEY && process.env.NODE_ENV !== 'test') {
    throw new Error(`[SECURITY FATAL] Insecure default ${versionEnvName} is forbidden outside of NODE_ENV=test.`);
  }

  if (keyEnv.length === 64) {
    return Buffer.from(keyEnv, 'hex');
  }
  return crypto.createHash('sha256').update(keyEnv).digest();
};

export const encrypt = (plaintext: string | null | undefined): string => {
  if (!plaintext) return '';
  try {
    const key = getEncryptionKey(CURRENT_KEY_VERSION);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');

    return `${CURRENT_KEY_VERSION}:${iv.toString('base64')}:${authTag}:${encrypted}`;
  } catch (err: any) {
    /* ponytail: log error without leaking sensitive plaintext values */
    console.error('[ENCRYPTION_ERROR] Operation failed');
    throw new Error(err.message.includes('[SECURITY FATAL]') ? err.message : 'Encryption failed');
  }
};

export const decrypt = (encryptedData: string | null | undefined): string => {
  if (!encryptedData) return '';
  
  const parts = encryptedData.split(':');
  let version = 'v1';
  let ivBase64: string;
  let authTagBase64: string;
  let ciphertext: string;

  if (parts.length === 4) {
    [version, ivBase64, authTagBase64, ciphertext] = parts;
  } else if (parts.length === 3) {
    // Legacy unversioned format defaults to v1
    [ivBase64, authTagBase64, ciphertext] = parts;
  } else {
    /* ponytail: strict error throw on unencrypted data instead of fail-open fallback */
    console.error('[DECRYPTION_ERROR] Missing IV/authTag delimiters');
    throw new DecryptionError('Invalid encrypted payload structure');
  }

  try {
    const key = getEncryptionKey(version);
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err: any) {
    /* ponytail: fail-closed security control - never return raw plaintext on decryption failure */
    console.error('[DECRYPTION_ERROR] Decryption authentication failed');
    throw new DecryptionError(err instanceof DecryptionError ? err.message : 'Decryption authentication failed');
  }
};
