import mongoose, { Document, Schema, Types } from 'mongoose';

interface IDocument {
  doc_type: string;
  file_url: string;
  public_id?: string;
  resource_type?: string;
  uploaded_at: Date;
}

export interface IProviderService extends Document {
  provider_id: Types.ObjectId;
  location_ids: Types.ObjectId[]; // Refers to Locations
  experience: number;
  price: number;
  discount: number;
  final_price: number;
  subservice_ids: Types.ObjectId[];
  documents: IDocument[];
  documents_expiry?: Date;
  is_featured: boolean;
  is_available: boolean;
  is_active: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    doc_type: { type: String, required: true },
    file_url: { type: String, required: true },
    public_id: { type: String },
    resource_type: { type: String },
    uploaded_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const providerServiceSchema = new Schema<IProviderService>(
  {
    provider_id: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    location_ids: [
      {
        type: Schema.Types.ObjectId,
      },
    ],
    experience: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    final_price: {
      type: Number,
      required: true,
    },
    subservice_ids: [
      {
        type: Schema.Types.ObjectId,
      },
    ],
    documents: {
      type: [documentSchema],
      default: [],
    },
    documents_expiry: {
      type: Date,
    },
    is_featured: {
      type: Boolean,
      default: false,
    },
    is_available: {
      type: Boolean,
      default: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

providerServiceSchema.index({ location_ids: 1 });
providerServiceSchema.index({ isDeleted: 1 });

export const ProviderService = mongoose.model<IProviderService>('ProviderService', providerServiceSchema);
