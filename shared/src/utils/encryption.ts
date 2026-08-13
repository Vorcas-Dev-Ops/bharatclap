import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for GCM

export class DecryptionError extends Error {
  constructor(message = 'Cryptographic decryption failed') {
    super(message);
    this.name = 'DecryptionError';
  }
}

const getEncryptionKey = (): Buffer => {
  const keyEnv = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  if (keyEnv.length === 64) {
    return Buffer.from(keyEnv, 'hex');
  }
  return crypto.createHash('sha256').update(keyEnv).digest();
};

export const encrypt = (plaintext: string | null | undefined): string => {
  if (!plaintext) return '';
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');

    return `${iv.toString('base64')}:${authTag}:${encrypted}`;
  } catch (err: any) {
    /* ponytail: log error without leaking sensitive plaintext values */
    console.error('[ENCRYPTION_ERROR] Operation failed');
    throw new Error('Encryption failed');
  }
};

export const decrypt = (encryptedData: string | null | undefined): string => {
  if (!encryptedData) return '';
  
  if (!encryptedData.includes(':')) {
    /* ponytail: strict error throw on unencrypted data instead of fail-open fallback */
    console.error('[DECRYPTION_ERROR] Missing IV/authTag delimiters');
    throw new DecryptionError('Invalid encrypted payload structure');
  }

  try {
    const key = getEncryptionKey();
    const [ivBase64, authTagBase64, ciphertext] = encryptedData.split(':');

    if (!ivBase64 || !authTagBase64 || !ciphertext) {
      throw new DecryptionError('Malformed cipher components');
    }

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
