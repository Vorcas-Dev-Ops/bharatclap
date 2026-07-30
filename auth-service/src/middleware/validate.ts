import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const validate = (schema: any) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          message: 'Validation error',
          errors: ((error as any).errors || []).map((err: any) => ({
            path: err.path.slice(1).join('.'),
            message: err.message,
          })),
        });
        return;
      }
      return next(error);
    }
  };
};

const NAME_REGEX = /^[A-Za-z]+(?:\s[A-Za-z]+)*$/;
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[A-Za-z\d@$!%*?&#^()_\-+=]{8,}$/;

const NAME_MSG = "Please enter a valid name using only letters.";
const EMAIL_MSG = "Please enter a valid email address.";
const PASSWORD_MSG = "Password must be at least 8 characters long and include an uppercase letter, lowercase letter, number, and special character.";

export function validatePhoneString(phone: string, isRequired = true): { valid: boolean; message: string } {
  if (!phone || !phone.trim()) {
    return { valid: !isRequired, message: isRequired ? "Phone number is required." : "" };
  }
  const trimmed = phone.trim();
  if (/[a-zA-Z]/.test(trimmed) || /[@$!%*?&#^()_\=]/.test(trimmed) || /[^0-9\s\-+]/.test(trimmed)) {
    return { valid: false, message: "Phone number cannot contain letters or special characters." };
  }
  let digitsOnly = trimmed.replace(/[\s\-]/g, '');
  if (digitsOnly.startsWith('+91')) {
    digitsOnly = digitsOnly.substring(3);
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    digitsOnly = digitsOnly.substring(2);
  } else if (digitsOnly.startsWith('+')) {
    digitsOnly = digitsOnly.substring(1);
  }
  if (!/^\d+$/.test(digitsOnly)) {
    return { valid: false, message: "Phone number should contain only digits." };
  }
  if (digitsOnly.length !== 10) {
    return { valid: false, message: "Phone number must contain exactly 10 digits." };
  }
  if (!/^[6-9]/.test(digitsOnly)) {
    return { valid: false, message: "Please enter a valid Indian mobile number." };
  }
  return { valid: true, message: "" };
}

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, NAME_MSG).max(50, NAME_MSG).regex(NAME_REGEX, NAME_MSG),
    email: z.string().regex(EMAIL_REGEX, EMAIL_MSG).optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')).superRefine((val, ctx) => {
      if (val) {
        const res = validatePhoneString(val, false);
        if (!res.valid) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.message });
        }
      }
    }),
    password: z.string().regex(PASSWORD_REGEX, PASSWORD_MSG).optional().or(z.literal('')),
    role: z.enum(['customer', 'provider']).optional(),
    profile_image: z.string().optional(),
    gender: z.string().optional(),
  }).refine(data => data.email || data.phone, {
    message: 'Must provide either email or phone number',
    path: ['email'],
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().regex(EMAIL_REGEX, EMAIL_MSG),
    password: z.string().min(1, 'Password is required'),
  })
});

export const updateMeSchema = z.object({
  body: z.object({
    name: z.string().min(2, NAME_MSG).max(50, NAME_MSG).regex(NAME_REGEX, NAME_MSG).optional().or(z.literal('')),
    email: z.string().regex(EMAIL_REGEX, EMAIL_MSG).optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')).superRefine((val, ctx) => {
      if (val) {
        const res = validatePhoneString(val, false);
        if (!res.valid) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.message });
        }
      }
    }),
    profile_image: z.string().optional().or(z.literal('')),
    gender: z.string().optional().or(z.literal('')),
    password: z.string().regex(PASSWORD_REGEX, PASSWORD_MSG).optional().or(z.literal('')),
    otp: z.string().optional().or(z.literal('')),
    currentPassword: z.string().optional().or(z.literal('')),
    newPassword: z.string().regex(PASSWORD_REGEX, PASSWORD_MSG).optional().or(z.literal('')),
  })
});

export const sendOtpSchema = z.object({
  body: z.object({
    identifier: z.string().min(1, 'Email or Phone number is required'),
    useEmail: z.boolean(),
    role: z.enum(['customer', 'provider']).optional(),
  }).refine(data => {
    if (data.useEmail) {
      return EMAIL_REGEX.test(data.identifier);
    }
    return validatePhoneString(data.identifier, true).valid;
  }, {
    message: 'Please enter a valid phone number.',
    path: ['identifier'],
  })
});

export const verifyOtpSchema = z.object({
  body: z.object({
    identifier: z.string().min(1, 'Email or Phone number is required'),
    useEmail: z.boolean(),
    otp: z.string().min(4, 'OTP must be at least 4 digits'),
  }).refine(data => {
    if (data.useEmail) {
      return EMAIL_REGEX.test(data.identifier);
    }
    return validatePhoneString(data.identifier, true).valid;
  }, {
    message: 'Please enter a valid phone number.',
    path: ['identifier'],
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().regex(EMAIL_REGEX, EMAIL_MSG),
  })
});

export const verifyResetOtpSchema = z.object({
  body: z.object({
    email: z.string().regex(EMAIL_REGEX, EMAIL_MSG),
    otp: z.string().min(4, 'OTP must be at least 4 digits'),
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().regex(EMAIL_REGEX, EMAIL_MSG),
    otp: z.string().min(4, 'OTP must be at least 4 digits'),
    password: z.string().regex(PASSWORD_REGEX, PASSWORD_MSG),
  })
});
