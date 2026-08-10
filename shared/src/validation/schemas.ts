import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../errors';

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId string');
export const phoneSchema = z.string().regex(/^(?:\+91|91)?[6-9]\d{9}$/, 'Invalid Indian mobile phone number');
export const emailSchema = z.string().email('Invalid email address');
export const moneySchema = z.number().nonnegative('Amount must be non-negative').multipleOf(0.01, 'Amount must have at most 2 decimal places');
export const coordinatesSchema = z.tuple([
  z.number().min(-180).max(180), // longitude
  z.number().min(-90).max(90)   // latitude
]);
export const ifscSchema = z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code');
export const upiSchema = z.string().regex(/^[\w.-]+@[\w]+$/, 'Invalid UPI ID format');
export const panSchema = z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid Indian PAN number');
export const gstSchema = z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/, 'Invalid GSTIN number');
export const uuidSchema = z.string().uuid('Invalid UUID');

export const datePresetSchema = z.enum([
  'today',
  'yesterday',
  'this_week',
  'last_7_days',
  'last_15_days',
  'last_30_days',
  'this_month',
  'last_month',
  'this_fy',
  'last_fy',
  'custom'
]);

export const validateRequest = (schema: z.ZodSchema) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      if (parsed && typeof parsed === 'object') {
        if ('body' in parsed && parsed.body) req.body = parsed.body;
      }
      next();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        const formatted = err.errors.map(e => ({
          field: e.path.slice(1).join('.'),
          message: e.message
        }));
        next(new ValidationError('Validation failed', formatted));
        return;
      }
      next(err);
    }
  };
};
