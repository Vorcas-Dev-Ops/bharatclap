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

export const createRazorpayOrderSchema = z.object({
  body: z.object({
    amount: z.number().positive('Amount must be positive'),
  }),
});

export const verifyRazorpayPaymentSchema = z.object({
  body: z.object({
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
    amount: z.number().optional(),
    booking_id: z.string().optional(),
  }),
});

export const processPaymentSchema = z.object({
  body: z.object({
    booking_id: z.string().min(1),
    amount: z.number(),
    payment_method: z.string().min(1),
  }),
});
