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

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')),
    password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
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
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  })
});

export const updateMeSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name cannot be empty').optional().or(z.literal('')),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')),
    profile_image: z.string().optional().or(z.literal('')),
    gender: z.string().optional().or(z.literal('')),
    password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
    otp: z.string().optional().or(z.literal('')),
  })
});

export const sendOtpSchema = z.object({
  body: z.object({
    identifier: z.string().min(1, 'Email or Phone number is required'),
    useEmail: z.boolean(),
    role: z.enum(['customer', 'provider']).optional(),
  }).refine(data => {
    if (data.useEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(data.identifier);
    }
    return true;
  }, {
    message: 'Invalid email address',
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
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(data.identifier);
    }
    return true;
  }, {
    message: 'Invalid email address',
    path: ['identifier'],
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  })
});

export const verifyResetOtpSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    otp: z.string().min(4, 'OTP must be at least 4 digits'),
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    otp: z.string().min(4, 'OTP must be at least 4 digits'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  })
});
