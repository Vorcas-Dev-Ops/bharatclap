/**
 * Central Validation Utility for BharatClap Forms
 */

export const VALIDATION_REGEX = {
  NAME: /^[A-Za-z]+(?:\s[A-Za-z]+)*$/,
  PHONE: /^(\+91[- ]?)?[6-9]\d{9}$/,
  PHONE_DIGITS: /^[6-9]\d{9}$/,
  EMAIL: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[A-Za-z\d@$!%*?&#^()_\-+=]{8,}$/,
};

export const VALIDATION_MESSAGES = {
  NAME: "Please enter a valid name using only letters.",
  PHONE: "Please enter a valid 10-digit mobile number.",
  EMAIL: "Please enter a valid email address.",
  PASSWORD: "Password must be at least 8 characters long and include an uppercase letter, lowercase letter, number, and special character.",
};

export function validateName(name: string): string | null {
  if (!name || name.trim().length < 2 || name.trim().length > 50) {
    return VALIDATION_MESSAGES.NAME;
  }
  if (!VALIDATION_REGEX.NAME.test(name.trim())) {
    return VALIDATION_MESSAGES.NAME;
  }
  return null;
}

export function validatePhone(phone: string, isRequired = true): string | null {
  if (!phone || !phone.trim()) {
    return isRequired ? "Phone number is required." : null;
  }

  const trimmed = phone.trim();

  // 1. Check for invalid characters (letters or forbidden symbols)
  if (/[a-zA-Z]/.test(trimmed) || /[@$!%*?&#^()_\=]/.test(trimmed)) {
    return "Phone number cannot contain letters or special characters.";
  }

  if (/[^0-9\s\-+]/.test(trimmed)) {
    return "Phone number cannot contain letters or special characters.";
  }

  if (trimmed.includes('+') && !trimmed.startsWith('+')) {
    return "Phone number cannot contain letters or special characters.";
  }

  // 2. Normalize spaces and hyphens
  let digitsOnly = trimmed.replace(/[\s\-]/g, '');

  // 3. Handle country code (+91 or 91)
  if (digitsOnly.startsWith('+91')) {
    digitsOnly = digitsOnly.substring(3);
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    digitsOnly = digitsOnly.substring(2);
  } else if (digitsOnly.startsWith('+')) {
    digitsOnly = digitsOnly.substring(1);
  }

  // 4. Digits check
  if (!/^\d+$/.test(digitsOnly)) {
    return "Phone number should contain only digits.";
  }

  // 5. Length check (must be exactly 10 digits)
  if (digitsOnly.length !== 10) {
    return "Phone number must contain exactly 10 digits.";
  }

  // 6. Starting digit check (India: 6, 7, 8, or 9)
  if (!/^[6-9]/.test(digitsOnly)) {
    return "Please enter a valid Indian mobile number.";
  }

  return null;
}

export function validateEmail(email: string): string | null {
  if (!email || !VALIDATION_REGEX.EMAIL.test(email.trim())) {
    return VALIDATION_MESSAGES.EMAIL;
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password || !VALIDATION_REGEX.PASSWORD.test(password)) {
    return VALIDATION_MESSAGES.PASSWORD;
  }
  return null;
}
