import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import mongoose, { Schema } from 'mongoose';
import dns from 'dns';

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    role: string;
  };
}

// Lazy connection to Auth DB — initialised on first request (after dotenv has loaded)
let authConnectionReady: Promise<mongoose.Model<any>> | null = null;

const getAuthModel = (): Promise<mongoose.Model<any>> => {
  if (!authConnectionReady) {
    authConnectionReady = (async () => {
      try {
        dns.setServers(['8.8.8.8', '8.8.4.4']);
      } catch (_) { /* ignore */ }

      const authDbURI = process.env.AUTH_DB_URI || 'mongodb://localhost:27017/auth_db';
      const conn = mongoose.createConnection(authDbURI, {
        connectTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 30000,
      });

      await conn.asPromise();
      console.log(`Auth DB Connected (payment-service): ${conn.host}`);

      const userSchema = new Schema(
        { role: { type: String, required: true } },
        { strict: false }
      );

      return conn.model('User', userSchema, 'users');
    })();
  }
  return authConnectionReady;
};

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  let token: string | undefined;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const secret = process.env.JWT_SECRET || 'e54a5ea657fd1d25d021433b58a9c6e101d63feb4f6549cc9520bd3c2d815222';
      const decoded = jwt.verify(token, secret) as { id: string };

      const UserModel = await getAuthModel();
      const user = await UserModel.findById(decoded.id).select('role');

      if (!user) {
        res.status(401).json({ message: 'Not authorized, user not found' });
        return;
      }

      req.user = {
        _id: user._id.toString(),
        role: user.role,
      };

      return next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
      return;
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
    return;
  }
};

export const admin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};
