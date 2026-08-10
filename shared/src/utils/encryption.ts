import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for GCM

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
    console.error('[ENCRYPTION_ERROR]', err?.message || err);
    throw new Error('Encryption failed');
  }
};

export const decrypt = (encryptedData: string | null | undefined): string => {
  if (!encryptedData) return '';
  if (!encryptedData.includes(':')) {
    // Return raw if it was not encrypted (legacy data)
    return encryptedData;
  }

  try {
    const key = getEncryptionKey();
    const [ivBase64, authTagBase64, ciphertext] = encryptedData.split(':');

    if (!ivBase64 || !authTagBase64 || !ciphertext) {
      return encryptedData;
    }

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err: any) {
    console.error('[DECRYPTION_ERROR]', err?.message || err);
    return encryptedData; // Fallback to raw if decryption fails
  }
};
