/**
 * Canonical phone number normalization and validation for BharatClap.
 * Enforces valid Indian mobile numbers:
 * - Must resolve to exactly 10 digits starting with 6, 7, 8, or 9 ([6-9]\d{9}).
 * - Allowed input variations:
 *     - 10 digits: "9876543210"
 *     - 11 digits starting with 0: "09876543210"
 *     - 12 digits starting with 91: "+919876543210", "+91 98765 43210"
 * - Rejects invalid prefixes (starting with 0-5), arbitrary long strings (>12 digits),
 *   duplicate "+91" (+91+91...), or short strings (<10 digits).
 * - Canonical format is strictly "+91[6-9]\d{9}".
 */

export function extractIndianMobileDigits(raw: string): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const digitsOnly = trimmed.replace(/\D/g, '');

  let mobile10 = '';
  if (digitsOnly.length === 10) {
    mobile10 = digitsOnly;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    mobile10 = digitsOnly.slice(1);
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    mobile10 = digitsOnly.slice(2);
  } else {
    // Malformed, duplicate +91 (e.g. 9191...), or arbitrary digit length
    return null;
  }

  // Validate Indian mobile operator prefix: must start with 6, 7, 8, or 9
  if (/^[6-9]\d{9}$/.test(mobile10)) {
    return mobile10;
  }
  return null;
}

export function isValidIndianMobile(raw: string): boolean {
  return extractIndianMobileDigits(raw) !== null;
}

export function normalizeCanonicalPhone(raw: string): string {
  const digits = extractIndianMobileDigits(raw);
  if (!digits) return '';
  return `+91${digits}`;
}

export function normalizeIdentifier(raw: string, isEmail?: boolean): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (isEmail) return trimmed.toLowerCase();
  return normalizeCanonicalPhone(trimmed);
}
