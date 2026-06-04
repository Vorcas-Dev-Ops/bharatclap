import mongoose, { Document, Schema } from 'mongoose';

export interface IOtp extends Document {
  identifier: string;
  otpCode: string;
  role: string;
  createdAt: Date;
}

const otpSchema = new Schema<IOtp>({
  identifier: { 
    type: String, 
    required: true 
  },
  otpCode: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now, 
    expires: 300 // Automatically deletes the document after 5 minutes (300 seconds)
  }
});

export const Otp = mongoose.model<IOtp>('Otp', otpSchema);
