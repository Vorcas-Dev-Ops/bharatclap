export const redactValue = (key: string, val: any): any => {
  if (typeof val !== 'string' || !val) return val;

  const lowerKey = key.toLowerCase();
  if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
    return val.length > 4 ? `***${val.slice(-4)}` : '***';
  }
  if (lowerKey.includes('email')) {
    const parts = val.split('@');
    return parts.length === 2 ? `***@${parts[1]}` : '***';
  }
  if (lowerKey.includes('pan')) {
    return val.length >= 4 ? `${val.slice(0, 2)}***${val.slice(-2)}` : '***';
  }
  if (lowerKey.includes('bank') || lowerKey.includes('account') || lowerKey.includes('aadhaar')) {
    return val.length > 4 ? `****${val.slice(-4)}` : '****';
  }
  if (lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey.includes('token') || lowerKey.includes('key')) {
    return '[REDACTED]';
  }

  return val;
};

export const redact = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => redact(item));
  }

  const sanitized: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === 'object') {
      sanitized[key] = redact(val);
    } else {
      sanitized[key] = redactValue(key, val);
    }
  }
  return sanitized;
};
