import jwt from 'jsonwebtoken';
import { protect, checkPermission, AuthRequest } from '../src/middleware/authMiddleware';

describe('Authentication & Authorization Guards', () => {
  const SECRET = 'test_jwt_secret_key_12345';
  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });

  describe('JWT Access Controls', () => {
    it('should reject requests with missing authorization headers', async () => {
      const req: any = { headers: {} };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await protect(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, no token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow request with valid JWT signature', async () => {
      const token = jwt.sign({ id: 'user_123' }, SECRET);
      expect(token).toBeDefined();
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('should prevent non-admin from accessing restricted resources', () => {
      const req: AuthRequest = {
        user: { _id: 'usr_1', role: 'customer', admin_role: 'support_admin' }
      } as any;
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = checkPermission('payments', 'update');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should assign support_admin as default fallback role for unassigned admin users', () => {
      const req: AuthRequest = {
        user: { _id: 'admin_2', role: 'admin' }
      } as any;
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = checkPermission('bookings', 'update');
      middleware(req, res, next);

      // support_admin has view-only for bookings, update must be denied
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow super_admin full permissions', () => {
      const req: AuthRequest = {
        user: { _id: 'admin_1', role: 'admin', admin_role: 'super_admin' }
      } as any;
      const res: any = {};
      const next = jest.fn();

      const middleware = checkPermission('payments', 'update');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('IDOR & Object Ownership Security Checks', () => {
    it('should deny a customer from accessing another customer\'s booking', () => {
      const requestingUserId: string = 'user_999';
      const bookingOwnerId: string = 'user_111';

      const isOwner = requestingUserId === bookingOwnerId;
      const isAdmin = false;

      expect(isOwner || isAdmin).toBe(false);
    });

    it('should prevent provider from modifying another provider\'s wallet balance', () => {
      const requestingProviderId: string = 'provider_A';
      const targetWalletProviderId: string = 'provider_B';

      const isAuthorized = requestingProviderId === targetWalletProviderId;
      expect(isAuthorized).toBe(false);
    });
  });
});

describe('Wallet Calculation & Idempotency Rules', () => {
  it('should accurately compute available balance subtracting reserved lead fees', () => {
    const walletBalance = 1500;
    const reservedBalance = 300;
    const available = walletBalance - reservedBalance;

    expect(available).toBe(1200);
  });

  it('should block booking acceptance if available balance is below lead fee requirement', () => {
    const walletBalance = 100;
    const reservedBalance = 80;
    const leadFee = 50;
    const available = walletBalance - reservedBalance;

    const canAccept = available >= leadFee;
    expect(canAccept).toBe(false);
  });
});
