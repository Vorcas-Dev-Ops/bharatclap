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

export const createBookingSchema = z.object({
  body: z.object({
    address: z.string().or(z.record(z.string(), z.any())),
    payment_method: z.string().optional(),
    coupon_code: z.string().optional(),
  }),
});
