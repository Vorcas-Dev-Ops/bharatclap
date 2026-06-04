import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import mongoose, { Schema } from 'mongoose';

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    role: string;
    name?: string;
    profile_image?: string;
  };
}

let authConnection: mongoose.Connection | null = null;
let User: any = null;

const getAuthModel = () => {
  if (!authConnection) {
    const authDbURI = process.env.AUTH_DB_URI || 'mongodb://localhost:27017/auth_db';
    authConnection = mongoose.createConnection(authDbURI);
    
    const userSchema = new Schema({
      role: { type: String, required: true },
      name: { type: String },
      profile_image: { type: String }
    }, { strict: false });
    
    User = authConnection.model('User', userSchema, 'users');
  }
  return User;
};

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const secret = process.env.JWT_SECRET || 'e54a5ea657fd1d25d021433b58a9c6e101d63feb4f6549cc9520bd3c2d815222';
      const decoded = jwt.verify(token, secret) as { id: string };

      const UserModel = getAuthModel();
      const user = await UserModel.findById(decoded.id).select('role name profile_image');
      
      if (!user) {
        res.status(401).json({ message: 'Not authorized, user not found' });
        return;
      }
      
      req.user = {
        _id: user._id.toString(),
        role: user.role,
        name: user.name,
        profile_image: user.profile_image
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
