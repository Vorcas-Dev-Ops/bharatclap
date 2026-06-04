import mongoose, { Document, Schema } from 'mongoose';

export interface IVerificationAction extends Document {
  provider_id: mongoose.Types.ObjectId;
  action_type: 'approved' | 'rejected' | 'requested_docs';
  reasons?: string[];
  custom_message?: string;
  requested_docs?: string[];
  admin_id: mongoose.Types.ObjectId;
  created_at: Date;
}

const verificationActionSchema = new Schema<IVerificationAction>({
  provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
  action_type: { type: String, enum: ['approved', 'rejected', 'requested_docs'], required: true },
  reasons: { type: [String], default: [] },
  custom_message: { type: String },
  requested_docs: { type: [String], default: [] },
  admin_id: { type: Schema.Types.ObjectId, required: true },
  created_at: { type: Date, default: Date.now },
});

export const VerificationAction = mongoose.model<IVerificationAction>('VerificationAction', verificationActionSchema);
