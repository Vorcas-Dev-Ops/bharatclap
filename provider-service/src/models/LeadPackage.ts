import mongoose, { Document, Schema } from 'mongoose';

export interface ILeadPackage extends Document {
  name: string;
  price: number;
  leads: number;
  bonusLeads: number;
  validityDays: number;
  hasPriorityDispatch: boolean;
  hasLeadExpiry: boolean;
  badgeText?: string;
  isActive: boolean;
  description?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const leadPackageSchema = new Schema<ILeadPackage>(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    leads: { type: Number, required: true },
    bonusLeads: { type: Number, default: 0 },
    validityDays: { type: Number, default: 30 },
    hasPriorityDispatch: { type: Boolean, default: false },
    hasLeadExpiry: { type: Boolean, default: true },
    badgeText: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    description: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const LeadPackage = mongoose.model<ILeadPackage>('LeadPackage', leadPackageSchema);
